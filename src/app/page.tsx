"use client";

import { useState, useCallback } from "react";
import { StopSearch } from "@/components/search/stop-search";
import { SearchResults } from "@/components/search/search-results";
import { FavoritesSection } from "@/components/favorites/favorites-list";
import type { StopSearchResult } from "@/types/api";

export default function HomePage() {
  const [searchResults, setSearchResults] = useState<StopSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/stops/search?q=${encodeURIComponent(query)}`,
      );

      if (!response.ok) {
        throw new Error("Kunde inte söka efter hållplatser");
      }

      const data = await response.json();
      setSearchResults(data.stops || []);
    } catch (err) {
      console.error("Search error:", err);
      setError(err instanceof Error ? err.message : "Ett fel uppstod");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleNearby = useCallback(async () => {
    if (!("geolocation" in navigator)) {
      alert("Din webbläsare stödjer inte positionering");
      return;
    }

    setIsLocating(true);
    setHasSearched(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `/api/stops/nearby?lat=${latitude}&lon=${longitude}`,
          );

          if (!response.ok) {
            throw new Error("Kunde inte hämta närliggande hållplatser");
          }

          const data = await response.json();
          setSearchResults(data.stops || []);
        } catch (err) {
          console.error("Nearby search error:", err);
          setError(err instanceof Error ? err.message : "Ett fel uppstod");
          setSearchResults([]);
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        setIsLocating(false);
        setError("Kunde inte hämta din position");
      },
    );
  }, []);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold mb-4">Hitta avgångar</h1>
        <StopSearch
          onSearch={handleSearch}
          onNearby={handleNearby}
          isLoading={isSearching}
          isLocating={isLocating}
        />
      </section>

      {error && (
        <div className="p-4 bg-red-50 text-red-800 rounded-lg">{error}</div>
      )}

      {hasSearched ? (
        <section>
          <h2 className="text-lg font-semibold mb-3">Sökresultat</h2>
          <SearchResults results={searchResults} isLoading={isSearching} />
        </section>
      ) : (
        <FavoritesSection />
      )}
    </div>
  );
}
