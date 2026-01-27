import { NextRequest, NextResponse } from 'next/server';
import { searchStops } from '@/lib/db/queries/stops';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: 'Sökfrågan måste vara minst 2 tecken' },
      { status: 400 }
    );
  }

  try {
    const stops = await searchStops(query, Math.min(limit, 50));
    return NextResponse.json({ stops });
  } catch (error) {
    console.error('Error searching stops:', error);
    return NextResponse.json(
      { error: 'Kunde inte söka efter hållplatser' },
      { status: 500 }
    );
  }
}
