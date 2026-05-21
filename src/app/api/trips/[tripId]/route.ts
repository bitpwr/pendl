import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { toRouteType } from "@/types/gtfs";

interface TripStopRow {
  stopId: string;
  areaId: string | null;
  stopName: string;
  stopSequence: number;
  stopHeadsign: string | null;
  arrivalTime: string;
  departureTime: string;
  platformCode: string | null;
  latitude: number;
  longitude: number;
}

interface TripInfoRow {
  tripId: string;
  routeId: string;
  routeName: string;
  routeLongName: string;
  routeType: number;
  shapeId: string | null;
  directionId: number;
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
        r.route_short_name as "routeName",
        r.route_long_name as "routeLongName",
        r.route_type as "routeType",
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
        sa.area_id as "areaId",
        s.stop_name as "stopName",
        st.stop_sequence as "stopSequence",
        st.stop_headsign as "stopHeadsign",
        st.arrival_time::text as "arrivalTime",
        st.departure_time::text as "departureTime",
        s.platform_code as "platformCode",
        s.stop_lat as "latitude",
        s.stop_lon as "longitude"
      FROM stop_times st
      JOIN stops s ON s.stop_id = st.stop_id
      LEFT JOIN LATERAL (
        SELECT area_id
        FROM stop_areas
        WHERE stop_id = st.stop_id
        ORDER BY area_id
        LIMIT 1
      ) sa ON true
      WHERE st.trip_id = $1
      ORDER BY st.stop_sequence
    `;

    const stops = await query<TripStopRow>(stopsSql, [tripId]);

    const stopHeadsign =
      stops.find((stop) => stop.stopHeadsign?.trim())?.stopHeadsign ??
      stops.at(-1)?.stopName ??
      null;

    return NextResponse.json({
      trip: {
        tripId: tripInfo.tripId,
        routeId: tripInfo.routeId,
        routeName: tripInfo.routeName,
        routeLongName: tripInfo.routeLongName,
        routeType: toRouteType(tripInfo.routeType),
        headsign: stopHeadsign || tripInfo.routeLongName || tripInfo.routeName,
        directionId: tripInfo.directionId,
      },
      stops: stops.map((stop) => ({
        stopId: stop.stopId,
        areaId: stop.areaId ?? undefined,
        stopName: stop.stopName,
        stopSequence: stop.stopSequence,
        arrivalTime: stop.arrivalTime,
        departureTime: stop.departureTime,
        platform: stop.platformCode || undefined,
        latitude: stop.latitude,
        longitude: stop.longitude,
      })),
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
