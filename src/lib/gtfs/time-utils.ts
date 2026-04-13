/**
 * GTFS Time Utilities
 *
 * GTFS times can exceed 24:00:00 for trips running past midnight.
 * These utilities handle parsing and converting GTFS times.
 */

export interface ParsedGtfsTime {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isNextDay: boolean;
}

export interface StopDepartureTime {
  departureTime: string;
  realtimeDeparture?: string;
  delaySeconds?: number;
}

/**
 * Parse a GTFS time string (HH:MM:SS) which can exceed 24:00:00
 */
export function parseGtfsTime(timeStr: string): ParsedGtfsTime {
  const parts = timeStr.split(":");
  if (parts.length !== 3) {
    throw new Error(`Invalid GTFS time format: ${timeStr}`);
  }

  const [h, m, s] = parts.map(Number);

  if (isNaN(h) || isNaN(m) || isNaN(s)) {
    throw new Error(`Invalid GTFS time values: ${timeStr}`);
  }

  const isNextDay = h >= 24;
  const normalizedHours = h % 24;
  const totalSeconds = h * 3600 + m * 60 + s;

  return {
    hours: normalizedHours,
    minutes: m,
    seconds: s,
    totalSeconds,
    isNextDay,
  };
}

// Helper to format GTFS time (HH:MM:SS) to display (HH:MM)
export function formatGtfsTime(gtfsTime: string): string {
  const parsed = parseGtfsTime(gtfsTime);
  const h = parsed.hours.toString().padStart(2, "0");
  const m = parsed.minutes.toString().padStart(2, "0");
  return `${h}:${m}`;
}

// Get actual departure time considering realtime updates
export function formatDepartureTime(stop: StopDepartureTime): string {
  if (stop.delaySeconds && stop.delaySeconds !== 0) {
    // Add delay to scheduled time
    const parsed = parseGtfsTime(stop.departureTime);
    const delayedSeconds = parsed.totalSeconds + stop.delaySeconds;
    const h = Math.floor(delayedSeconds / 3600) % 24;
    const m = Math.floor((delayedSeconds % 3600) / 60);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  }

  // Fall back to scheduled time
  return formatGtfsTime(stop.departureTime);
}

/**
 * Convert a GTFS time to a Date object for a given service date
 */
export function gtfsTimeToDate(timeStr: string, serviceDate: Date): Date {
  const parsed = parseGtfsTime(timeStr);

  const result = new Date(serviceDate);
  result.setHours(parsed.hours, parsed.minutes, parsed.seconds, 0);

  if (parsed.isNextDay) {
    result.setDate(result.getDate() + 1);
  }

  return result;
}

/**
 * Format a Date as HH:mm (24-hour format)
 */
export function formatTime(
  date: Date,
  includeSeconds: boolean = false,
): string {
  return date.toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
    second: includeSeconds ? "2-digit" : undefined,
    hour12: false,
  });
}

/**
 * Format seconds until departure
 */
export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 20) {
    return "Nu";
  }
  if (seconds < 45) {
    return "30 s";
  }
  if (seconds < 75) {
    return "1 min";
  }
  if (seconds < 105) {
    return "1,5 min";
  }
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)} min`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return mins > 0 ? `${hours} h ${mins} min` : `${hours} h`;
}

export function formatDelay(seconds: number): string {
  if (seconds < -45) {
    return `${Math.round(seconds / 60)} min`;
  }
  if (seconds < -20) {
    return "-30 s";
  }
  if (seconds < 20) {
    return "";
  }
  if (seconds < 45) {
    return "+30 s";
  }
  if (seconds < 75) {
    return "+1 min";
  }
  if (seconds < 105) {
    return "+1,5 min";
  }
  return `+${Math.round(seconds / 60)} min`;
}

/**
 * Calculate seconds until a given time from now
 */
export function secondsUntil(targetTime: Date, now: Date = new Date()): number {
  const diffMs = targetTime.getTime() - now.getTime();
  return Math.round(diffMs / 1000);
}

/**
 * Get current time as GTFS-compatible seconds since midnight
 * Accounts for times after midnight (can return > 86400)
 */
export function getCurrentGtfsSeconds(now: Date = new Date()): number {
  return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
}

/**
 * Convert a GTFS time to a Date object, automatically determining the correct service date.
 *
 * When the current time is between 00:00 and 03:00, and the GTFS time is >= 24:00,
 * the time belongs to yesterday's service day.
 *
 * @param gtfsTimeStr - GTFS time string (e.g., "14:30:00" or "25:30:00")
 * @param referenceDate - The reference date (defaults to now)
 * @returns The actual Date object for this departure
 */
export function gtfsTimeToActualDate(
  gtfsTimeStr: string,
  referenceDate: Date = new Date(),
): Date {
  const parsed = parseGtfsTime(gtfsTimeStr);
  const currentHour = referenceDate.getHours();

  // Determine the service date
  const serviceDate = new Date(referenceDate);

  // If we're in early morning (00:00-03:00) and the GTFS time is >= 24:00,
  // this trip belongs to yesterday's service
  if (currentHour < 3 && parsed.totalSeconds >= 24 * 3600) {
    serviceDate.setDate(serviceDate.getDate() - 1);
  }

  return gtfsTimeToDate(gtfsTimeStr, serviceDate);
}

/**
 * Convert GTFS time string to seconds since midnight
 */
export function gtfsTimeToSeconds(timeStr: string): number {
  return parseGtfsTime(timeStr).totalSeconds;
}
