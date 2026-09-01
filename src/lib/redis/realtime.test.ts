import { describe, it, expect, vi, beforeEach } from "vitest";
import type { VehiclePosition } from "@/types/realtime";

const redisMock = {
  get: vi.fn(),
  del: vi.fn(),
  setex: vi.fn(),
  keys: vi.fn(),
  mget: vi.fn(),
};

vi.mock("./index", async () => {
  const actual = await vi.importActual<typeof import("./index")>("./index");
  return { ...actual, getRedis: () => redisMock };
});

import { getVehicleByTrip } from "./realtime";

function vehicle(over: Partial<VehiclePosition> = {}): VehiclePosition {
  return {
    vehicleId: "veh-1",
    tripId: "trip-1",
    routeId: "route-1",
    latitude: 59.3,
    longitude: 18.0,
    currentStatus: "IN_TRANSIT_TO",
    timestamp: 1_700_000_000,
    ...over,
  };
}

beforeEach(() => {
  Object.values(redisMock).forEach((fn) => fn.mockReset());
});

describe("getVehicleByTrip", () => {
  it("resolves through the trip index", async () => {
    redisMock.get
      .mockResolvedValueOnce("veh-1")
      .mockResolvedValueOnce(JSON.stringify(vehicle()));

    expect(await getVehicleByTrip("trip-1")).toMatchObject({
      vehicleId: "veh-1",
      tripId: "trip-1",
    });
  });

  it("returns null without scanning when the trip has no vehicle", async () => {
    // The index is written for every vehicle on every tick, so a miss means
    // nothing is running - it is not worth a keyspace scan to confirm, which
    // blocks Redis for every other caller.
    redisMock.get.mockResolvedValueOnce(null);

    expect(await getVehicleByTrip("trip-idle")).toBeNull();
    expect(redisMock.keys).not.toHaveBeenCalled();
    expect(redisMock.mget).not.toHaveBeenCalled();
  });

  it("never scans even when the index points at a vehicle that moved on", async () => {
    redisMock.get
      .mockResolvedValueOnce("veh-1")
      .mockResolvedValueOnce(JSON.stringify(vehicle({ tripId: "trip-other" })));

    expect(await getVehicleByTrip("trip-1")).toBeNull();
    expect(redisMock.keys).not.toHaveBeenCalled();
  });

  it("clears a stale index entry", async () => {
    redisMock.get
      .mockResolvedValueOnce("veh-1")
      .mockResolvedValueOnce(JSON.stringify(vehicle({ tripId: "trip-other" })));

    await getVehicleByTrip("trip-1");

    expect(redisMock.del).toHaveBeenCalledWith("vehicleByTrip:trip-1");
  });

  it("returns null when the index points at an expired position", async () => {
    redisMock.get.mockResolvedValueOnce("veh-1").mockResolvedValueOnce(null);

    expect(await getVehicleByTrip("trip-1")).toBeNull();
  });

  it("looks the position up by the id the index gave it", async () => {
    redisMock.get
      .mockResolvedValueOnce("veh-7")
      .mockResolvedValueOnce(JSON.stringify(vehicle({ vehicleId: "veh-7" })));

    await getVehicleByTrip("trip-1");

    expect(redisMock.get).toHaveBeenNthCalledWith(1, "vehicleByTrip:trip-1");
    expect(redisMock.get).toHaveBeenNthCalledWith(2, "vehicle:veh-7");
  });
});
