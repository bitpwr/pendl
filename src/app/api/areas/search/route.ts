import { NextRequest, NextResponse } from "next/server";
import { searchAreas } from "@/lib/db/queries/areas";
import { isIncludedAgency } from "@/lib/config/agencies";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const agencyId = searchParams.get("agencyId") || undefined;

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: "Sökfrågan måste vara minst 2 tecken" },
      { status: 400 },
    );
  }

  if (agencyId && !isIncludedAgency(agencyId)) {
    return NextResponse.json({ error: "Ogiltigt agency-ID" }, { status: 400 });
  }

  try {
    const areas = await searchAreas(query, Math.min(limit, 50), agencyId);
    return NextResponse.json({ areas });
  } catch (error) {
    console.error("Error searching areas:", error);
    return NextResponse.json(
      { error: "Kunde inte söka efter områden" },
      { status: 500 },
    );
  }
}
