import { query } from "../index";

export interface ScheduledDeparture {
  tripId: string;
  routeId: string;
  routeShortName: string;
  routeLongName: string;
  routeType: number;
  tripHeadsign: string;
  stopSequence: number;
  departureTime: string; // GTFS time format (HH:MM:SS, can exceed 24:00)
  arrivalTime: string;
  stopId: string;
  directionId: number;
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

  // Calculate the GTFS time window
  // GTFS times can exceed 24:00 for services running past midnight
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const startTime =
    options.startTime ||
    `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00`;

  const endHour = hours + hoursAhead;
  const endTime = `${endHour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00`;

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
      -- Check if service is active today via calendar
      EXISTS (
        SELECT 1 FROM calendar c
        WHERE c.service_id = t.service_id
        AND c.start_date <= CURRENT_DATE
        AND c.end_date >= CURRENT_DATE
        AND (
          (EXTRACT(DOW FROM CURRENT_DATE) = 0 AND c.sunday = true) OR
          (EXTRACT(DOW FROM CURRENT_DATE) = 1 AND c.monday = true) OR
          (EXTRACT(DOW FROM CURRENT_DATE) = 2 AND c.tuesday = true) OR
          (EXTRACT(DOW FROM CURRENT_DATE) = 3 AND c.wednesday = true) OR
          (EXTRACT(DOW FROM CURRENT_DATE) = 4 AND c.thursday = true) OR
          (EXTRACT(DOW FROM CURRENT_DATE) = 5 AND c.friday = true) OR
          (EXTRACT(DOW FROM CURRENT_DATE) = 6 AND c.saturday = true)
        )
        AND NOT EXISTS (
          SELECT 1 FROM calendar_dates cd
          WHERE cd.service_id = t.service_id
          AND cd.date = CURRENT_DATE
          AND cd.exception_type = 2
        )
      )
      OR
      -- Or check if service is added for today via calendar_dates
      EXISTS (
        SELECT 1 FROM calendar_dates cd
        WHERE cd.service_id = t.service_id
        AND cd.date = CURRENT_DATE
        AND cd.exception_type = 1
      )
    )
    ORDER BY st.departure_time
    LIMIT $4
  `;

  const params = [stopId, startTime, endTime, limit];

  return query<ScheduledDeparture>(sql, params);
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
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const startTime =
    options.startTime ||
    `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00`;

  const endHour = hours + hoursAhead;
  const endTime = `${endHour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00`;

  const stopIdPlaceholders = stopIds.map((_, i) => `$${i + 4}`).join(", ");

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
    WHERE st.stop_id IN (${stopIdPlaceholders})
    AND st.departure_time >= $1
    AND st.departure_time <= $2
    AND (
      -- Check if service is active today via calendar
      EXISTS (
        SELECT 1 FROM calendar c
        WHERE c.service_id = t.service_id
        AND c.start_date <= CURRENT_DATE
        AND c.end_date >= CURRENT_DATE
        AND (
          (EXTRACT(DOW FROM CURRENT_DATE) = 0 AND c.sunday = true) OR
          (EXTRACT(DOW FROM CURRENT_DATE) = 1 AND c.monday = true) OR
          (EXTRACT(DOW FROM CURRENT_DATE) = 2 AND c.tuesday = true) OR
          (EXTRACT(DOW FROM CURRENT_DATE) = 3 AND c.wednesday = true) OR
          (EXTRACT(DOW FROM CURRENT_DATE) = 4 AND c.thursday = true) OR
          (EXTRACT(DOW FROM CURRENT_DATE) = 5 AND c.friday = true) OR
          (EXTRACT(DOW FROM CURRENT_DATE) = 6 AND c.saturday = true)
        )
        AND NOT EXISTS (
          SELECT 1 FROM calendar_dates cd
          WHERE cd.service_id = t.service_id
          AND cd.date = CURRENT_DATE
          AND cd.exception_type = 2
        )
      )
      OR
      -- Or check if service is added for today via calendar_dates
      EXISTS (
        SELECT 1 FROM calendar_dates cd
        WHERE cd.service_id = t.service_id
        AND cd.date = CURRENT_DATE
        AND cd.exception_type = 1
      )
    )
    ORDER BY st.departure_time
    LIMIT $3
  `;

  const params = [startTime, endTime, limit, ...stopIds];

  return query<ScheduledDeparture>(sql, params);
}
