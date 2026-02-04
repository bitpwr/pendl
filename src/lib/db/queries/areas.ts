import { query, queryOne } from "../index";

export interface AreaSearchResult {
  areaId: string;
  areaName: string;
  latitude: number;
  longitude: number;
  routeTypes: number[];
  stopIds: string[];
  distance?: number;
}

export interface Area {
  areaId: string;
  areaName: string;
  latitude: number;
  longitude: number;
}

/**
 * Search for areas by name using full-text search
 * Only returns areas that have stops in the database
 */
export async function searchAreas(
  searchQuery: string,
  limit = 10,
): Promise<AreaSearchResult[]> {
  // Convert search query to tsquery format
  const tsQuery = searchQuery
    .trim()
    .split(/\s+/)
    .map((word) => word + ":*")
    .join(" & ");

  const sql = `
    SELECT
      a.area_id as "areaId",
      a.area_name as "areaName",
      al.latitude as "latitude",
      al.longitude as "longitude",
      COALESCE(art.route_types, ARRAY[]::integer[]) as "routeTypes",
      ARRAY_AGG(sa.stop_id) as "stopIds"
    FROM areas a
    JOIN stop_areas sa ON sa.area_id = a.area_id
    JOIN stops s ON s.stop_id = sa.stop_id
    LEFT JOIN area_locations al ON al.area_id = a.area_id
    LEFT JOIN area_route_types art ON art.area_id = a.area_id
    WHERE a.search_vector @@ to_tsquery('swedish', $1)
      AND s.location_type = 0
    GROUP BY a.area_id, a.area_name, al.latitude, al.longitude, art.route_types
    HAVING COUNT(sa.stop_id) > 0
    ORDER BY ts_rank(a.search_vector, to_tsquery('swedish', $1)) DESC
    LIMIT $2
  `;

  return query<AreaSearchResult>(sql, [tsQuery, limit]);
}

/**
 * Find areas near a geographic point
 */
export async function findNearbyAreas(
  latitude: number,
  longitude: number,
  radiusMeters = 500,
  limit = 10,
): Promise<AreaSearchResult[]> {
  const sql = `
    SELECT
      a.area_id as "areaId",
      a.area_name as "areaName",
      al.latitude as "latitude",
      al.longitude as "longitude",
      ST_Distance(
        al.geom::geography,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
      ) as "distance",
      COALESCE(art.route_types, ARRAY[]::integer[]) as "routeTypes",
      ARRAY_AGG(sa.stop_id) as "stopIds"
    FROM areas a
    JOIN stop_areas sa ON sa.area_id = a.area_id
    JOIN stops s ON s.stop_id = sa.stop_id
    JOIN area_locations al ON al.area_id = a.area_id
    LEFT JOIN area_route_types art ON art.area_id = a.area_id
    WHERE s.location_type = 0
      AND ST_DWithin(
        al.geom::geography,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
        $3
      )
    GROUP BY a.area_id, a.area_name, al.latitude, al.longitude, al.geom, art.route_types
    HAVING COUNT(sa.stop_id) > 0
    ORDER BY ST_Distance(
      al.geom::geography,
      ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
    )
    LIMIT $4
  `;

  return query<AreaSearchResult>(sql, [
    latitude,
    longitude,
    radiusMeters,
    limit,
  ]);
}

/**
 * Get a single area by ID with its stops
 */
export async function getArea(areaId: string): Promise<Area | null> {
  const sql = `
    SELECT
      a.area_id as "areaId",
      a.area_name as "areaName",
      al.latitude as "latitude",
      al.longitude as "longitude"
    FROM areas a
    LEFT JOIN area_locations al ON al.area_id = a.area_id
    WHERE a.area_id = $1
  `;

  return queryOne<Area>(sql, [areaId]);
}

/**
 * Get all stop IDs for an area
 */
export async function getAreaStopIds(areaId: string): Promise<string[]> {
  const sql = `
    SELECT sa.stop_id as "stopId"
    FROM stop_areas sa
    JOIN stops s ON s.stop_id = sa.stop_id
    WHERE sa.area_id = $1
      AND s.location_type = 0
  `;

  const rows = await query<{ stopId: string }>(sql, [areaId]);
  return rows.map((r) => r.stopId);
}

export interface AreaStop {
  stopId: string;
  stopName: string;
  platformCode: string | null;
}

/**
 * Get all stops for an area with their names
 */
export async function getAreaStops(areaId: string): Promise<AreaStop[]> {
  const sql = `
    SELECT
      s.stop_id as "stopId",
      s.stop_name as "stopName",
      s.platform_code as "platformCode"
    FROM stop_areas sa
    JOIN stops s ON s.stop_id = sa.stop_id
    WHERE sa.area_id = $1
      AND s.location_type = 0
    ORDER BY s.platform_code, s.stop_name
  `;

  return query<AreaStop>(sql, [areaId]);
}

/**
 * Get multiple areas by IDs (for favorites)
 */
export async function getAreasByIds(
  areaIds: string[],
): Promise<AreaSearchResult[]> {
  if (areaIds.length === 0) return [];

  const placeholders = areaIds.map((_, i) => `$${i + 1}`).join(", ");
  const sql = `
    SELECT
      a.area_id as "areaId",
      a.area_name as "areaName",
      al.latitude as "latitude",
      al.longitude as "longitude",
      COALESCE(art.route_types, ARRAY[]::integer[]) as "routeTypes",
      ARRAY_AGG(sa.stop_id) as "stopIds"
    FROM areas a
    JOIN stop_areas sa ON sa.area_id = a.area_id
    JOIN stops s ON s.stop_id = sa.stop_id
    LEFT JOIN area_locations al ON al.area_id = a.area_id
    LEFT JOIN area_route_types art ON art.area_id = a.area_id
    WHERE a.area_id IN (${placeholders})
      AND s.location_type = 0
    GROUP BY a.area_id, a.area_name, al.latitude, al.longitude, art.route_types
  `;

  return query<AreaSearchResult>(sql, areaIds);
}
