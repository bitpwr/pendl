import { NextRequest, NextResponse } from 'next/server';
import { getStopsByIds } from '@/lib/db/queries/stops';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stopIds } = body;

    if (!Array.isArray(stopIds) || stopIds.length === 0) {
      return NextResponse.json(
        { error: 'En lista med stopp-ID:n krävs' },
        { status: 400 }
      );
    }

    if (stopIds.length > 50) {
      return NextResponse.json(
        { error: 'Max 50 stopp-ID:n per begäran' },
        { status: 400 }
      );
    }

    const stops = await getStopsByIds(stopIds);
    return NextResponse.json({ stops });
  } catch (error) {
    console.error('Error fetching stops by IDs:', error);
    return NextResponse.json(
      { error: 'Kunde inte hämta hållplatser' },
      { status: 500 }
    );
  }
}
