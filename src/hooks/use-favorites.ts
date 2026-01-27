'use client';

import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'pendl-favorites';

export interface FavoriteStop {
  stopId: string;
  stopName: string;
  addedAt: number;
}

// Cache for the snapshot to avoid creating new arrays on each call
let cachedFavorites: FavoriteStop[] = [];
let cachedJson: string | null = null;

function getSnapshot(): FavoriteStop[] {
  if (typeof window === 'undefined') return [];
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

const emptyArray: FavoriteStop[] = [];
function getServerSnapshot(): FavoriteStop[] {
  return emptyArray;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('storage', callback);
  window.addEventListener('favorites-changed', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('favorites-changed', callback);
  };
}

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const addFavorite = useCallback((stopId: string, stopName: string) => {
    const current = getSnapshot();
    if (current.some((f) => f.stopId === stopId)) return;

    const updated = [...current, { stopId, stopName, addedAt: Date.now() }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('favorites-changed'));
  }, []);

  const removeFavorite = useCallback((stopId: string) => {
    const current = getSnapshot();
    const updated = current.filter((f) => f.stopId !== stopId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('favorites-changed'));
  }, []);

  const isFavorite = useCallback(
    (stopId: string) => {
      return favorites.some((f) => f.stopId === stopId);
    },
    [favorites]
  );

  const toggleFavorite = useCallback(
    (stopId: string, stopName: string) => {
      if (isFavorite(stopId)) {
        removeFavorite(stopId);
      } else {
        addFavorite(stopId, stopName);
      }
    },
    [isFavorite, addFavorite, removeFavorite]
  );

  return { favorites, addFavorite, removeFavorite, isFavorite, toggleFavorite };
}
