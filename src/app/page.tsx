"use client";

import { useState, useCallback } from "react";
import { StopSearch } from "@/components/search/stop-search";
import { SearchResults } from "@/components/search/search-results";
import { FavoritesSection } from "@/components/favorites/favorites-list";
import type { StopSearchResult } from "@/types/api";

// Mock data for initial UI development
const mockResults: StopSearchResult[] = [
  {
    stopId: "1",
    stopName: "T-Centralen",
    stopCode: "1051",
    latitude: 59.3314,
    longitude: 18.0603,
    routes: [
      { routeId: "1", routeShortName: "1", routeColor: "E74C3C", routeType: 1 },
      { routeId: "2", routeShortName: "2", routeColor: "9B59B6", routeType: 1 },
      {
        routeId: "14",
        routeShortName: "14",
        routeColor: "3498DB",
        routeType: 1,
      },
    ],
  },
  {
    stopId: "2",
    stopName: "Slussen",
    stopCode: "1511",
    latitude: 59.3195,
    longitude: 18.0716,
    routes: [
      { routeId: "1", routeShortName: "1", routeColor: "E74C3C", routeType: 1 },
      {
        routeId: "14",
        routeShortName: "14",
        routeColor: "3498DB",
        routeType: 1,
      },
    ],
  },
  {
    stopId: "3",
    stopName: "Odenplan",
    latitude: 59.3429,
    longitude: 18.0498,
    routes: [
      { routeId: "2", routeShortName: "2", routeColor: "9B59B6", routeType: 1 },
      {
        routeId: "42",
        routeShortName: "42",
        routeColor: "2ECC71",
        routeType: 3,
      },
    ],
  },
];

export default function HomePage() {
  const [searchResults, setSearchResults] = useState<StopSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback((query: string) => {
    setIsSearching(true);
    setHasSearched(true);

    // Simulate API call - will be replaced with real API
    setTimeout(() => {
      const filtered = mockResults.filter((stop) =>
        stop.stopName.toLowerCase().includes(query.toLowerCase()),
      );
      setSearchResults(filtered);
      setIsSearching(false);
    }, 300);
  }, []);

  const handleNearby = useCallback(() => {
    setIsLocating(true);
    setHasSearched(true);

    // Simulate geolocation - will be replaced with real implementation
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log("Location:", position.coords);
          // For now, just show mock results with distance
          const resultsWithDistance = mockResults.map((stop, i) => ({
            ...stop,
            distance: (i + 1) * 150,
          }));
          setSearchResults(resultsWithDistance);
          setIsLocating(false);
        },
        (error) => {
          console.error("Geolocation error:", error);
          setIsLocating(false);
          alert("Kunde inte hämta din position");
        },
      );
    } else {
      setIsLocating(false);
      alert("Din webbläsare stödjer inte positionering");
    }
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
