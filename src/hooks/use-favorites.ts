"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "pendl-area-favorites";

export interface FavoriteArea {
  areaId: string;
  areaName: string;
  addedAt: number;
}

// Cache for the snapshot to avoid creating new arrays on each call
let cachedFavorites: FavoriteArea[] = [];
let cachedJson: string | null = null;

function getSnapshot(): FavoriteArea[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    // Only parse if the stored value changed
    if (stored !== cachedJson) {
      cachedJson = stored;
      cachedFavorites = stored ? JSON.parse(stored) : [];
    }
    return cachedFavorites;
  } catch {
    return [];
  }
}

const emptyArray: FavoriteArea[] = [];
function getServerSnapshot(): FavoriteArea[] {
  return emptyArray;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener("favorites-changed", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("favorites-changed", callback);
  };
}

export function useFavorites() {
  const favorites = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const addFavorite = useCallback((areaId: string, areaName: string) => {
    const current = getSnapshot();
    if (current.some((f) => f.areaId === areaId)) return;

    const updated = [...current, { areaId, areaName, addedAt: Date.now() }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("favorites-changed"));
  }, []);

  const removeFavorite = useCallback((areaId: string) => {
    const current = getSnapshot();
    const updated = current.filter((f) => f.areaId !== areaId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("favorites-changed"));
  }, []);

  const isFavorite = useCallback(
    (areaId: string) => {
      return favorites.some((f) => f.areaId === areaId);
    },
    [favorites],
  );

  const toggleFavorite = useCallback(
    (areaId: string, areaName: string) => {
      if (isFavorite(areaId)) {
        removeFavorite(areaId);
      } else {
        addFavorite(areaId, areaName);
      }
    },
    [isFavorite, addFavorite, removeFavorite],
  );

  return { favorites, addFavorite, removeFavorite, isFavorite, toggleFavorite };
}
