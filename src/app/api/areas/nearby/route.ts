import { NextRequest, NextResponse } from "next/server";
import { findNearbyAreas } from "@/lib/db/queries/areas";
import { isIncludedAgency } from "@/lib/config/agencies";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = parseFloat(searchParams.get("lat") || "");
  const lon = parseFloat(searchParams.get("lon") || "");
  const radius = parseInt(searchParams.get("radius") || "500", 10);
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const agencyId = searchParams.get("agencyId") || undefined;

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json(
      { error: "Latitud och longitud krävs" },
      { status: 400 },
    );
  }

  if (agencyId && !isIncludedAgency(agencyId)) {
    return NextResponse.json({ error: "Ogiltigt agency-ID" }, { status: 400 });
  }

  try {
    const areas = await findNearbyAreas(
      lat,
      lon,
      Math.min(radius, 2000),
      Math.min(limit, 50),
      agencyId,
    );
    return NextResponse.json({ areas });
  } catch (error) {
    console.error("Error finding nearby areas:", error);
    return NextResponse.json(
      { error: "Kunde inte hitta närliggande områden" },
      { status: 500 },
    );
  }
}
