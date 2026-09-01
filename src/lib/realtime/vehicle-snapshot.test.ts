import { describe, it, expect, vi, beforeEach } from "vitest";
import type { VehiclePosition } from "@/types/realtime";
import { RouteType } from "@/types/gtfs";

vi.mock("@/lib/db", () => ({ query: vi.fn() }));

import { query } from "@/lib/db";
import { buildVehicleList } from "./vehicle-snapshot";

const queryMock = vi.mocked(query);

// The trip -> route cache is module state, so every test uses its own trip ids
// rather than reaching in to clear it.
let tripCounter = 0;
const freshTrip = () => `trip-${tripCounter++}`;

function position(tripId: string, over: Partial<VehiclePosition> = {}) {
  return {
    vehicleId: `veh-${tripId}`,
    tripId,
    routeId: "route-from-feed",
    latitude: 59.33,
    longitude: 18.07,
    bearing: 90,
    speed: 12,
    currentStatus: "IN_TRANSIT_TO",
    timestamp: 1_700_000_000,
    ...over,
  } satisfies VehiclePosition;
}

function routeRow(tripId: string, over: Record<string, unknown> = {}) {
  return {
    trip_id: tripId,
    route_id: "route-9011",
    route_short_name: "42",
    route_long_name: "Stockholm C",
    route_type: 3,
    ...over,
  };
}

async function build(positions: VehiclePosition[]) {
  return { vehicles: await buildVehicleList("sl", positions) };
}

beforeEach(() => {
  queryMock.mockReset();
});

describe("buildVehicleList", () => {
  it("joins route metadata onto each position", async () => {
    const trip = freshTrip();
    queryMock.mockResolvedValueOnce([routeRow(trip)]);

    const { vehicles } = await build([position(trip)]);

    expect(vehicles).toHaveLength(1);
    expect(vehicles[0]).toMatchObject({
      id: `veh-${trip}`,
      tripId: trip,
      routeId: "route-9011",
      routeName: "42",
      routeType: RouteType.Bus,
      headsign: "Stockholm C",
      lat: 59.33,
      lon: 18.07,
      bearing: 90,
      speed: 12,
    });
  });

  it("drops vehicles whose trip has no route", async () => {
    const known = freshTrip();
    const unknown = freshTrip();
    queryMock.mockResolvedValueOnce([routeRow(known)]);

    const { vehicles } = await build([position(known), position(unknown)]);

    expect(vehicles.map((v) => v.tripId)).toEqual([known]);
  });

  it("falls back to the route id when there is no short name", async () => {
    const trip = freshTrip();
    queryMock.mockResolvedValueOnce([
      routeRow(trip, { route_short_name: null, route_long_name: null }),
    ]);

    const { vehicles } = await build([position(trip)]);

    expect(vehicles[0].routeName).toBe("route-9011");
    expect(vehicles[0].headsign).toBe("");
  });

  it("falls back to the short name for the headsign", async () => {
    const trip = freshTrip();
    queryMock.mockResolvedValueOnce([
      routeRow(trip, { route_long_name: null }),
    ]);

    const { vehicles } = await build([position(trip)]);

    expect(vehicles[0].headsign).toBe("42");
  });

  it("returns nothing without querying when there are no positions", async () => {
    const { vehicles } = await build([]);

    expect(vehicles).toEqual([]);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("scopes the query to the agency behind the tag", async () => {
    const trip = freshTrip();
    queryMock.mockResolvedValueOnce([routeRow(trip)]);

    await build([position(trip)]);

    const [, params] = queryMock.mock.calls[0];
    expect(params).toEqual([[trip], "505000000000000001"]);
  });

  it("de-duplicates trip ids before querying", async () => {
    const trip = freshTrip();
    queryMock.mockResolvedValueOnce([routeRow(trip)]);

    await build([
      position(trip, { vehicleId: "a" }),
      position(trip, { vehicleId: "b" }),
    ]);

    expect(queryMock.mock.calls[0][1]?.[0]).toEqual([trip]);
  });
});

describe("buildVehicleList route cache", () => {
  it("does not re-query a trip it has already resolved", async () => {
    const trip = freshTrip();
    queryMock.mockResolvedValueOnce([routeRow(trip)]);

    await build([position(trip)]);
    const second = await build([position(trip)]);

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(second.vehicles[0].routeName).toBe("42");
  });

  it("queries only the trip ids it has not seen", async () => {
    const known = freshTrip();
    const added = freshTrip();
    queryMock.mockResolvedValueOnce([routeRow(known)]);
    queryMock.mockResolvedValueOnce([routeRow(added, { route_short_name: "7" })]);

    await build([position(known)]);
    const second = await build([position(known), position(added)]);

    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[1][1]?.[0]).toEqual([added]);
    expect(second.vehicles).toHaveLength(2);
  });

  it("remembers misses so they are not re-queried every tick", async () => {
    const missing = freshTrip();
    queryMock.mockResolvedValueOnce([]);

    await build([position(missing)]);
    const second = await build([position(missing)]);

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(second.vehicles).toEqual([]);
  });
});
