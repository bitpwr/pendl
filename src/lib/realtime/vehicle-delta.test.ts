import { describe, it, expect } from "vitest";
import { RouteType } from "@/types/gtfs";
import type { Vehicle } from "@/types/api";
import {
  applyDelta,
  diffVehicles,
  hasMoved,
  POSITION_EPSILON,
} from "./vehicle-delta";

const AT = "2026-09-01T10:00:00.000Z";

function vehicle(id: string, over: Partial<Vehicle> = {}): Vehicle {
  return {
    id,
    tripId: `trip-${id}`,
    routeId: "route-1",
    routeName: "42",
    routeType: RouteType.Bus,
    headsign: "Stockholm C",
    lat: 59.3,
    lon: 18.0,
    bearing: 90,
    speed: 10,
    ...over,
  };
}

const asMap = (vehicles: Vehicle[]) =>
  new Map(vehicles.map((v) => [v.id, v] as const));

describe("hasMoved", () => {
  it("ignores jitter below the thresholds", () => {
    const before = vehicle("a");
    const after = vehicle("a", {
      lat: 59.3 + POSITION_EPSILON / 10,
      bearing: 91,
      speed: 10.2,
    });

    expect(hasMoved(before, after)).toBe(false);
  });

  it("reports a real position change", () => {
    expect(hasMoved(vehicle("a"), vehicle("a", { lat: 59.31 }))).toBe(true);
    expect(hasMoved(vehicle("a"), vehicle("a", { lon: 18.01 }))).toBe(true);
  });

  it("reports a turn", () => {
    expect(hasMoved(vehicle("a"), vehicle("a", { bearing: 120 }))).toBe(true);
  });

  it("reports a speed change worth showing", () => {
    expect(hasMoved(vehicle("a"), vehicle("a", { speed: 0 }))).toBe(true);
  });

  it("treats a field appearing or disappearing as a change", () => {
    expect(hasMoved(vehicle("a"), vehicle("a", { bearing: undefined }))).toBe(
      true,
    );
  });
});

describe("diffVehicles", () => {
  it("sends a vehicle it has not seen in full", () => {
    const delta = diffVehicles(new Map(), [vehicle("a")], 1, AT);

    expect(delta.added).toHaveLength(1);
    expect(delta.added[0].headsign).toBe("Stockholm C");
    expect(delta.moved).toEqual([]);
    expect(delta.removed).toEqual([]);
  });

  it("sends a move as a compact tuple, without descriptive fields", () => {
    const before = asMap([vehicle("a")]);
    const delta = diffVehicles(
      before,
      [vehicle("a", { lat: 59.31, bearing: 100, speed: 12 })],
      2,
      AT,
    );

    expect(delta.added).toEqual([]);
    expect(delta.moved).toEqual([["a", 59.31, 18.0, 100, 12]]);
  });

  it("omits vehicles that only jittered", () => {
    const before = asMap([vehicle("a")]);
    const delta = diffVehicles(before, [vehicle("a")], 2, AT);

    expect(delta.moved).toEqual([]);
    expect(delta.added).toEqual([]);
  });

  it("reports vehicles that left the feed", () => {
    const before = asMap([vehicle("a"), vehicle("b")]);
    const delta = diffVehicles(before, [vehicle("a")], 2, AT);

    expect(delta.removed).toEqual(["b"]);
  });

  it("sends a vehicle whole when it starts a new trip", () => {
    // Route name, headsign and trip id all change together, so a move tuple
    // could not carry it.
    const before = asMap([vehicle("a")]);
    const delta = diffVehicles(
      before,
      [vehicle("a", { tripId: "trip-next", headsign: "Uppsala" })],
      2,
      AT,
    );

    expect(delta.moved).toEqual([]);
    expect(delta.added[0].headsign).toBe("Uppsala");
  });

  it("carries the sequence and timestamp", () => {
    const delta = diffVehicles(new Map(), [], 7, AT);

    expect(delta.seq).toBe(7);
    expect(delta.updatedAt).toBe(AT);
    expect(delta.type).toBe("delta");
  });

  it("encodes missing bearing and speed as null", () => {
    const before = asMap([vehicle("a")]);
    const delta = diffVehicles(
      before,
      [vehicle("a", { lat: 59.32, bearing: undefined, speed: undefined })],
      2,
      AT,
    );

    expect(delta.moved).toEqual([["a", 59.32, 18.0, null, null]]);
  });
});

describe("applyDelta", () => {
  it("round-trips a diff back to the source set", () => {
    const before = [vehicle("a"), vehicle("b"), vehicle("c")];
    const after = [
      vehicle("a", { lat: 59.35 }),
      vehicle("c"),
      vehicle("d", { headsign: "Nynäshamn" }),
    ];

    const delta = diffVehicles(asMap(before), after, 2, AT);
    const result = applyDelta(asMap(before), delta);

    expect([...result.values()].sort((x, y) => x.id.localeCompare(y.id))).toEqual(
      after.sort((x, y) => x.id.localeCompare(y.id)),
    );
  });

  it("keeps descriptive fields a move does not carry", () => {
    const before = asMap([vehicle("a")]);
    const delta = diffVehicles(before, [vehicle("a", { lat: 59.4 })], 2, AT);
    const result = applyDelta(before, delta);

    expect(result.get("a")).toMatchObject({
      lat: 59.4,
      headsign: "Stockholm C",
      routeName: "42",
      tripId: "trip-a",
    });
  });

  it("drops removed vehicles", () => {
    const before = asMap([vehicle("a"), vehicle("b")]);
    const result = applyDelta(before, diffVehicles(before, [vehicle("a")], 2, AT));

    expect(result.has("b")).toBe(false);
  });

  it("does not mutate the set it was given", () => {
    const before = asMap([vehicle("a")]);
    applyDelta(before, diffVehicles(before, [], 2, AT));

    expect(before.has("a")).toBe(true);
  });

  it("skips a move for a vehicle it never saw", () => {
    const result = applyDelta(new Map(), {
      type: "delta",
      seq: 2,
      updatedAt: AT,
      added: [],
      moved: [["ghost", 59.3, 18.0, 0, 0]],
      removed: [],
    });

    expect(result.size).toBe(0);
  });

  it("clears bearing and speed sent as null", () => {
    const before = asMap([vehicle("a")]);
    const result = applyDelta(before, {
      type: "delta",
      seq: 2,
      updatedAt: AT,
      added: [],
      moved: [["a", 59.3, 18.0, null, null]],
      removed: [],
    });

    expect(result.get("a")?.bearing).toBeUndefined();
    expect(result.get("a")?.speed).toBeUndefined();
  });
});
