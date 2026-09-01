import { describe, it, expect } from "vitest";
import {
  MAX_ANIMATED_DEGREES,
  POSITION_ANIMATION_MS,
  easeOutQuad,
  interpolate,
  samePosition,
  shouldSnap,
  type Position,
} from "./marker-animation";

const from: Position = [59.3, 18.0];
const to: Position = [59.304, 18.004];

describe("easeOutQuad", () => {
  it("starts at 0 and ends at 1", () => {
    expect(easeOutQuad(0)).toBe(0);
    expect(easeOutQuad(1)).toBe(1);
  });

  it("decelerates, so it is past halfway at the midpoint", () => {
    expect(easeOutQuad(0.5)).toBeGreaterThan(0.5);
  });

  it("clamps input outside 0..1", () => {
    expect(easeOutQuad(-1)).toBe(0);
    expect(easeOutQuad(5)).toBe(1);
  });

  it("never goes backwards", () => {
    let previous = 0;
    for (let t = 0; t <= 1; t += 0.05) {
      const value = easeOutQuad(t);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

describe("interpolate", () => {
  it("returns the start position at t=0", () => {
    expect(interpolate(from, to, 0)).toEqual(from);
  });

  it("lands exactly on the target at t=1", () => {
    const [lat, lon] = interpolate(from, to, 1);
    expect(lat).toBeCloseTo(to[0], 10);
    expect(lon).toBeCloseTo(to[1], 10);
  });

  it("stays within the segment while animating", () => {
    const [lat, lon] = interpolate(from, to, 0.5);
    expect(lat).toBeGreaterThan(from[0]);
    expect(lat).toBeLessThan(to[0]);
    expect(lon).toBeGreaterThan(from[1]);
    expect(lon).toBeLessThan(to[1]);
  });

  it("handles movement south and west", () => {
    const back: Position = [59.29, 17.99];
    const [lat, lon] = interpolate(from, back, 1);
    expect(lat).toBeCloseTo(back[0], 10);
    expect(lon).toBeCloseTo(back[1], 10);
  });

  it("does not overshoot when progress exceeds 1", () => {
    const [lat] = interpolate(from, to, 2);
    expect(lat).toBeCloseTo(to[0], 10);
  });
});

describe("shouldSnap", () => {
  it("animates an ordinary move between updates", () => {
    expect(shouldSnap(from, to)).toBe(false);
  });

  it("snaps a jump larger than the threshold", () => {
    // A vehicle reappearing elsewhere on its route should not glide there.
    expect(shouldSnap(from, [59.5, 18.0])).toBe(true);
    expect(shouldSnap(from, [59.3, 18.5])).toBe(true);
  });

  it("snaps regardless of direction", () => {
    expect(shouldSnap(from, [59.0, 18.0])).toBe(true);
    expect(shouldSnap(from, [59.3, 17.5])).toBe(true);
  });

  it("respects a custom threshold", () => {
    expect(shouldSnap(from, to, 0.0001)).toBe(true);
    expect(shouldSnap(from, to, 10)).toBe(false);
  });

  it("uses a threshold around a kilometre of latitude", () => {
    expect(MAX_ANIMATED_DEGREES).toBeGreaterThan(0);
    expect(MAX_ANIMATED_DEGREES).toBeLessThan(0.05);
  });
});

describe("samePosition", () => {
  it("detects an unchanged position", () => {
    expect(samePosition(from, [...from] as Position)).toBe(true);
  });

  it("detects a change in either axis", () => {
    expect(samePosition(from, [59.3, 18.001])).toBe(false);
    expect(samePosition(from, [59.301, 18.0])).toBe(false);
  });
});

describe("animation timing", () => {
  it("settles before the next poll arrives", () => {
    // The poll interval is 2000ms; a marker must stop moving before then or
    // updates would queue up behind each other.
    expect(POSITION_ANIMATION_MS).toBeLessThan(2000);
  });
});
