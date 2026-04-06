import { NextRequest, NextResponse } from "next/server";
import { getVehicleByTrip } from "@/lib/redis/realtime";
import { triggerVehiclePositions } from "@/lib/realtime/background-worker";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const agencyId = request.nextUrl.searchParams.get("agencyId") || undefined;

  try {
    await triggerVehiclePositions(agencyId);
    const vehicle = await getVehicleByTrip(tripId);

    return NextResponse.json({
      vehicle: vehicle
        ? {
            vehicleId: vehicle.vehicleId,
            latitude: vehicle.latitude,
            longitude: vehicle.longitude,
            bearing: vehicle.bearing,
            currentStatus: vehicle.currentStatus,
            speed: vehicle.speed,
            timestamp: vehicle.timestamp,
          }
        : null,
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
