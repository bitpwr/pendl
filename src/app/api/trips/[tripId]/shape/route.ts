import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

interface ShapePointRow {
  shapePtLat: number;
  shapePtLon: number;
  shapePtSequence: number;
}

interface ShapeIdRow {
  shapeId: string | null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;

  try {
    const shapeIdRows = await query<ShapeIdRow>(
      `SELECT shape_id as "shapeId" FROM trips WHERE trip_id = $1`,
      [tripId],
    );

    if (shapeIdRows.length === 0) {
      return NextResponse.json(
        { error: "Resa hittades inte" },
        { status: 404 },
      );
    }

    const shapeId = shapeIdRows[0].shapeId;

    if (!shapeId) {
      return NextResponse.json({ shape: null });
    }

    const shapePoints = await query<ShapePointRow>(
      `SELECT
        shape_pt_lat as "shapePtLat",
        shape_pt_lon as "shapePtLon",
        shape_pt_sequence as "shapePtSequence"
      FROM shapes
      WHERE shape_id = $1
      ORDER BY shape_pt_sequence`,
      [shapeId],
    );

    const shape =
      shapePoints.length > 0
        ? {
            type: "LineString" as const,
            coordinates: shapePoints.map((p) => [p.shapePtLon, p.shapePtLat]),
          }
        : null;

    return NextResponse.json({ shape });
  } catch (error) {
    console.error("Error fetching trip shape:", error);
    return NextResponse.json(
      { error: "Kunde inte hämta resans rutt" },
      { status: 500 },
    );
  }
}
