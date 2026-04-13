import { NextRequest, NextResponse } from "next/server";
import { getVehicleByTrip } from "@/lib/redis/realtime";
import { triggerVehiclePositions } from "@/lib/realtime/background-worker";
import { query } from "@/lib/db";
import { toRouteType } from "@/types/gtfs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const agencyId = request.nextUrl.searchParams.get("agencyId") || undefined;

  try {
    await triggerVehiclePositions(agencyId);
    const vehicle = await getVehicleByTrip(tripId);

    if (!vehicle) {
      return NextResponse.json({
        vehicle: null,
        updatedAt: new Date().toISOString(),
      });
    }

    const routes = await query<{
      route_short_name: string | null;
      route_long_name: string | null;
      route_type: number;
    }>(
      `SELECT r.route_short_name, r.route_long_name, r.route_type
       FROM trips t
       JOIN routes r ON r.route_id = t.route_id
       WHERE t.trip_id = $1`,
      [tripId],
    );
    const route = routes[0];

    return NextResponse.json({
      vehicle: {
        vehicleId: vehicle.vehicleId,
        latitude: vehicle.latitude,
        longitude: vehicle.longitude,
        bearing: vehicle.bearing,
        currentStatus: vehicle.currentStatus,
        speed: vehicle.speed,
        timestamp: vehicle.timestamp,
        routeType: route ? toRouteType(route.route_type) : null,
        routeShortName: route?.route_short_name ?? null,
        headsign: route?.route_long_name ?? route?.route_short_name ?? null,
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching trip vehicle:", error);
    return NextResponse.json(
      { error: "Kunde inte hämta fordonsposition" },
      { status: 500 },
    );
  }
}
