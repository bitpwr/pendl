import { NextRequest, NextResponse } from 'next/server';
import { getAllVehiclePositions, getVehiclesByRoute } from '@/lib/redis/realtime';
import type { Vehicle } from '@/types/api';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const routeId = searchParams.get('routeId');

  try {
    // Get vehicle positions
    const positions = routeId
      ? await getVehiclesByRoute(routeId)
      : await getAllVehiclePositions();

    // Transform to API response format
    const vehicles: Vehicle[] = positions.map((pos) => ({
      vehicleId: pos.vehicleId,
      tripId: pos.tripId,
      routeId: pos.routeId,
      routeShortName: '', // Would need to join with route data
      routeColor: '', // Would need to join with route data
      headsign: '', // Would need to join with trip data
      latitude: pos.latitude,
      longitude: pos.longitude,
      bearing: pos.bearing,
      speed: pos.speed,
      currentStatus: pos.currentStatus,
    }));

    return NextResponse.json({
      vehicles,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    return NextResponse.json(
      { error: 'Kunde inte hämta fordonspositioner' },
      { status: 500 }
    );
  }
}
