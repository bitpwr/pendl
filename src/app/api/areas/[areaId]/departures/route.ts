import { NextRequest, NextResponse } from "next/server";
import { getScheduledDeparturesForStops } from "@/lib/db/queries/departures";
import { getArea, getAreaStops } from "@/lib/db/queries/areas";
import { getTripUpdates } from "@/lib/redis/realtime";
import { gtfsTimeToDate } from "@/lib/gtfs/time-utils";
import type { Departure } from "@/types/api";

interface Props {
  params: Promise<{ areaId: string }>;
}

export async function GET(request: NextRequest, { params }: Props) {
  const { areaId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const hoursAhead = parseInt(searchParams.get("hours") || "2", 10);

  try {
    // Get the area information
    const area = await getArea(areaId);
    if (!area) {
      return NextResponse.json(
        { error: "Området hittades inte" },
        { status: 404 },
      );
    }

    // Get all stops in this area
    const areaStops = await getAreaStops(areaId);
    if (areaStops.length === 0) {
      return NextResponse.json(
        { error: "Inga hållplatser hittades i detta område" },
        { status: 404 },
      );
    }

    const stopIds = areaStops.map((s) => s.stopId);
    const stopMap = new Map(areaStops.map((s) => [s.stopId, s]));

    // Get scheduled departures for all stops in the area
    const scheduled = await getScheduledDeparturesForStops(stopIds, {
      limit: Math.min(limit, 200),
      hoursAhead: Math.min(hoursAhead, 12),
    });

    // Get realtime updates for these trips
    const tripIds = scheduled.map((d) => d.tripId);
    const tripUpdates = await getTripUpdates(tripIds);

    // Build response
    const now = new Date();
    const departures: Departure[] = scheduled.map((dep) => {
      const scheduledTime = gtfsTimeToDate(dep.departureTime, now);
      const tripUpdate = tripUpdates.get(dep.tripId);
      const stopInfo = stopMap.get(dep.stopId);

      // Calculate realtime delay if available
      let realtimeTime: Date | undefined;
      let delaySeconds: number | undefined;

      if (tripUpdate) {
        // Find the stop time update for this stop
        const stopUpdate = tripUpdate.stopTimeUpdates?.find(
          (stu) => stu.stopId === dep.stopId,
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
        platform: stopInfo?.platformCode || undefined,
        stopName: stopInfo?.stopName,
      };
    });

    // Filter out past departures and cancelled ones
    const filteredDepartures = departures
      .filter((d) => {
        const depTime = d.realtimeDeparture
          ? new Date(d.realtimeDeparture)
          : new Date(d.scheduledDeparture);
        return depTime > now && !d.isCancelled;
      })
      .sort((a, b) => {
        const aTime = a.realtimeDeparture || a.scheduledDeparture;
        const bTime = b.realtimeDeparture || b.scheduledDeparture;
        return new Date(aTime).getTime() - new Date(bTime).getTime();
      });

    // Group departures by stop
    const groupedByStop = new Map<string, Departure[]>();
    for (const dep of filteredDepartures) {
      const key = dep.stopId;
      if (!groupedByStop.has(key)) {
        groupedByStop.set(key, []);
      }
      groupedByStop.get(key)!.push(dep);
    }

    // Convert to array of groups
    const groups = Array.from(groupedByStop.entries()).map(
      ([stopId, departures]) => {
        const stopInfo = stopMap.get(stopId);
        return {
          stopId,
          stopName: stopInfo?.stopName || "",
          platformCode: stopInfo?.platformCode || null,
          departures,
        };
      },
    );

    // Sort groups by platform code, then by stop name
    groups.sort((a, b) => {
      if (a.platformCode && b.platformCode) {
        return a.platformCode.localeCompare(b.platformCode, "sv", {
          numeric: true,
        });
      }
      if (a.platformCode) return -1;
      if (b.platformCode) return 1;
      return a.stopName.localeCompare(b.stopName, "sv");
    });

    return NextResponse.json({
      area: {
        areaId: area.areaId,
        areaName: area.areaName,
        latitude: area.latitude,
        longitude: area.longitude,
      },
      groups,
      updatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("Error fetching area departures:", error);
    return NextResponse.json(
      { error: "Kunde inte hämta avgångar" },
      { status: 500 },
    );
  }
}
