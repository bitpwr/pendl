import { describe, it, expect } from "vitest";
import {
  parseGtfsTime,
  gtfsTimeToDate,
  gtfsTimeToActualDate,
  formatTime,
  formatTimeRemaining,
  secondsUntil,
  getCurrentGtfsSeconds,
  gtfsTimeToSeconds,
} from "./time-utils";

describe("parseGtfsTime", () => {
  it("should parse a normal time", () => {
    const result = parseGtfsTime("14:30:00");
    expect(result.hours).toBe(14);
    expect(result.minutes).toBe(30);
    expect(result.seconds).toBe(0);
    expect(result.isNextDay).toBe(false);
    expect(result.totalSeconds).toBe(14 * 3600 + 30 * 60);
  });

  it("should parse midnight", () => {
    const result = parseGtfsTime("00:00:00");
    expect(result.hours).toBe(0);
    expect(result.isNextDay).toBe(false);
  });

  it("should parse times after midnight (next day)", () => {
    const result = parseGtfsTime("25:30:00");
    expect(result.hours).toBe(1); // Normalized to 01:30
    expect(result.minutes).toBe(30);
    expect(result.isNextDay).toBe(true);
    expect(result.totalSeconds).toBe(25 * 3600 + 30 * 60);
  });

  it("should parse 24:00:00 as next day midnight", () => {
    const result = parseGtfsTime("24:00:00");
    expect(result.hours).toBe(0);
    expect(result.isNextDay).toBe(true);
  });

  it("should throw on invalid format", () => {
    expect(() => parseGtfsTime("14:30")).toThrow();
    expect(() => parseGtfsTime("invalid")).toThrow();
  });
});

describe("gtfsTimeToDate", () => {
  it("should convert normal time to date", () => {
    const serviceDate = new Date("2026-01-27T00:00:00");
    const result = gtfsTimeToDate("14:30:00", serviceDate);

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0); // January
    expect(result.getDate()).toBe(27);
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(30);
  });

  it("should handle next-day times", () => {
    const serviceDate = new Date("2026-01-27T00:00:00");
    const result = gtfsTimeToDate("25:30:00", serviceDate);

    expect(result.getDate()).toBe(28); // Next day
    expect(result.getHours()).toBe(1);
    expect(result.getMinutes()).toBe(30);
  });
});

describe("formatTime", () => {
  it("should format time in 24-hour format", () => {
    const date = new Date("2026-01-27T14:05:00");
    expect(formatTime(date)).toBe("14:05");
  });

  it("should pad single digits", () => {
    const date = new Date("2026-01-27T09:05:00");
    expect(formatTime(date)).toBe("09:05");
  });

  it("should include seconds when requested", () => {
    const date = new Date("2026-01-27T09:05:07");
    expect(formatTime(date, true)).toBe("09:05:07");
  });
});

describe("formatTimeRemaining", () => {
  it('should return "Nu" for 20 seconds or less', () => {
    expect(formatTimeRemaining(20)).toBe("Nu");
    expect(formatTimeRemaining(-5)).toBe("Nu");
  });

  it("should format short intervals", () => {
    expect(formatTimeRemaining(30)).toBe("30 s");
    expect(formatTimeRemaining(60)).toBe("1 min");
    expect(formatTimeRemaining(100)).toBe("1.5 min");
  });

  it("should format longer intervals", () => {
    expect(formatTimeRemaining(5 * 60)).toBe("5 min");
    expect(formatTimeRemaining(75 * 60)).toBe("1 h 15 min");
    expect(formatTimeRemaining(2 * 3600)).toBe("2 h");
  });
});

describe("secondsUntil", () => {
  it("should calculate seconds between two times", () => {
    const now = new Date("2026-01-27T14:00:00");
    const target = new Date("2026-01-27T14:30:00");
    expect(secondsUntil(target, now)).toBe(30 * 60);
  });

  it("should return negative for past times", () => {
    const now = new Date("2026-01-27T14:30:00");
    const target = new Date("2026-01-27T14:00:00");
    expect(secondsUntil(target, now)).toBe(-30 * 60);
  });
});

describe("getCurrentGtfsSeconds", () => {
  it("should return seconds since midnight", () => {
    const now = new Date("2026-01-27T14:30:15");
    expect(getCurrentGtfsSeconds(now)).toBe(14 * 3600 + 30 * 60 + 15);
  });
});

describe("gtfsTimeToSeconds", () => {
  it("should convert time to seconds since midnight", () => {
    expect(gtfsTimeToSeconds("01:00:00")).toBe(3600);
    expect(gtfsTimeToSeconds("14:30:15")).toBe(14 * 3600 + 30 * 60 + 15);
    expect(gtfsTimeToSeconds("25:00:00")).toBe(25 * 3600);
  });
});

describe("gtfsTimeToActualDate", () => {
  it("should use current date for normal daytime hours", () => {
    const referenceDate = new Date("2026-01-27T14:00:00");
    const result = gtfsTimeToActualDate("15:30:00", referenceDate);

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0); // January
    expect(result.getDate()).toBe(27);
    expect(result.getHours()).toBe(15);
    expect(result.getMinutes()).toBe(30);
  });

  it("should use current date for early morning times (00:00-03:00) when GTFS time < 24:00", () => {
    const referenceDate = new Date("2026-01-27T01:30:00"); // 01:30
    const result = gtfsTimeToActualDate("02:00:00", referenceDate);

    expect(result.getDate()).toBe(27); // Same day
    expect(result.getHours()).toBe(2);
  });

  it("should use previous day for early morning times when GTFS time >= 24:00", () => {
    const referenceDate = new Date("2026-01-27T01:30:00"); // 01:30
    const result = gtfsTimeToActualDate("25:30:00", referenceDate); // 01:30 from yesterday's service

    expect(result.getDate()).toBe(27); // Maps to 01:30 on 27th (yesterday's 25:30)
    expect(result.getHours()).toBe(1);
    expect(result.getMinutes()).toBe(30);
  });

  it("should handle 24:00:00 correctly when current time is after midnight", () => {
    const referenceDate = new Date("2026-01-27T00:30:00"); // 00:30
    const result = gtfsTimeToActualDate("24:00:00", referenceDate); // Midnight from yesterday's service

    expect(result.getDate()).toBe(27); // Maps to midnight on 27th
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it("should not use previous day logic after 03:00", () => {
    const referenceDate = new Date("2026-01-27T04:00:00"); // 04:00
    const result = gtfsTimeToActualDate("25:30:00", referenceDate);

    expect(result.getDate()).toBe(28); // Maps to next day (today's 25:30 = tomorrow 01:30)
    expect(result.getHours()).toBe(1);
  });
});
