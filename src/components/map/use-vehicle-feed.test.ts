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
  type: "snapshot",
  seq: 1,
  vehicles: [{ id: "v1", tripId: "t1", lat: 59.3, lon: 18.1, headsign: "C" }],
  updatedAt: "2026-09-01T10:00:00.000Z",
};

function delta(seq: number, over: Record<string, unknown> = {}) {
  return {
    type: "delta",
    seq,
    updatedAt: "2026-09-01T10:00:02.000Z",
    added: [],
    moved: [],
    removed: [],
    ...over,
  };
}

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

describe("useVehicleFeed applying deltas", () => {
  it("moves a vehicle without resending its descriptive fields", async () => {
    useStreams();
    const { result } = renderHook(() => useVehicleFeed("sl"));

    act(() => FakeEventSource.latest().emit(snapshot));
    act(() =>
      FakeEventSource.latest().emit(
        delta(2, { moved: [["v1", 59.4, 18.2, 90, 5]] }),
      ),
    );

    await waitFor(() => expect(result.current.vehicles[0].lat).toBe(59.4));
    expect(result.current.vehicles[0].headsign).toBe("C");
  });

  it("adds and removes vehicles", async () => {
    useStreams();
    const { result } = renderHook(() => useVehicleFeed("sl"));

    act(() => FakeEventSource.latest().emit(snapshot));
    act(() =>
      FakeEventSource.latest().emit(
        delta(2, { added: [{ id: "v2", tripId: "t2", lat: 1, lon: 2 }] }),
      ),
    );
    await waitFor(() => expect(result.current.vehicles).toHaveLength(2));

    act(() => FakeEventSource.latest().emit(delta(3, { removed: ["v1"] })));
    await waitFor(() => expect(result.current.vehicles).toHaveLength(1));
    expect(result.current.vehicles[0].id).toBe("v2");
  });

  it("ignores a delta already covered by the opening snapshot", async () => {
    // The stream subscribes before it reads the snapshot, so a tick in
    // between can arrive with a sequence the snapshot already includes.
    useStreams();
    const { result } = renderHook(() => useVehicleFeed("sl"));

    act(() => FakeEventSource.latest().emit(snapshot));
    act(() => FakeEventSource.latest().emit(delta(1, { removed: ["v1"] })));

    expect(result.current.vehicles).toHaveLength(1);
  });

  it("resyncs from a full snapshot when a delta is missed", async () => {
    // Deltas are not cumulative, so a gap cannot be reconciled locally.
    useStreams();
    renderHook(() => useVehicleFeed("sl"));

    act(() => FakeEventSource.latest().emit(snapshot));
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => FakeEventSource.latest().emit(delta(5)));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/vehicles?agencyId=sl");
  });

  it("does not resync for a delta that follows in order", async () => {
    useStreams();
    renderHook(() => useVehicleFeed("sl"));

    act(() => FakeEventSource.latest().emit(snapshot));
    act(() => FakeEventSource.latest().emit(delta(2)));
    act(() => FakeEventSource.latest().emit(delta(3)));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps applying deltas while paused so the set stays in step", async () => {
    // Dropping a delta because the user is panning would corrupt the set,
    // since the next one builds on it. Only the render is deferred.
    useStreams();
    let paused = true;
    const { result } = renderHook(() =>
      useVehicleFeed("sl", { isPaused: () => paused }),
    );

    act(() => FakeEventSource.latest().emit(snapshot));
    act(() =>
      FakeEventSource.latest().emit(
        delta(2, { added: [{ id: "v2", tripId: "t2", lat: 1, lon: 2 }] }),
      ),
    );
    expect(result.current.vehicles).toHaveLength(0);

    paused = false;
    act(() => FakeEventSource.latest().emit(delta(3, { removed: ["v1"] })));

    await waitFor(() => expect(result.current.vehicles).toHaveLength(1));
    expect(result.current.vehicles[0].id).toBe("v2");
  });
});
