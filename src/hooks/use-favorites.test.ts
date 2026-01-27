import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// We need to create a fresh module for each test to reset the cache
describe('useFavorites', () => {
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
    
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  });

  it('should return empty array when no favorites exist', async () => {
    const { useFavorites } = await import('./use-favorites');
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toEqual([]);
  });

  it('should add a favorite', async () => {
    const { useFavorites } = await import('./use-favorites');
    const { result } = renderHook(() => useFavorites());

    await act(async () => {
      result.current.addFavorite('stop-1', 'T-Centralen');
    });

    expect(localStorageMock.setItem).toHaveBeenCalled();
    const savedData = JSON.parse(store['pendl-favorites']);
    expect(savedData).toHaveLength(1);
    expect(savedData[0].stopId).toBe('stop-1');
    expect(savedData[0].stopName).toBe('T-Centralen');
  });

  it('should not add duplicate favorites', async () => {
    // Pre-populate with a favorite
    store['pendl-favorites'] = JSON.stringify([
      { stopId: 'stop-1', stopName: 'T-Centralen', addedAt: Date.now() }
    ]);
    
    const { useFavorites } = await import('./use-favorites');
    const { result } = renderHook(() => useFavorites());

    await act(async () => {
      result.current.addFavorite('stop-1', 'T-Centralen');
    });

    // Should still be only one item
    const savedData = JSON.parse(store['pendl-favorites']);
    expect(savedData).toHaveLength(1);
  });

  it('should check if a stop is favorite', async () => {
    store['pendl-favorites'] = JSON.stringify([
      { stopId: 'stop-1', stopName: 'T-Centralen', addedAt: Date.now() }
    ]);

    const { useFavorites } = await import('./use-favorites');
    const { result } = renderHook(() => useFavorites());

    expect(result.current.isFavorite('stop-1')).toBe(true);
    expect(result.current.isFavorite('stop-2')).toBe(false);
  });

  it('should remove a favorite', async () => {
    store['pendl-favorites'] = JSON.stringify([
      { stopId: 'stop-1', stopName: 'T-Centralen', addedAt: Date.now() },
      { stopId: 'stop-2', stopName: 'Slussen', addedAt: Date.now() },
    ]);

    const { useFavorites } = await import('./use-favorites');
    const { result } = renderHook(() => useFavorites());

    await act(async () => {
      result.current.removeFavorite('stop-1');
    });

    const savedData = JSON.parse(store['pendl-favorites']);
    expect(savedData).toHaveLength(1);
    expect(savedData[0].stopId).toBe('stop-2');
  });

  it('should toggle favorite on and off', async () => {
    const { useFavorites } = await import('./use-favorites');
    const { result } = renderHook(() => useFavorites());

    // Toggle on
    await act(async () => {
      result.current.toggleFavorite('stop-1', 'T-Centralen');
    });

    expect(result.current.isFavorite('stop-1')).toBe(true);
    
    // Toggle off
    await act(async () => {
      result.current.toggleFavorite('stop-1', 'T-Centralen');
    });
    
    expect(result.current.isFavorite('stop-1')).toBe(false);
  });
});
