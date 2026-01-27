import type { Calendar, CalendarDate } from "@/types/gtfs";

/**
 * Get the day of week name for a given date
 */
function getDayOfWeek(
  date: Date,
):
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday" {
  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ] as const;
  return days[date.getDay()];
}

/**
 * Check if a date falls within a calendar's date range
 */
function isWithinDateRange(
  date: Date,
  startDate: Date,
  endDate: Date,
): boolean {
  const d = date.getTime();
  return d >= startDate.getTime() && d <= endDate.getTime();
}

/**
 * Get all active service IDs for a given date
 *
 * This considers:
 * 1. Regular calendar entries (day of week + date range)
 * 2. Calendar date exceptions (additions and removals)
 */
export function getActiveServiceIds(
  date: Date,
  calendars: Calendar[],
  calendarDates: CalendarDate[],
): string[] {
  const dateStr = date.toISOString().split("T")[0];
  const dayOfWeek = getDayOfWeek(date);

  // Get regular services running on this day of week
  const regularServices = calendars
    .filter(
      (c) => c[dayOfWeek] && isWithinDateRange(date, c.startDate, c.endDate),
    )
    .map((c) => c.serviceId);

  // Find exceptions for this date
  const exceptionsForDate = calendarDates.filter(
    (cd) => cd.date.toISOString().split("T")[0] === dateStr,
  );

  // Services added by exception (exception_type = 1)
  const addedServices = exceptionsForDate
    .filter((cd) => cd.exceptionType === 1)
    .map((cd) => cd.serviceId);

  // Services removed by exception (exception_type = 2)
  const removedServices = new Set(
    exceptionsForDate
      .filter((cd) => cd.exceptionType === 2)
      .map((cd) => cd.serviceId),
  );

  // Combine and deduplicate
  const allServices = new Set([...regularServices, ...addedServices]);

  // Remove exceptions
  for (const serviceId of removedServices) {
    allServices.delete(serviceId);
  }

  return Array.from(allServices);
}

/**
 * Check if a specific service is active on a given date
 */
export function isServiceActive(
  serviceId: string,
  date: Date,
  calendars: Calendar[],
  calendarDates: CalendarDate[],
): boolean {
  const activeIds = getActiveServiceIds(date, calendars, calendarDates);
  return activeIds.includes(serviceId);
}
