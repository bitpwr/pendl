"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Vehicle } from "@/types/api";

export const POLL_INTERVAL_MS = 2000;

export type FeedTransport = "stream" | "poll";

export interface VehicleFeed {
  vehicles: Vehicle[];
  updatedAt?: Date;
  error: Error | null;
  transport: FeedTransport;
  /** One-off fetch, for the retry button. */
  refresh: () => void;
}

interface Options {
  /**
   * Updates are dropped while this returns true, so the marker set does not
   * shift under a pan or zoom in progress.
   */
  isPaused?: () => boolean;
}

function buildQuery(agencyId: string | undefined): string {
  const params = new URLSearchParams();
  if (agencyId) params.set("agencyId", agencyId);
  return params.size ? `?${params}` : "";
}

function streamsSupported(): boolean {
  return typeof window !== "undefined" && "EventSource" in window;
}

/**
 * Vehicle positions for an agency, pushed over SSE where possible.
 *
 * The server builds one payload per tick and fans it out, so streaming keeps
 * its cost flat in the number of clients. Polling stays as the fallback for
 * anything that cannot hold the connection open.
 */
export function useVehicleFeed(
  agencyId: string | undefined,
  { isPaused }: Options = {},
): VehicleFeed {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date>();
  const [error, setError] = useState<Error | null>(null);
  const [transport, setTransport] = useState<FeedTransport>(() =>
    streamsSupported() ? "stream" : "poll",
  );

  const pausedRef = useRef(isPaused);
  pausedRef.current = isPaused;

  const apply = useCallback((payload: unknown) => {
    if (pausedRef.current?.()) return;

    const data = payload as { vehicles?: Vehicle[]; updatedAt?: string };
    setVehicles(data.vehicles ?? []);
    if (data.updatedAt) {
      setUpdatedAt(new Date(data.updatedAt));
    }
    setError(null);
  }, []);

  const fetchOnce = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch(`/api/vehicles${buildQuery(agencyId)}`, {
          signal,
        });
        if (!response.ok) {
          throw new Error("Kunde inte hämta fordonspositioner");
        }
        apply(await response.json());
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err : new Error("Okänt fel"));
      }
    },
    [agencyId, apply],
  );

  const refresh = useCallback(() => void fetchOnce(), [fetchOnce]);

  // --- streaming ---------------------------------------------------------
  useEffect(() => {
    if (transport !== "stream") return;

    let source: EventSource | null = null;
    let receivedAny = false;

    const open = () => {
      if (source) return;

      source = new EventSource(`/api/vehicles/stream${buildQuery(agencyId)}`);

      source.onmessage = (event) => {
        receivedAny = true;
        try {
          apply(JSON.parse(event.data));
        } catch {
          // A truncated frame is not worth tearing the stream down for.
        }
      };

      source.onerror = () => {
        // Once the stream has worked, EventSource reconnects on its own.
        // Failing before it ever delivered means streaming is not available
        // here - a proxy buffering it, say - so drop to polling for good.
        if (!receivedAny) {
          source?.close();
          source = null;
          setTransport("poll");
        }
      };
    };

    const close = () => {
      source?.close();
      source = null;
    };

    // A hidden tab does not need the connection held open for it.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        open();
      } else {
        close();
      }
    };

    if (document.visibilityState === "visible") open();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      close();
    };
  }, [transport, agencyId, apply]);

  // --- polling fallback --------------------------------------------------
  useEffect(() => {
    if (transport !== "poll") return;

    const controller = new AbortController();
    let inFlight = false;

    const tick = async () => {
      if (inFlight) return;
      if (pausedRef.current?.()) return;
      if (document.visibilityState === "hidden") return;

      inFlight = true;
      try {
        await fetchOnce(controller.signal);
      } finally {
        inFlight = false;
      }
    };

    void tick();
    const interval = setInterval(() => void tick(), POLL_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      controller.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [transport, fetchOnce]);

  return { vehicles, updatedAt, error, transport, refresh };
}
