import { NextRequest, NextResponse } from "next/server";
import { getVehicleSnapshot } from "@/lib/redis/realtime";
import { triggerVehiclePositions } from "@/lib/realtime/background-worker";

const EMPTY_SNAPSHOT = JSON.stringify({ vehicles: [] });

/**
 * Serves the map payload the worker prebuilt for this agency.
 *
 * Route type filtering happens on the client: the payload is identical for
 * every caller on an agency, which is what keeps this a single Redis read.
 */
export async function GET(request: NextRequest) {
  const agencyId = request.nextUrl.searchParams.get("agencyId") || undefined;

  try {
    const agencyTag = await triggerVehiclePositions(agencyId);
    const snapshot = await getVehicleSnapshot(agencyTag);

    return new NextResponse(snapshot ?? EMPTY_SNAPSHOT, {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching vehicles:", error);
    return NextResponse.json(
      { error: "Kunde inte hämta fordonspositioner" },
      { status: 500 },
    );
  }
}
