import "server-only";

import { query } from "@/lib/db";
import { getAgencyIdByTag } from "@/lib/config/agencies";
import { toRouteType, type RouteType } from "@/types/gtfs";
import type { Vehicle } from "@/types/api";
import type { VehiclePosition } from "@/types/realtime";

type RouteInfo = {
  routeId: string;
  shortName: string | null;
  longName: string | null;
  routeType: RouteType;
};

type TripRouteRow = {
  trip_id: string;
  route_id: string;
  route_short_name: string | null;
  route_long_name: string | null;
  route_type: number;
};

// The trips -> routes mapping only changes when GTFS static data is
// re-imported, so it is resolved once per trip and reused across ticks
// instead of being joined on every request.
//
// Misses are cached as null as well: a feed routinely carries trips that are
// not in our import, and without that those would be re-queried every tick.
// The whole cache is dropped periodically so a new import is picked up.
const routeByTrip = new Map<string, RouteInfo | null>();
const ROUTE_CACHE_TTL = 60 * 60 * 1000;
let routeCacheStamp = Date.now();

function cacheKey(agencyId: string | undefined, tripId: string): string {
  return `${agencyId ?? "*"}:${tripId}`;
}

function expireRouteCache(): void {
  if (Date.now() - routeCacheStamp > ROUTE_CACHE_TTL) {
    routeByTrip.clear();
    routeCacheStamp = Date.now();
  }
}

async function resolveRoutes(
  agencyId: string | undefined,
  tripIds: string[],
): Promise<void> {
  expireRouteCache();

  const missing = tripIds.filter(
    (tripId) => !routeByTrip.has(cacheKey(agencyId, tripId)),
  );

  if (missing.length === 0) return;

  const rows = await query<TripRouteRow>(
    agencyId
      ? `SELECT t.trip_id, r.route_id, r.route_short_name, r.route_long_name, r.route_type
         FROM trips t JOIN routes r ON r.route_id = t.route_id
         WHERE t.trip_id = ANY($1) AND r.agency_id = $2`
      : `SELECT t.trip_id, r.route_id, r.route_short_name, r.route_long_name, r.route_type
         FROM trips t JOIN routes r ON r.route_id = t.route_id
         WHERE t.trip_id = ANY($1)`,
    agencyId ? [missing, agencyId] : [missing],
  );

  for (const row of rows) {
    routeByTrip.set(cacheKey(agencyId, row.trip_id), {
      routeId: row.route_id,
      shortName: row.route_short_name,
      longName: row.route_long_name,
      routeType: toRouteType(row.route_type),
    });
  }

  // Anything the query did not answer belongs to another agency or is not in
  // our import at all - remember that so the next tick does not ask again.
  for (const tripId of missing) {
    const key = cacheKey(agencyId, tripId);
    if (!routeByTrip.has(key)) {
      routeByTrip.set(key, null);
    }
  }
}

/**
 * Build the finished /api/vehicles response body for one agency.
 *
 * This runs on the worker tick rather than per request, so the Redis reads,
 * the trips -> routes join and the serialisation happen once for all clients.
 */
export async function buildVehicleSnapshot(
  agencyTag: string,
  positions: VehiclePosition[],
): Promise<string> {
  const agencyId = getAgencyIdByTag(agencyTag);
  const tripIds = [...new Set(positions.map((p) => p.tripId))];

  await resolveRoutes(agencyId, tripIds);

  const vehicles: Vehicle[] = [];

  for (const pos of positions) {
    const route = routeByTrip.get(cacheKey(agencyId, pos.tripId));
    if (!route) continue;

    vehicles.push({
      id: pos.vehicleId,
      tripId: pos.tripId,
      routeId: route.routeId,
      routeName: route.shortName || route.routeId,
      routeType: route.routeType,
      headsign: route.longName || route.shortName || "",
      lat: pos.latitude,
      lon: pos.longitude,
      bearing: pos.bearing,
      speed: pos.speed,
    });
  }

  return JSON.stringify({
    vehicles,
    updatedAt: new Date().toISOString(),
  });
}
