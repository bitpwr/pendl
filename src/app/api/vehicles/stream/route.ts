import { NextRequest } from "next/server";
import { getVehicleSnapshot } from "@/lib/redis/realtime";
import { triggerVehiclePositions } from "@/lib/realtime/background-worker";
import { subscribe } from "@/lib/realtime/broadcast";

/** Keeps proxies from closing a stream that has been quiet. */
const HEARTBEAT_MS = 20_000;

/**
 * Streams the map payload for an agency as it is built.
 *
 * The worker runs in this process, so a tick is fanned out to every open
 * stream. That makes the cost of an update independent of how many clients
 * are watching, where polling multiplied it by them.
 */
export async function GET(request: NextRequest) {
  const agencyId = request.nextUrl.searchParams.get("agencyId") || undefined;
  const agencyTag = await triggerVehiclePositions(agencyId);

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;

      // Hoisted, so it can close over the subscription and heartbeat declared
      // below; nothing calls it until they exist.
      function close() {
        if (!open) return;
        open = false;

        clearInterval(heartbeat);
        unsubscribe();

        try {
          controller.close();
        } catch {
          // Already closed by the runtime; nothing to do.
        }
      }

      const send = (chunk: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // The client went away between the abort signal and this write.
          close();
        }
      };

      const unsubscribe = subscribe(agencyTag, (payload) => {
        send(`data: ${payload}\n\n`);
      });

      const heartbeat = setInterval(() => send(`: ping\n\n`), HEARTBEAT_MS);

      request.signal.addEventListener("abort", close);
      if (request.signal.aborted) {
        close();
        return;
      }

      // Send whatever is current so the map draws before the next tick.
      const snapshot = await getVehicleSnapshot(agencyTag);
      if (snapshot) {
        send(`data: ${snapshot}\n\n`);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      // no-transform stops proxies buffering the stream into nothing.
      "cache-control": "no-cache, no-store, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
