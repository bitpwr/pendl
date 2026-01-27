import { query, queryOne } from "../index";
import type { Stop } from "@/types/gtfs";

export interface StopSearchResult {
  stopId: string;
  stopName: string;
  latitude: number;
  longitude: number;
  routeTypes: number[];
  distance?: number;
}

/**
 * Search for stops by name using full-text search
 */
export async function searchStops(
  searchQuery: string,
  limit = 10,
): Promise<StopSearchResult[]> {
  // Convert search query to tsquery format
  const tsQuery = searchQuery
    .trim()
    .split(/\s+/)
    .map((word) => word + ":*")
    .join(" & ");

  const sql = `
    SELECT
      s.stop_id as "stopId",
      s.stop_name as "stopName",
      s.stop_lat as "latitude",
      s.stop_lon as "longitude",
      COALESCE(
        ARRAY_AGG(DISTINCT r.route_type) FILTER (WHERE r.route_type IS NOT NULL),
        ARRAY[]::integer[]
      ) as "routeTypes"
    FROM stops s
    LEFT JOIN stop_times st ON st.stop_id = s.stop_id
    LEFT JOIN trips t ON t.trip_id = st.trip_id
    LEFT JOIN routes r ON r.route_id = t.route_id
    WHERE s.search_vector @@ to_tsquery('swedish', $1)
      AND s.location_type = 1
    GROUP BY s.stop_id, s.stop_name, s.stop_lat, s.stop_lon
    ORDER BY ts_rank(s.search_vector, to_tsquery('swedish', $1)) DESC
    LIMIT $2
  `;

  return query<StopSearchResult>(sql, [tsQuery, limit]);
}

/**
 * Find stops near a geographic point
 */
export async function findNearbyStops(
  latitude: number,
  longitude: number,
  radiusMeters = 500,
  limit = 10,
): Promise<StopSearchResult[]> {
  const sql = `
    SELECT
      s.stop_id as "stopId",
      s.stop_name as "stopName",
      s.stop_lat as "latitude",
      s.stop_lon as "longitude",
      ST_Distance(
        s.geom::geography,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
      ) as "distance",
      COALESCE(
        ARRAY_AGG(DISTINCT r.route_type) FILTER (WHERE r.route_type IS NOT NULL),
        ARRAY[]::integer[]
      ) as "routeTypes"
    FROM stops s
    LEFT JOIN stop_times st ON st.stop_id = s.stop_id
    LEFT JOIN trips t ON t.trip_id = st.trip_id
    LEFT JOIN routes r ON r.route_id = t.route_id
    WHERE s.location_type = 1
      AND ST_DWithin(
        s.geom::geography,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
        $3
      )
    GROUP BY s.stop_id, s.stop_name, s.stop_lat, s.stop_lon, s.geom
    ORDER BY ST_Distance(
      s.geom::geography,
      ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
    )
    LIMIT $4
  `;

  return query<StopSearchResult>(sql, [
    latitude,
    longitude,
    radiusMeters,
    limit,
  ]);
}

/**
 * Get a single stop by ID
 */
export async function getStop(stopId: string): Promise<Stop | null> {
  const sql = `
    SELECT
      stop_id as "stopId",
      stop_code as "stopCode",
      stop_name as "stopName",
      stop_desc as "stopDesc",
      stop_lat as "stopLat",
      stop_lon as "stopLon",
      zone_id as "zoneId",
      stop_url as "stopUrl",
      location_type as "locationType",
      parent_station as "parentStation",
      stop_timezone as "stopTimezone",
      wheelchair_boarding as "wheelchairBoarding",
      platform_code as "platformCode"
    FROM stops
    WHERE stop_id = $1
  `;

  return queryOne<Stop>(sql, [stopId]);
}

/**
 * Get child stops (platforms) for a parent station
 */
export async function getChildStops(parentStationId: string): Promise<Stop[]> {
  const sql = `
    SELECT
      stop_id as "stopId",
      stop_code as "stopCode",
      stop_name as "stopName",
      stop_desc as "stopDesc",
      stop_lat as "stopLat",
      stop_lon as "stopLon",
      zone_id as "zoneId",
      stop_url as "stopUrl",
      location_type as "locationType",
      parent_station as "parentStation",
      stop_timezone as "stopTimezone",
      wheelchair_boarding as "wheelchairBoarding",
      platform_code as "platformCode"
    FROM stops
    WHERE parent_station = $1
    ORDER BY platform_code, stop_name
  `;

  return query<Stop>(sql, [parentStationId]);
}

/**
 * Get multiple stops by IDs (for favorites)
 */
export async function getStopsByIds(
  stopIds: string[],
): Promise<StopSearchResult[]> {
  if (stopIds.length === 0) return [];

  const placeholders = stopIds.map((_, i) => `$${i + 1}`).join(", ");
  const sql = `
    SELECT
      s.stop_id as "stopId",
      s.stop_name as "stopName",
      s.stop_lat as "latitude",
      s.stop_lon as "longitude",
      COALESCE(
        ARRAY_AGG(DISTINCT r.route_type) FILTER (WHERE r.route_type IS NOT NULL),
        ARRAY[]::integer[]
      ) as "routeTypes"
    FROM stops s
    LEFT JOIN stop_times st ON st.stop_id = s.stop_id
    LEFT JOIN trips t ON t.trip_id = st.trip_id
    LEFT JOIN routes r ON r.route_id = t.route_id
    WHERE s.stop_id IN (${placeholders})
    GROUP BY s.stop_id, s.stop_name, s.stop_lat, s.stop_lon
  `;

  return query<StopSearchResult>(sql, stopIds);
}
