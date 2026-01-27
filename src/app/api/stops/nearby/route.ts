import { NextRequest, NextResponse } from 'next/server';
import { findNearbyStops } from '@/lib/db/queries/stops';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  const radius = parseInt(searchParams.get('radius') || '500', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  if (!lat || !lon) {
    return NextResponse.json(
      { error: 'Latitud och longitud krävs' },
      { status: 400 }
    );
  }

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);

  if (isNaN(latitude) || isNaN(longitude)) {
    return NextResponse.json(
      { error: 'Ogiltig latitud eller longitud' },
      { status: 400 }
    );
  }

  // Validate coordinates are roughly within Sweden
  if (latitude < 55 || latitude > 70 || longitude < 10 || longitude > 25) {
    return NextResponse.json(
      { error: 'Koordinaterna verkar vara utanför Sverige' },
      { status: 400 }
    );
  }

  try {
    const stops = await findNearbyStops(
      latitude,
      longitude,
      Math.min(radius, 2000), // Max 2km radius
      Math.min(limit, 50)
    );
    return NextResponse.json({ stops });
  } catch (error) {
    console.error('Error finding nearby stops:', error);
    return NextResponse.json(
      { error: 'Kunde inte hitta närliggande hållplatser' },
      { status: 500 }
    );
  }
}
