import { query } from "../index";
import { RouteType, toRouteType } from "@/types/gtfs";

export interface ScheduledDeparture {
  tripId: string;
  routeId: string;
  routeShortName: string;
  routeLongName: string;
  routeType: RouteType;
  tripHeadsign: string;
  stopSequence: number;
  departureTime: string; // GTFS time format (HH:MM:SS, can exceed 24:00)
  arrivalTime: string;
  stopId: string;
  directionId: number;
}

interface TimeWindow {
  startTime: string;
  endTime: string;
  serviceDate: Date; // Which service date to check (today or yesterday)
}

/**
 * Calculate the GTFS time window(s) to search for departures.
 *
 * GTFS times can exceed 24:00 for services running past midnight.
 * When current time is between 00:00-03:00, we need to search both:
 * 1. Today's services (00:00-03:00)
 * 2. Yesterday's services (24:00-27:00)
 */
function calculateGtfsTimeWindow(date: Date, hoursAhead: number): TimeWindow[] {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const currentTime = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00`;

  const endHour = hours + hoursAhead;
  const endTime = `${endHour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00`;

  const windows: TimeWindow[] = [];

  // Add current day window
  windows.push({
    startTime: currentTime,
    endTime: endTime,
    serviceDate: new Date(date),
  });

  // If we're between 00:00 and 03:00, also check yesterday's late services
  // (times 24:00-27:00 from yesterday's service day)
  if (hours < 3) {
    const yesterdayHours = hours + 24;
    const yesterdayStart = `${yesterdayHours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00`;
    const yesterdayEnd = `${(yesterdayHours + hoursAhead).toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00`;

    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);

    windows.push({
      startTime: yesterdayStart,
      endTime: yesterdayEnd,
      serviceDate: yesterday,
    });
  }

  return windows;
}

/**
 * Get upcoming scheduled departures for a stop
 * This gets the static schedule - realtime updates are overlaid separately
 */
export async function getScheduledDepartures(
  stopId: string,
  options: {
    date?: Date;
    startTime?: string;
    limit?: number;
    hoursAhead?: number;
  } = {},
): Promise<ScheduledDeparture[]> {
  const { date = new Date(), limit = 50, hoursAhead = 2 } = options;

  // Calculate time windows (handles times after midnight)
  const windows = calculateGtfsTimeWindow(date, hoursAhead);

  const sql = `
    SELECT
      t.trip_id as "tripId",
      r.route_id as "routeId",
      r.route_short_name as "routeShortName",
      r.route_long_name as "routeLongName",
      r.route_type as "routeType",
      COALESCE(st.stop_headsign, t.trip_headsign, r.route_long_name) as "tripHeadsign",
      st.stop_sequence as "stopSequence",
      st.departure_time::text as "departureTime",
      st.arrival_time::text as "arrivalTime",
      st.stop_id as "stopId",
      t.direction_id as "directionId"
    FROM stop_times st
    JOIN trips t ON t.trip_id = st.trip_id
    JOIN routes r ON r.route_id = t.route_id
    WHERE (st.stop_id = $1 OR st.stop_id IN (
      SELECT stop_id FROM stops WHERE parent_station = $1
    ))
    AND st.departure_time >= $2
    AND st.departure_time <= $3
    AND (
      -- Check if service is active for the specified date via calendar
      EXISTS (
        SELECT 1 FROM calendar c
        WHERE c.service_id = t.service_id
        AND c.start_date <= $4::date
        AND c.end_date >= $4::date
        AND (
          (EXTRACT(DOW FROM $4::date) = 0 AND c.sunday = true) OR
          (EXTRACT(DOW FROM $4::date) = 1 AND c.monday = true) OR
          (EXTRACT(DOW FROM $4::date) = 2 AND c.tuesday = true) OR
          (EXTRACT(DOW FROM $4::date) = 3 AND c.wednesday = true) OR
          (EXTRACT(DOW FROM $4::date) = 4 AND c.thursday = true) OR
          (EXTRACT(DOW FROM $4::date) = 5 AND c.friday = true) OR
          (EXTRACT(DOW FROM $4::date) = 6 AND c.saturday = true)
        )
        AND NOT EXISTS (
          SELECT 1 FROM calendar_dates cd
          WHERE cd.service_id = t.service_id
          AND cd.date = $4::date
          AND cd.exception_type = 2
        )
      )
      OR
      -- Or check if service is added for the specified date via calendar_dates
      EXISTS (
        SELECT 1 FROM calendar_dates cd
        WHERE cd.service_id = t.service_id
        AND cd.date = $4::date
        AND cd.exception_type = 1
      )
    )
    ORDER BY st.departure_time
    LIMIT $5
  `;

  // Query all time windows and combine results
  const allResults: (ScheduledDeparture & { routeTypeRaw: number })[] = [];

  for (const window of windows) {
    const serviceDate = window.serviceDate.toISOString().split("T")[0];
    const params = [
      stopId,
      window.startTime,
      window.endTime,
      serviceDate,
      limit,
    ];

    const rows = await query<ScheduledDeparture & { routeTypeRaw: number }>(
      sql,
      params,
    );

    allResults.push(...rows);
  }

  // Deduplicate by tripId + departureTime, and limit results
  const seen = new Set<string>();
  const uniqueResults = allResults.filter((row) => {
    const key = `${row.tripId}-${row.departureTime}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by departure time and limit
  uniqueResults.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
  const limitedResults = uniqueResults.slice(0, limit);

  return limitedResults.map((row) => ({
    tripId: row.tripId,
    routeId: row.routeId,
    routeShortName: row.routeShortName,
    routeLongName: row.routeLongName,
    routeType: toRouteType(row.routeTypeRaw),
    tripHeadsign: row.tripHeadsign,
    stopSequence: row.stopSequence,
    departureTime: row.departureTime,
    arrivalTime: row.arrivalTime,
    stopId: row.stopId,
    directionId: row.directionId,
  }));
}

/**
 * Get departures for multiple stops at once (useful for parent stations)
 */
export async function getScheduledDeparturesForStops(
  stopIds: string[],
  options: {
    startTime?: string;
    limit?: number;
    hoursAhead?: number;
  } = {},
): Promise<ScheduledDeparture[]> {
  if (stopIds.length === 0) return [];

  const { limit = 50, hoursAhead = 2 } = options;

  const now = new Date();

  // Calculate time windows (handles times after midnight)
  const windows = calculateGtfsTimeWindow(now, hoursAhead);

  const stopIdPlaceholders = stopIds.map((_, i) => `$${i + 5}`).join(", ");

  const sql = `
    SELECT
      t.trip_id as "tripId",
      r.route_id as "routeId",
      r.route_short_name as "routeShortName",
      r.route_long_name as "routeLongName",
      r.route_type as "routeTypeRaw",
      COALESCE(st.stop_headsign, t.trip_headsign, r.route_long_name) as "tripHeadsign",
      st.stop_sequence as "stopSequence",
      st.departure_time::text as "departureTime",
      st.arrival_time::text as "arrivalTime",
      st.stop_id as "stopId",
      t.direction_id as "directionId"
    FROM stop_times st
    JOIN trips t ON t.trip_id = st.trip_id
    JOIN routes r ON r.route_id = t.route_id
    WHERE st.stop_id IN (${stopIdPlaceholders})
    AND st.departure_time >= $1
    AND st.departure_time <= $2
    AND (
      -- Check if service is active for the specified date via calendar
      EXISTS (
        SELECT 1 FROM calendar c
        WHERE c.service_id = t.service_id
        AND c.start_date <= $3::date
        AND c.end_date >= $3::date
        AND (
          (EXTRACT(DOW FROM $3::date) = 0 AND c.sunday = true) OR
          (EXTRACT(DOW FROM $3::date) = 1 AND c.monday = true) OR
          (EXTRACT(DOW FROM $3::date) = 2 AND c.tuesday = true) OR
          (EXTRACT(DOW FROM $3::date) = 3 AND c.wednesday = true) OR
          (EXTRACT(DOW FROM $3::date) = 4 AND c.thursday = true) OR
          (EXTRACT(DOW FROM $3::date) = 5 AND c.friday = true) OR
          (EXTRACT(DOW FROM $3::date) = 6 AND c.saturday = true)
        )
        AND NOT EXISTS (
          SELECT 1 FROM calendar_dates cd
          WHERE cd.service_id = t.service_id
          AND cd.date = $3::date
          AND cd.exception_type = 2
        )
      )
      OR
      -- Or check if service is added for the specified date via calendar_dates
      EXISTS (
        SELECT 1 FROM calendar_dates cd
        WHERE cd.service_id = t.service_id
        AND cd.date = $3::date
        AND cd.exception_type = 1
      )
    )
    ORDER BY st.departure_time
    LIMIT $4
  `;

  // Query all time windows and combine results
  const allResults: (ScheduledDeparture & { routeTypeRaw: number })[] = [];

  for (const window of windows) {
    const serviceDate = window.serviceDate.toISOString().split("T")[0];
    const params = [
      window.startTime,
      window.endTime,
      serviceDate,
      limit,
      ...stopIds,
    ];

    const rows = await query<ScheduledDeparture & { routeTypeRaw: number }>(
      sql,
      params,
    );

    allResults.push(...rows);
  }

  // Deduplicate by tripId + stopId + departureTime, and limit results
  const seen = new Set<string>();
  const uniqueResults = allResults.filter((row) => {
    const key = `${row.tripId}-${row.stopId}-${row.departureTime}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by departure time and limit
  uniqueResults.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
  const limitedResults = uniqueResults.slice(0, limit);

  return limitedResults.map((row) => ({
    tripId: row.tripId,
    routeId: row.routeId,
    routeShortName: row.routeShortName,
    routeLongName: row.routeLongName,
    routeType: toRouteType(row.routeTypeRaw),
    tripHeadsign: row.tripHeadsign,
    stopSequence: row.stopSequence,
    departureTime: row.departureTime,
    arrivalTime: row.arrivalTime,
    stopId: row.stopId,
    directionId: row.directionId,
  }));
}
