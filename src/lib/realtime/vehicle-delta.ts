import type { Vehicle } from "@/types/api";

/**
 * A vehicle that only moved. Everything else about it - trip, route, name,
 * headsign - is fixed for as long as it is on that trip, so it is sent once
 * in `added` and never repeated.
 */
export type MovedVehicle = [
  id: string,
  lat: number,
  lon: number,
  bearing: number | null,
  speed: number | null,
];

export interface VehicleSnapshotMessage {
  type: "snapshot";
  seq: number;
  updatedAt: string;
  vehicles: Vehicle[];
}

export interface VehicleDeltaMessage {
  type: "delta";
  seq: number;
  updatedAt: string;
  added: Vehicle[];
  moved: MovedVehicle[];
  removed: string[];
}

export type VehicleMessage = VehicleSnapshotMessage | VehicleDeltaMessage;

/**
 * Movement below these thresholds is not reported.
 *
 * A stationary vehicle's GPS still wobbles, and without a floor every parked
 * bus would appear in every delta - a full snapshot wearing a delta's
 * clothes. Roughly a metre of position, a couple of degrees of heading.
 */
export const POSITION_EPSILON = 1e-5;
export const BEARING_EPSILON = 2;
export const SPEED_EPSILON = 0.5;

function changed(
  a: number | undefined,
  b: number | undefined,
  epsilon: number,
) {
  if (a === undefined || b === undefined) return a !== b;
  return Math.abs(a - b) >= epsilon;
}

export function hasMoved(before: Vehicle, after: Vehicle): boolean {
  return (
    changed(before.lat, after.lat, POSITION_EPSILON) ||
    changed(before.lon, after.lon, POSITION_EPSILON) ||
    changed(before.bearing, after.bearing, BEARING_EPSILON) ||
    changed(before.speed, after.speed, SPEED_EPSILON)
  );
}

/** Build the change between the last published set and the current one. */
export function diffVehicles(
  previous: ReadonlyMap<string, Vehicle>,
  next: readonly Vehicle[],
  seq: number,
  updatedAt: string,
): VehicleDeltaMessage {
  const added: Vehicle[] = [];
  const moved: MovedVehicle[] = [];
  const present = new Set<string>();

  for (const vehicle of next) {
    present.add(vehicle.id);
    const before = previous.get(vehicle.id);

    // A vehicle starting a new trip carries all new descriptive fields, so it
    // is sent whole rather than as a move.
    if (!before || before.tripId !== vehicle.tripId) {
      added.push(vehicle);
      continue;
    }

    if (hasMoved(before, vehicle)) {
      moved.push([
        vehicle.id,
        vehicle.lat,
        vehicle.lon,
        vehicle.bearing ?? null,
        vehicle.speed ?? null,
      ]);
    }
  }

  const removed: string[] = [];
  for (const id of previous.keys()) {
    if (!present.has(id)) removed.push(id);
  }

  return { type: "delta", seq, updatedAt, added, moved, removed };
}

/** Apply a delta to the set a client is holding. */
export function applyDelta(
  current: ReadonlyMap<string, Vehicle>,
  delta: VehicleDeltaMessage,
): Map<string, Vehicle> {
  const next = new Map(current);

  for (const id of delta.removed) {
    next.delete(id);
  }

  for (const vehicle of delta.added) {
    next.set(vehicle.id, vehicle);
  }

  for (const [id, lat, lon, bearing, speed] of delta.moved) {
    const existing = next.get(id);
    // A move for a vehicle we never saw added means the stream is out of
    // step; the sequence check handles recovery, so skip it here.
    if (!existing) continue;

    next.set(id, {
      ...existing,
      lat,
      lon,
      bearing: bearing ?? undefined,
      speed: speed ?? undefined,
    });
  }

  return next;
}
