import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import protobuf from "protobufjs";
import { fetchRealtimeFeed, protoDefinition } from "./realtime-client";

const FeedMessage = protobuf
  .parse(protoDefinition)
  .root.lookupType("transit_realtime.FeedMessage");

function encodeFeed(timestamp?: number): Uint8Array {
  const payload: Record<string, unknown> = {
    header: { gtfsRealtimeVersion: "2.0" },
    entity: [],
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
    // `defaults: true` decodes an absent timestamp as 0. Comparing that
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
