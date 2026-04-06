import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// We need to create a fresh module for each test to reset the cache
describe("useFavorites", () => {
  let store: Record<string, string> = {};

  const localStorageMock = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };

  beforeEach(async () => {
    store = {};
    vi.clearAllMocks();

    // Reset the module cache to clear the snapshot cache
    vi.resetModules();

    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      writable: true,
    });
  });

  it("should return empty array when no favorites exist", async () => {
    const { useFavorites } = await import("./use-favorites");
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toEqual([]);
  });

  it("should add a favorite", async () => {
    const { useFavorites } = await import("./use-favorites");
    const { result } = renderHook(() => useFavorites());

    await act(async () => {
      result.current.addFavorite("area-1", "T-Centralen", "agency-1");
    });

    expect(localStorageMock.setItem).toHaveBeenCalled();
    const savedData = JSON.parse(store["pendl-area-favorites-v2"]);
    expect(savedData).toHaveLength(1);
    expect(savedData[0].areaId).toBe("area-1");
    expect(savedData[0].areaName).toBe("T-Centralen");
    expect(savedData[0].agencyId).toBe("agency-1");
  });

  it("should not add duplicate favorites", async () => {
    // Pre-populate with a favorite
    store["pendl-area-favorites-v2"] = JSON.stringify([
      {
        areaId: "area-1",
        areaName: "T-Centralen",
        agencyId: "agency-1",
        addedAt: Date.now(),
      },
    ]);

    const { useFavorites } = await import("./use-favorites");
    const { result } = renderHook(() => useFavorites());

    await act(async () => {
      result.current.addFavorite("area-1", "T-Centralen", "agency-1");
    });

    // Should still be only one item
    const savedData = JSON.parse(store["pendl-area-favorites-v2"]);
    expect(savedData).toHaveLength(1);
  });

  it("should check if an area is favorite", async () => {
    store["pendl-area-favorites-v2"] = JSON.stringify([
      {
        areaId: "area-1",
        areaName: "T-Centralen",
        agencyId: "agency-1",
        addedAt: Date.now(),
      },
    ]);

    const { useFavorites } = await import("./use-favorites");
    const { result } = renderHook(() => useFavorites());

    expect(result.current.isFavorite("area-1")).toBe(true);
    expect(result.current.isFavorite("area-2")).toBe(false);
  });

  it("should remove a favorite", async () => {
    store["pendl-area-favorites-v2"] = JSON.stringify([
      {
        areaId: "area-1",
        areaName: "T-Centralen",
        agencyId: "agency-1",
        addedAt: Date.now(),
      },
      {
        areaId: "area-2",
        areaName: "Slussen",
        agencyId: "agency-1",
        addedAt: Date.now(),
      },
    ]);

    const { useFavorites } = await import("./use-favorites");
    const { result } = renderHook(() => useFavorites());

    await act(async () => {
      result.current.removeFavorite("area-1");
    });

    const savedData = JSON.parse(store["pendl-area-favorites-v2"]);
    expect(savedData).toHaveLength(1);
    expect(savedData[0].areaId).toBe("area-2");
  });

  it("should toggle favorite on and off", async () => {
    const { useFavorites } = await import("./use-favorites");
    const { result } = renderHook(() => useFavorites());

    // Toggle on
    await act(async () => {
      result.current.toggleFavorite("area-1", "T-Centralen", "agency-1");
    });

    expect(result.current.isFavorite("area-1")).toBe(true);

    // Toggle off
    await act(async () => {
      result.current.toggleFavorite("area-1", "T-Centralen", "agency-1");
    });

    expect(result.current.isFavorite("area-1")).toBe(false);
  });
});
