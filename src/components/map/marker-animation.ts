export type Position = [lat: number, lon: number];

/**
 * How long a marker takes to slide to its new position.
 *
 * Kept comfortably under the poll interval so a marker settles before the
 * next update arrives.
 */
export const POSITION_ANIMATION_MS = 1800;

/**
 * Beyond this many degrees the jump is not a vehicle moving.
 *
 * A vehicle that reappears on another part of its route, or a marker being
 * reused for a different trip, should not glide across the map. Roughly 1km
 * of latitude.
 */
export const MAX_ANIMATED_DEGREES = 0.01;

/** Decelerating ease, so a vehicle arrives rather than stops dead. */
export function easeOutQuad(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * (2 - clamped);
}

export function interpolate(from: Position, to: Position, t: number): Position {
  const eased = easeOutQuad(t);
  return [
    from[0] + (to[0] - from[0]) * eased,
    from[1] + (to[1] - from[1]) * eased,
  ];
}

/** True when the move should be applied instantly rather than animated. */
export function shouldSnap(
  from: Position,
  to: Position,
  maxDegrees: number = MAX_ANIMATED_DEGREES,
): boolean {
  return (
    Math.abs(to[0] - from[0]) > maxDegrees ||
    Math.abs(to[1] - from[1]) > maxDegrees
  );
}

export function samePosition(a: Position, b: Position): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
