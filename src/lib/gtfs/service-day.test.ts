import { describe, it, expect } from "vitest";
import { getActiveServiceIds, isServiceActive } from "./service-day";
import type { Calendar, CalendarDate } from "@/types/gtfs";

describe("getActiveServiceIds", () => {
  const baseCalendar: Calendar = {
    serviceId: "weekday",
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
  };

  const weekendCalendar: Calendar = {
    serviceId: "weekend",
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false,
    saturday: true,
    sunday: true,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
  };

  it("should return weekday service on a Tuesday", () => {
    // January 27, 2026 is a Tuesday
    const date = new Date("2026-01-27");
    const result = getActiveServiceIds(
      date,
      [baseCalendar, weekendCalendar],
      [],
    );

    expect(result).toContain("weekday");
    expect(result).not.toContain("weekend");
  });

  it("should return weekend service on a Saturday", () => {
    // January 31, 2026 is a Saturday
    const date = new Date("2026-01-31");
    const result = getActiveServiceIds(
      date,
      [baseCalendar, weekendCalendar],
      [],
    );

    expect(result).toContain("weekend");
    expect(result).not.toContain("weekday");
  });

  it("should handle exception additions", () => {
    const date = new Date("2026-01-31"); // Saturday
    const calendarDates: CalendarDate[] = [
      {
        serviceId: "weekday",
        date: new Date("2026-01-31"),
        exceptionType: 1, // Add weekday service on Saturday
      },
    ];

    const result = getActiveServiceIds(
      date,
      [baseCalendar, weekendCalendar],
      calendarDates,
    );

    expect(result).toContain("weekday");
    expect(result).toContain("weekend");
  });

  it("should handle exception removals", () => {
    const date = new Date("2026-01-27"); // Tuesday
    const calendarDates: CalendarDate[] = [
      {
        serviceId: "weekday",
        date: new Date("2026-01-27"),
        exceptionType: 2, // Remove weekday service (holiday)
      },
    ];

    const result = getActiveServiceIds(
      date,
      [baseCalendar, weekendCalendar],
      calendarDates,
    );

    expect(result).not.toContain("weekday");
    expect(result).not.toContain("weekend");
  });

  it("should not include services outside date range", () => {
    const expiredCalendar: Calendar = {
      ...baseCalendar,
      serviceId: "expired",
      endDate: new Date("2025-12-31"),
    };

    const date = new Date("2026-01-27");
    const result = getActiveServiceIds(
      date,
      [baseCalendar, expiredCalendar],
      [],
    );

    expect(result).toContain("weekday");
    expect(result).not.toContain("expired");
  });
});

describe("isServiceActive", () => {
  const calendar: Calendar = {
    serviceId: "test-service",
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
  };

  it("should return true for active service", () => {
    const date = new Date("2026-01-27"); // Tuesday
    expect(isServiceActive("test-service", date, [calendar], [])).toBe(true);
  });

  it("should return false for inactive service", () => {
    const date = new Date("2026-01-31"); // Saturday
    expect(isServiceActive("test-service", date, [calendar], [])).toBe(false);
  });

  it("should return false for non-existent service", () => {
    const date = new Date("2026-01-27");
    expect(isServiceActive("non-existent", date, [calendar], [])).toBe(false);
  });
});
