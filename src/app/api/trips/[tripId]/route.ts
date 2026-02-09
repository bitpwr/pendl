import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getTripUpdate, getVehicleByTrip } from "@/lib/redis/realtime";
import { toRouteType } from "@/types/gtfs";
import type { StopTimeUpdate } from "@/types/realtime";

interface TripStopRow {
  stopId: string;
  stopName: string;
  stopSequence: number;
  arrivalTime: string;
  departureTime: string;
  platformCode: string | null;
  latitude: number;
  longitude: number;
}

interface TripInfoRow {
  tripId: string;
  routeId: string;
  routeShortName: string;
  routeLongName: string;
  routeType: number;
  tripHeadsign: string;
  shapeId: string | null;
  directionId: number;
}

interface ShapePointRow {
  shapePtLat: number;
  shapePtLon: number;
  shapePtSequence: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;

  try {
    // Get trip info
    const tripInfoSql = `
      SELECT
        t.trip_id as "tripId",
        r.route_id as "routeId",
        r.route_short_name as "routeShortName",
        r.route_long_name as "routeLongName",
        r.route_type as "routeType",
        COALESCE(t.trip_headsign, r.route_long_name) as "tripHeadsign",
        t.shape_id as "shapeId",
        t.direction_id as "directionId"
      FROM trips t
      JOIN routes r ON r.route_id = t.route_id
      WHERE t.trip_id = $1
    `;

    const tripRows = await query<TripInfoRow>(tripInfoSql, [tripId]);

    if (tripRows.length === 0) {
      return NextResponse.json(
        { error: "Resa hittades inte" },
        { status: 404 },
      );
    }

    const tripInfo = tripRows[0];

    // Get all stops for this trip
    const stopsSql = `
      SELECT
        st.stop_id as "stopId",
        s.stop_name as "stopName",
        st.stop_sequence as "stopSequence",
        st.arrival_time::text as "arrivalTime",
        st.departure_time::text as "departureTime",
        s.platform_code as "platformCode",
        s.stop_lat as "latitude",
        s.stop_lon as "longitude"
      FROM stop_times st
      JOIN stops s ON s.stop_id = st.stop_id
      WHERE st.trip_id = $1
      ORDER BY st.stop_sequence
    `;

    const stops = await query<TripStopRow>(stopsSql, [tripId]);

    // Get shape if available
    let shape = null;
    if (tripInfo.shapeId) {
      const shapeSql = `
        SELECT
          shape_pt_lat as "shapePtLat",
          shape_pt_lon as "shapePtLon",
          shape_pt_sequence as "shapePtSequence"
        FROM shapes
        WHERE shape_id = $1
        ORDER BY shape_pt_sequence
      `;

      const shapePoints = await query<ShapePointRow>(shapeSql, [
        tripInfo.shapeId,
      ]);

      if (shapePoints.length > 0) {
        shape = {
          type: "LineString" as const,
          coordinates: shapePoints.map((p) => [p.shapePtLon, p.shapePtLat]),
        };
      }
    }

    // Get realtime data
    const [tripUpdate, vehicle] = await Promise.all([
      getTripUpdate(tripId),
      getVehicleByTrip(tripId),
    ]);

    // Merge realtime updates with stops
    const stopsWithRealtime = stops.map((stop) => {
      const realtimeUpdate = tripUpdate?.stopTimeUpdates?.find(
        (u: StopTimeUpdate) =>
          u.stopId === stop.stopId || u.stopSequence === stop.stopSequence,
      );

      return {
        stopId: stop.stopId,
        stopName: stop.stopName,
        stopSequence: stop.stopSequence,
        arrivalTime: stop.arrivalTime,
        departureTime: stop.departureTime,
        platform: stop.platformCode || undefined,
        latitude: stop.latitude,
        longitude: stop.longitude,
        realtimeArrival: realtimeUpdate?.arrival?.time
          ? new Date(realtimeUpdate.arrival.time).toISOString()
          : undefined,
        realtimeDeparture: realtimeUpdate?.departure?.time
          ? new Date(realtimeUpdate.departure.time).toISOString()
          : undefined,
        delaySeconds: realtimeUpdate?.departure?.delay,
        isSkipped: realtimeUpdate?.scheduleRelationship === "SKIPPED",
      };
    });

    return NextResponse.json({
      trip: {
        tripId: tripInfo.tripId,
        routeId: tripInfo.routeId,
        routeShortName: tripInfo.routeShortName,
        routeLongName: tripInfo.routeLongName,
        routeType: toRouteType(tripInfo.routeType),
        headsign: tripInfo.tripHeadsign,
        directionId: tripInfo.directionId,
      },
      stops: stopsWithRealtime,
      shape,
      vehicle: vehicle
        ? {
            vehicleId: vehicle.vehicleId,
            latitude: vehicle.latitude,
            longitude: vehicle.longitude,
            bearing: vehicle.bearing,
            currentStatus: vehicle.currentStatus,
            currentStopSequence: vehicle.currentStopSequence,
            timestamp: vehicle.timestamp,
          }
        : null,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching trip:", error);
    return NextResponse.json(
      { error: "Kunde inte hämta reseinformation" },
      { status: 500 },
    );
  }
}
