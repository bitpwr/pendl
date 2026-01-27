import { describe, it, expect } from "vitest";
import {
  parseGtfsTime,
  gtfsTimeToDate,
  formatTime,
  formatMinutesUntil,
  minutesUntil,
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
});

describe("formatMinutesUntil", () => {
  it('should return "Nu" for 0 or negative minutes', () => {
    expect(formatMinutesUntil(0)).toBe("Nu");
    expect(formatMinutesUntil(-5)).toBe("Nu");
  });

  it("should format minutes under an hour", () => {
    expect(formatMinutesUntil(5)).toBe("5 min");
    expect(formatMinutesUntil(45)).toBe("45 min");
  });

  it("should format hours and minutes", () => {
    expect(formatMinutesUntil(75)).toBe("1 h 15 min");
    expect(formatMinutesUntil(120)).toBe("2 h");
  });
});

describe("minutesUntil", () => {
  it("should calculate minutes between two times", () => {
    const now = new Date("2026-01-27T14:00:00");
    const target = new Date("2026-01-27T14:30:00");
    expect(minutesUntil(target, now)).toBe(30);
  });

  it("should return negative for past times", () => {
    const now = new Date("2026-01-27T14:30:00");
    const target = new Date("2026-01-27T14:00:00");
    expect(minutesUntil(target, now)).toBe(-30);
  });
});

describe("gtfsTimeToSeconds", () => {
  it("should convert time to seconds since midnight", () => {
    expect(gtfsTimeToSeconds("01:00:00")).toBe(3600);
    expect(gtfsTimeToSeconds("14:30:15")).toBe(14 * 3600 + 30 * 60 + 15);
    expect(gtfsTimeToSeconds("25:00:00")).toBe(25 * 3600);
  });
});
