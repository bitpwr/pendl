import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import protobuf from "protobufjs";
import {
  fetchRealtimeFeed,
  fetchVehiclePositions,
  protoDefinition,
} from "./realtime-client";

vi.mock("@/lib/analytics/influx", () => ({
  trackVehicleDownload: vi.fn(),
  trackTripUpdateDownload: vi.fn(),
  trackServiceAlertDownload: vi.fn(),
}));

const FeedMessage = protobuf
  .parse(protoDefinition)
  .root.lookupType("transit_realtime.FeedMessage");

function encodeFeed(
  timestamp?: number,
  entity: Record<string, unknown>[] = [],
): Uint8Array {
  const payload: Record<string, unknown> = {
    header: { gtfsRealtimeVersion: "2.0" },
    entity,
  };
  if (timestamp !== undefined) {
    (payload.header as Record<string, unknown>).timestamp = timestamp;
  }

  const error = FeedMessage.verify(payload);
  if (error) throw new Error(error);

  return FeedMessage.encode(FeedMessage.create(payload)).finish();
}

function okResponse(bytes: Uint8Array, headers: Record<string, string> = {}) {
  return {
    ok: true,
    status: 200,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

function notModifiedResponse() {
  return {
    ok: false,
    status: 304,
    headers: { get: () => null },
    arrayBuffer: async () => new ArrayBuffer(0),
  };
}

const fetchMock = vi.fn();

// The validator cache is module state keyed by URL, so each test uses its own
// URL rather than reaching in to reset it.
let urlCounter = 0;
const freshUrl = () => `https://feeds.test/${urlCounter++}/Vehicle.pb`;

function requestHeaders(call: number): Record<string, string> {
  return fetchMock.mock.calls[call][1].headers;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchRealtimeFeed conditional requests", () => {
  it("sends no validators on the first request for a feed", async () => {
    fetchMock.mockResolvedValueOnce(okResponse(encodeFeed(1000)));

    await fetchRealtimeFeed(freshUrl());

    const headers = requestHeaders(0);
    expect(headers["If-None-Match"]).toBeUndefined();
    expect(headers["If-Modified-Since"]).toBeUndefined();
  });

  it("returns the decoded feed on a 200", async () => {
    fetchMock.mockResolvedValueOnce(okResponse(encodeFeed(1000)));

    const feed = await fetchRealtimeFeed(freshUrl());

    expect(feed).not.toBeNull();
    expect(feed?.header.timestamp).toBe(1000);
  });

  it("replays the ETag and Last-Modified on the next request", async () => {
    const url = freshUrl();
    fetchMock.mockResolvedValueOnce(
      okResponse(encodeFeed(1000), {
        etag: '"abc123"',
        "last-modified": "Wed, 21 Oct 2026 07:28:00 GMT",
      }),
    );
    fetchMock.mockResolvedValueOnce(notModifiedResponse());

    await fetchRealtimeFeed(url);
    await fetchRealtimeFeed(url);

    const headers = requestHeaders(1);
    expect(headers["If-None-Match"]).toBe('"abc123"');
    expect(headers["If-Modified-Since"]).toBe("Wed, 21 Oct 2026 07:28:00 GMT");
  });

  it("returns null on a 304 without decoding a body", async () => {
    const url = freshUrl();
    fetchMock.mockResolvedValueOnce(
      okResponse(encodeFeed(1000), { etag: '"v1"' }),
    );
    fetchMock.mockResolvedValueOnce(notModifiedResponse());

    await fetchRealtimeFeed(url);
    expect(await fetchRealtimeFeed(url)).toBeNull();
  });

  it("keeps validators separate per feed URL", async () => {
    const vehicles = freshUrl();
    const trips = freshUrl();

    fetchMock.mockResolvedValueOnce(
      okResponse(encodeFeed(1000), { etag: '"vehicles-v1"' }),
    );
    fetchMock.mockResolvedValueOnce(
      okResponse(encodeFeed(1000), { etag: '"trips-v1"' }),
    );
    fetchMock.mockResolvedValueOnce(notModifiedResponse());

    await fetchRealtimeFeed(vehicles);
    await fetchRealtimeFeed(trips);
    await fetchRealtimeFeed(vehicles);

    expect(requestHeaders(2)["If-None-Match"]).toBe('"vehicles-v1"');
  });

  it("throws on a non-304 error status", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: { get: () => null },
      arrayBuffer: async () => new ArrayBuffer(0),
    });

    await expect(fetchRealtimeFeed(freshUrl())).rejects.toThrow(
      "Failed to fetch realtime feed: 500",
    );
  });
});

describe("fetchRealtimeFeed header timestamp gate", () => {
  it("returns null when a 200 repeats the previous feed timestamp", async () => {
    const url = freshUrl();
    fetchMock.mockResolvedValueOnce(okResponse(encodeFeed(1000)));
    fetchMock.mockResolvedValueOnce(okResponse(encodeFeed(1000)));

    expect(await fetchRealtimeFeed(url)).not.toBeNull();
    expect(await fetchRealtimeFeed(url)).toBeNull();
  });

  it("returns the feed when the timestamp advances", async () => {
    const url = freshUrl();
    fetchMock.mockResolvedValueOnce(okResponse(encodeFeed(1000)));
    fetchMock.mockResolvedValueOnce(okResponse(encodeFeed(1002)));

    expect(await fetchRealtimeFeed(url)).not.toBeNull();
    expect((await fetchRealtimeFeed(url))?.header.timestamp).toBe(1002);
  });

  it("never treats a feed without a timestamp as unchanged", async () => {
    // An absent timestamp arrives as undefined, and would arrive as 0 if
    // proto defaults were ever switched back on. Either value compared
    // literally would freeze the feed after the first fetch.
    const url = freshUrl();
    fetchMock.mockResolvedValueOnce(okResponse(encodeFeed()));
    fetchMock.mockResolvedValueOnce(okResponse(encodeFeed()));
    fetchMock.mockResolvedValueOnce(okResponse(encodeFeed()));

    expect(await fetchRealtimeFeed(url)).not.toBeNull();
    expect(await fetchRealtimeFeed(url)).not.toBeNull();
    expect(await fetchRealtimeFeed(url)).not.toBeNull();
  });

  it("still gates once a feed starts sending timestamps", async () => {
    const url = freshUrl();
    fetchMock.mockResolvedValueOnce(okResponse(encodeFeed()));
    fetchMock.mockResolvedValueOnce(okResponse(encodeFeed(2000)));
    fetchMock.mockResolvedValueOnce(okResponse(encodeFeed(2000)));

    expect(await fetchRealtimeFeed(url)).not.toBeNull();
    expect(await fetchRealtimeFeed(url)).not.toBeNull();
    expect(await fetchRealtimeFeed(url)).toBeNull();
  });
});

describe("fetchVehiclePositions decoding without proto defaults", () => {
  // toObject runs without `defaults`, so absent optional fields arrive as
  // undefined rather than their proto default. The converters have to supply
  // those themselves.
  it("fills in defaults the decoder no longer materialises", async () => {
    fetchMock.mockResolvedValueOnce(
      okResponse(
        encodeFeed(1000, [
          {
            id: "entity-1",
            vehicle: {
              trip: { tripId: "trip-1" },
              position: { latitude: 59.33, longitude: 18.07 },
            },
          },
        ]),
      ),
    );

    const positions = await fetchVehiclePositions("agency-defaults-1");

    expect(positions).toEqual([
      {
        vehicleId: "",
        tripId: "trip-1",
        routeId: "",
        latitude: expect.closeTo(59.33, 4),
        longitude: expect.closeTo(18.07, 4),
        bearing: undefined,
        speed: undefined,
        currentStopSequence: undefined,
        // current_status defaults to IN_TRANSIT_TO in the schema.
        currentStatus: "IN_TRANSIT_TO",
        timestamp: expect.any(Number),
      },
    ]);
  });

  it("still reads the fields the feed does provide", async () => {
    fetchMock.mockResolvedValueOnce(
      okResponse(
        encodeFeed(1000, [
          {
            id: "entity-1",
            vehicle: {
              trip: { tripId: "trip-2", routeId: "route-2" },
              vehicle: { id: "veh-2" },
              position: {
                latitude: 59.5,
                longitude: 18.5,
                bearing: 180,
                speed: 11,
              },
              currentStopSequence: 4,
              currentStatus: 1,
              timestamp: 1700000000,
            },
          },
        ]),
      ),
    );

    const positions = await fetchVehiclePositions("agency-defaults-2");

    expect(positions?.[0]).toMatchObject({
      vehicleId: "veh-2",
      tripId: "trip-2",
      routeId: "route-2",
      bearing: 180,
      speed: 11,
      currentStopSequence: 4,
      currentStatus: "STOPPED_AT",
      timestamp: 1700000000,
    });
  });

  it("returns an empty list for a feed with no entities", async () => {
    fetchMock.mockResolvedValueOnce(okResponse(encodeFeed(1000)));

    expect(await fetchVehiclePositions("agency-defaults-3")).toEqual([]);
  });
});
