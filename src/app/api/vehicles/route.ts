import { NextRequest, NextResponse } from "next/server";
import { getAllVehiclePositions } from "@/lib/redis/realtime";
import { triggerVehiclePositions } from "@/lib/realtime/background-worker";
import { query } from "@/lib/db";
import type { Vehicle } from "@/types/api";
import { toRouteType } from "@/types/gtfs";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const routeTypeParam = searchParams.get("routeType");
  const routeTypeFilter = routeTypeParam ? parseInt(routeTypeParam, 10) : null;
  const agencyId = searchParams.get("agencyId") || undefined;

  try {
    await triggerVehiclePositions(agencyId);

    // Get all vehicle positions
    const positions = await getAllVehiclePositions();

    if (positions.length === 0) {
      return NextResponse.json({
        vehicles: [],
        updatedAt: new Date().toISOString(),
      });
    }

    // Get unique trip IDs
    const tripIds = [...new Set(positions.map((p) => p.tripId))];

    // Fetch route data via trip join in a single query
    const tripRoutes = await query<{
      trip_id: string;
      route_id: string;
      route_short_name: string | null;
      route_long_name: string | null;
      route_type: number;
    }>(
      agencyId
        ? `SELECT t.trip_id, r.route_id, r.route_short_name, r.route_long_name, r.route_type
           FROM trips t JOIN routes r ON r.route_id = t.route_id
           WHERE t.trip_id = ANY($1) AND r.agency_id = $2`
        : `SELECT t.trip_id, r.route_id, r.route_short_name, r.route_long_name, r.route_type
           FROM trips t JOIN routes r ON r.route_id = t.route_id
           WHERE t.trip_id = ANY($1)`,
      agencyId ? [tripIds, agencyId] : [tripIds],
    );

    // Create lookup map by trip_id
    const tripRouteMap = new Map(
      tripRoutes.map((r) => [
        r.trip_id,
        {
          routeId: r.route_id,
          shortName: r.route_short_name,
          longName: r.route_long_name,
          routeType: toRouteType(r.route_type),
        },
      ]),
    );

    // Transform to API response format and filter
    const allVehicles: (Vehicle | null)[] = positions.map((pos) => {
      const route = tripRouteMap.get(pos.tripId);

      if (!route) {
        return null;
      }

      return {
        vehicleId: pos.vehicleId,
        tripId: pos.tripId,
        routeId: route.routeId,
        routeShortName: route.shortName || route.routeId,
        routeType: route.routeType,
        headsign: route.longName || route.shortName || "",
        lat: pos.latitude,
        long: pos.longitude,
        bearing: pos.bearing,
        speed: pos.speed,
      };
    });

    const vehiclesBeforeFilter = allVehicles.filter(
      (v): v is Vehicle => v !== null,
    );

    const vehicles = vehiclesBeforeFilter.filter(
      (v) => routeTypeFilter === null || v.routeType === routeTypeFilter,
    );

    return NextResponse.json({
      vehicles,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching vehicles:", error);
    return NextResponse.json(
      { error: "Kunde inte hämta fordonspositioner" },
      { status: 500 },
    );
  }
}
