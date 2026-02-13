import { NextRequest, NextResponse } from "next/server";
import { getScheduledDepartures } from "@/lib/db/queries/departures";
import { getStop, getChildStops } from "@/lib/db/queries/stops";
import { getTripUpdates } from "@/lib/redis/realtime";
import { gtfsTimeToActualDate } from "@/lib/gtfs/time-utils";
import type { Departure } from "@/types/api";

interface Props {
  params: Promise<{ stopId: string }>;
}

export async function GET(request: NextRequest, { params }: Props) {
  const { stopId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "30", 10);
  const hoursAhead = parseInt(searchParams.get("hours") || "2", 10);

  try {
    // Get the stop information
    const stop = await getStop(stopId);
    if (!stop) {
      return NextResponse.json(
        { error: "Hållplatsen hittades inte" },
        { status: 404 },
      );
    }

    // Get child stops if this is a parent station
    let childStopIds: string[] = [];
    if (stop.locationType === 1) {
      const childStops = await getChildStops(stopId);
      childStopIds = childStops.map((s) => s.stopId);
    }

    // Get scheduled departures
    const scheduled = await getScheduledDepartures(stopId, {
      limit: Math.min(limit, 100),
      hoursAhead: Math.min(hoursAhead, 12),
    });

    // Get realtime updates for these trips
    const tripIds = scheduled.map((d) => d.tripId);
    const tripUpdates = await getTripUpdates(tripIds);

    // Build response
    const now = new Date();
    const departures: Departure[] = scheduled.map((dep) => {
      const scheduledTime = gtfsTimeToActualDate(dep.departureTime, now);
      const tripUpdate = tripUpdates.get(dep.tripId);

      // Calculate realtime delay if available
      let realtimeTime: Date | undefined;
      let delaySeconds: number | undefined;

      if (tripUpdate) {
        // Find the stop time update for this stop
        const stopUpdate = tripUpdate.stopTimeUpdates?.find(
          (stu) =>
            stu.stopId === dep.stopId || childStopIds.includes(stu.stopId),
        );

        if (stopUpdate?.departure) {
          if (stopUpdate.departure.delay !== undefined) {
            delaySeconds = stopUpdate.departure.delay;
            realtimeTime = new Date(
              scheduledTime.getTime() + delaySeconds * 1000,
            );
          } else if (stopUpdate.departure.time) {
            realtimeTime = new Date(stopUpdate.departure.time * 1000);
            delaySeconds = Math.round(
              (realtimeTime.getTime() - scheduledTime.getTime()) / 1000,
            );
          }
        }
      }

      return {
        tripId: dep.tripId,
        routeId: dep.routeId,
        routeShortName: dep.routeShortName,
        routeLongName: dep.routeLongName,
        routeType: dep.routeType,
        headsign: dep.tripHeadsign,
        scheduledDeparture: scheduledTime.toISOString(),
        realtimeDeparture: realtimeTime?.toISOString(),
        delaySeconds,
        isCancelled: tripUpdate?.scheduleRelationship === "CANCELED",
        stopId: dep.stopId,
        directionId: dep.directionId,
      };
    });

    // Filter out past departures and sort by actual departure time
    const filteredDepartures = departures
      .filter((d) => {
        const depTime = d.realtimeDeparture
          ? new Date(d.realtimeDeparture)
          : new Date(d.scheduledDeparture);
        return depTime > now && !d.isCancelled;
      })
      .sort((a, b) => {
        const timeA = a.realtimeDeparture || a.scheduledDeparture;
        const timeB = b.realtimeDeparture || b.scheduledDeparture;
        return new Date(timeA).getTime() - new Date(timeB).getTime();
      });

    return NextResponse.json({
      stop: {
        stopId: stop.stopId,
        stopName: stop.stopName,
        latitude: stop.stopLat,
        longitude: stop.stopLon,
      },
      departures: filteredDepartures,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching departures:", error);
    return NextResponse.json(
      { error: "Kunde inte hämta avgångar" },
      { status: 500 },
    );
  }
}
