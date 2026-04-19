import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getTripUpdate } from "@/lib/redis/realtime";
import { triggerTripUpdates } from "@/lib/realtime/background-worker";
import type { StopTimeUpdate } from "@/types/realtime";

interface StopRef {
  stopId: string;
  stopSequence: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const agencyId = request.nextUrl.searchParams.get("agencyId") || undefined;

  try {
    await triggerTripUpdates(agencyId);

    const stopRefs = await query<StopRef>(
      `SELECT stop_id as "stopId", stop_sequence as "stopSequence"
       FROM stop_times
       WHERE trip_id = $1
       ORDER BY stop_sequence`,
      [tripId],
    );

    if (stopRefs.length === 0) {
      return NextResponse.json(
        { error: "Resa hittades inte" },
        { status: 404 },
      );
    }

    const tripUpdate = await getTripUpdate(tripId);

    const stops = stopRefs.map((stop) => {
      const u = tripUpdate?.stopTimeUpdates?.find(
        (u: StopTimeUpdate) =>
          u.stopId === stop.stopId || u.stopSequence === stop.stopSequence,
      );

      return {
        stopId: stop.stopId,
        stopSequence: stop.stopSequence,
        realtimeArrival: u?.arrival?.time
          ? new Date(u.arrival.time).toISOString()
          : undefined,
        realtimeDeparture: u?.departure?.time
          ? new Date(u.departure.time).toISOString()
          : undefined,
        delaySeconds: u?.departure?.delay,
        isSkipped: u?.scheduleRelationship === "SKIPPED",
      };
    });

    return NextResponse.json({
      stops,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching trip realtime:", error);
    return NextResponse.json(
      { error: "Kunde inte hämta realtidsinformation" },
      { status: 500 },
    );
  }
}
