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

  try {
    await triggerVehiclePositions();

    // Get all vehicle positions
    const positions = await getAllVehiclePositions();

    if (positions.length === 0) {
      return NextResponse.json({
        vehicles: [],
        updatedAt: new Date().toISOString(),
      });
    }

    // Get unique route IDs and trip IDs
    const routeIds = [
      ...new Set(positions.map((p) => p.routeId).filter(Boolean)),
    ];
    const tripIds = [...new Set(positions.map((p) => p.tripId))];

    // console.log(
    //   `Processing ${positions.length} vehicles, ${tripIds.length} unique trips, ${routeIds.length} with routeId`,
    // );

    // Fetch trip data which includes route_id
    const trips = await query<{
      trip_id: string;
      trip_headsign: string;
      route_id: string;
    }>(
      `SELECT trip_id, trip_headsign, route_id FROM trips WHERE trip_id = ANY($1)`,
      [tripIds],
    );

    // console.log(`Found ${trips.length} trips in database`);

    // Get all route IDs from trips
    const allRouteIds = [
      ...new Set([...routeIds, ...trips.map((t) => t.route_id)]),
    ];

    // Fetch route data
    const routes = await query<{
      route_id: string;
      route_short_name: string;
      route_type: number;
    }>(
      `SELECT route_id, route_short_name, route_type FROM routes WHERE route_id = ANY($1)`,
      [allRouteIds],
    );

    // console.log(`Found ${routes.length} routes in database`);

    // Create lookup maps
    const routeMap = new Map(
      routes.map((r) => [
        r.route_id,
        { shortName: r.route_short_name, routeType: toRouteType(r.route_type) },
      ]),
    );
    const tripMap = new Map(
      trips.map((t) => [
        t.trip_id,
        { headsign: t.trip_headsign, routeId: t.route_id },
      ]),
    );

    // Transform to API response format and filter
    const allVehicles: (Vehicle | null)[] = positions.map((pos) => {
      // Get route ID from vehicle or from trip
      const tripInfo = tripMap.get(pos.tripId);
      const routeId = pos.routeId || tripInfo?.routeId;

      if (!routeId) {
        return null;
      }

      const route = routeMap.get(routeId);

      // Skip vehicles without route data
      if (!route) {
        // console.log(
        //   `No route data for route ${routeId} (vehicle ${pos.vehicleId})`,
        // );
        return null;
      }

      return {
        vehicleId: pos.vehicleId,
        tripId: pos.tripId,
        routeId: routeId,
        routeShortName: route.shortName || routeId,
        routeType: route.routeType,
        headsign: tripInfo?.headsign || "",
        latitude: pos.latitude,
        longitude: pos.longitude,
        bearing: pos.bearing,
        speed: pos.speed,
      };
    });

    const vehiclesBeforeFilter = allVehicles.filter(
      (v): v is Vehicle => v !== null,
    );
    // console.log(`${vehiclesBeforeFilter.length} vehicles with route data`);

    const vehicles = vehiclesBeforeFilter.filter(
      (v) => routeTypeFilter === null || v.routeType === routeTypeFilter,
    );

    // console.log(
    //   `${vehicles.length} vehicles after routeType filter (filter: ${routeTypeFilter})`,
    // );

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
