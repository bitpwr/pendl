import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { Marker as LeafletMarker } from "leaflet";
import { useAnimatedMarker } from "./use-animated-marker";
import { POSITION_ANIMATION_MS } from "./marker-animation";

let frames: FrameRequestCallback[] = [];
let now = 0;

function flushFrame(atMs: number) {
  now = atMs;
  const pending = frames;
  frames = [];
  act(() => pending.forEach((cb) => cb(now)));
}

function fakeMarker() {
  return { setLatLng: vi.fn() } as unknown as LeafletMarker & {
    setLatLng: ReturnType<typeof vi.fn>;
  };
}

const lastLatLng = (marker: { setLatLng: ReturnType<typeof vi.fn> }) =>
  marker.setLatLng.mock.calls.at(-1)?.[0] as [number, number];

beforeEach(() => {
  frames = [];
  now = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.stubGlobal("performance", { now: () => now });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useAnimatedMarker", () => {
  it("pins the position prop to where the marker mounted", () => {
    const { result, rerender } = renderHook(
      ({ lat, lon }) => useAnimatedMarker(lat, lon),
      { initialProps: { lat: 59.3, lon: 18.0 } },
    );

    const pinned = result.current.mountPosition;
    rerender({ lat: 59.4, lon: 18.1 });

    // react-leaflet compares position by identity; a changing prop would snap
    // the marker to the target ahead of every frame.
    expect(result.current.mountPosition).toBe(pinned);
    expect(pinned).toEqual([59.3, 18.0]);
  });

  it("does nothing until a marker is attached", () => {
    const { rerender } = renderHook(
      ({ lat, lon }) => useAnimatedMarker(lat, lon),
      { initialProps: { lat: 59.3, lon: 18.0 } },
    );

    rerender({ lat: 59.301, lon: 18.0 });
    expect(frames).toHaveLength(0);
  });

  it("eases toward the new position over the animation window", () => {
    const marker = fakeMarker();
    const { result, rerender } = renderHook(
      ({ lat, lon }) => useAnimatedMarker(lat, lon),
      { initialProps: { lat: 59.3, lon: 18.0 } },
    );
    result.current.markerRef.current = marker;

    rerender({ lat: 59.304, lon: 18.0 });

    flushFrame(POSITION_ANIMATION_MS / 2);
    const midpoint = lastLatLng(marker)[0];
    expect(midpoint).toBeGreaterThan(59.3);
    expect(midpoint).toBeLessThan(59.304);

    flushFrame(POSITION_ANIMATION_MS);
    expect(lastLatLng(marker)[0]).toBeCloseTo(59.304, 8);
  });

  it("stops scheduling frames once it arrives", () => {
    const marker = fakeMarker();
    const { result, rerender } = renderHook(
      ({ lat, lon }) => useAnimatedMarker(lat, lon),
      { initialProps: { lat: 59.3, lon: 18.0 } },
    );
    result.current.markerRef.current = marker;

    rerender({ lat: 59.304, lon: 18.0 });
    flushFrame(POSITION_ANIMATION_MS);

    expect(frames).toHaveLength(0);
  });

  it("snaps a jump too large to be movement", () => {
    const marker = fakeMarker();
    const { result, rerender } = renderHook(
      ({ lat, lon }) => useAnimatedMarker(lat, lon),
      { initialProps: { lat: 59.3, lon: 18.0 } },
    );
    result.current.markerRef.current = marker;

    rerender({ lat: 60.5, lon: 18.0 });

    expect(lastLatLng(marker)).toEqual([60.5, 18.0]);
    expect(frames).toHaveLength(0);
  });

  it("snaps when reduced motion is requested", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));

    const marker = fakeMarker();
    const { result, rerender } = renderHook(
      ({ lat, lon }) => useAnimatedMarker(lat, lon),
      { initialProps: { lat: 59.3, lon: 18.0 } },
    );
    result.current.markerRef.current = marker;

    rerender({ lat: 59.304, lon: 18.0 });

    expect(lastLatLng(marker)).toEqual([59.304, 18.0]);
    expect(frames).toHaveLength(0);
  });

  it("ignores a rerender that does not move the marker", () => {
    const marker = fakeMarker();
    const { result, rerender } = renderHook(
      ({ lat, lon }) => useAnimatedMarker(lat, lon),
      { initialProps: { lat: 59.3, lon: 18.0 } },
    );
    result.current.markerRef.current = marker;

    rerender({ lat: 59.3, lon: 18.0 });

    expect(marker.setLatLng).not.toHaveBeenCalled();
  });

  it("continues from where it had got to when a new position arrives", () => {
    // Updates can land mid-animation; restarting from the original position
    // would make the marker jerk backwards.
    const marker = fakeMarker();
    const { result, rerender } = renderHook(
      ({ lat, lon }) => useAnimatedMarker(lat, lon),
      { initialProps: { lat: 59.3, lon: 18.0 } },
    );
    result.current.markerRef.current = marker;

    rerender({ lat: 59.304, lon: 18.0 });
    flushFrame(POSITION_ANIMATION_MS / 2);
    const interrupted = lastLatLng(marker)[0];

    rerender({ lat: 59.308, lon: 18.0 });
    flushFrame(POSITION_ANIMATION_MS / 2 + 1);

    expect(lastLatLng(marker)[0]).toBeGreaterThanOrEqual(interrupted);
  });
});
