import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useVehicleFeed } from "./use-vehicle-feed";

type Listener = (event: { data: string }) => void;

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  onmessage: Listener | null = null;
  onerror: ((event: unknown) => void) | null = null;
  closed = false;

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  emit(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  emitRaw(data: string) {
    this.onmessage?.({ data });
  }

  fail() {
    this.onerror?.(new Event("error"));
  }

  static latest() {
    return FakeEventSource.instances[FakeEventSource.instances.length - 1];
  }

  static reset() {
    FakeEventSource.instances = [];
  }
}

const snapshot = {
  vehicles: [{ id: "v1", lat: 59.3, lon: 18.1 }],
  updatedAt: "2026-09-01T10:00:00.000Z",
};

const fetchMock = vi.fn();

function useStreams() {
  vi.stubGlobal("EventSource", FakeEventSource);
}

function useNoStreams() {
  const w = window as unknown as Record<string, unknown>;
  delete w.EventSource;
}

beforeEach(() => {
  FakeEventSource.reset();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => snapshot });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useVehicleFeed over a stream", () => {
  it("opens a stream scoped to the agency", () => {
    useStreams();
    renderHook(() => useVehicleFeed("505000000000000001"));

    expect(FakeEventSource.latest().url).toBe(
      "/api/vehicles/stream?agencyId=505000000000000001",
    );
  });

  it("omits the query when there is no agency", () => {
    useStreams();
    renderHook(() => useVehicleFeed(undefined));

    expect(FakeEventSource.latest().url).toBe("/api/vehicles/stream");
  });

  it("applies pushed payloads", async () => {
    useStreams();
    const { result } = renderHook(() => useVehicleFeed("sl"));

    act(() => FakeEventSource.latest().emit(snapshot));

    await waitFor(() => expect(result.current.vehicles).toHaveLength(1));
    expect(result.current.updatedAt?.toISOString()).toBe(snapshot.updatedAt);
  });

  it("does not poll while streaming", () => {
    useStreams();
    renderHook(() => useVehicleFeed("sl"));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("survives a truncated frame", async () => {
    useStreams();
    const { result } = renderHook(() => useVehicleFeed("sl"));

    act(() => FakeEventSource.latest().emitRaw("{not json"));
    act(() => FakeEventSource.latest().emit(snapshot));

    await waitFor(() => expect(result.current.vehicles).toHaveLength(1));
  });

  it("drops updates while the map is being interacted with", async () => {
    useStreams();
    let paused = true;
    const { result } = renderHook(() =>
      useVehicleFeed("sl", { isPaused: () => paused }),
    );

    act(() => FakeEventSource.latest().emit(snapshot));
    expect(result.current.vehicles).toHaveLength(0);

    paused = false;
    act(() => FakeEventSource.latest().emit(snapshot));
    await waitFor(() => expect(result.current.vehicles).toHaveLength(1));
  });

  it("closes the stream on unmount", () => {
    useStreams();
    const { unmount } = renderHook(() => useVehicleFeed("sl"));
    const source = FakeEventSource.latest();

    unmount();

    expect(source.closed).toBe(true);
  });
});

describe("useVehicleFeed transport fallback", () => {
  it("polls when EventSource is unavailable", async () => {
    useNoStreams();
    const { result } = renderHook(() => useVehicleFeed("sl"));

    expect(result.current.transport).toBe("poll");
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/vehicles?agencyId=sl");
  });

  it("falls back to polling if the stream fails before delivering", async () => {
    useStreams();
    const { result } = renderHook(() => useVehicleFeed("sl"));

    act(() => FakeEventSource.latest().fail());

    await waitFor(() => expect(result.current.transport).toBe("poll"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it("keeps streaming through an error once it has delivered", async () => {
    // EventSource reconnects on its own, so a blip after real data must not
    // permanently downgrade a working stream.
    useStreams();
    const { result } = renderHook(() => useVehicleFeed("sl"));

    act(() => FakeEventSource.latest().emit(snapshot));
    await waitFor(() => expect(result.current.vehicles).toHaveLength(1));

    act(() => FakeEventSource.latest().fail());

    expect(result.current.transport).toBe("stream");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces an error when polling fails", async () => {
    useNoStreams();
    fetchMock.mockResolvedValue({ ok: false });

    const { result } = renderHook(() => useVehicleFeed("sl"));

    await waitFor(() => expect(result.current.error).not.toBeNull());
  });

  it("refresh fetches once even while streaming", async () => {
    useStreams();
    const { result } = renderHook(() => useVehicleFeed("sl"));

    act(() => result.current.refresh());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});
