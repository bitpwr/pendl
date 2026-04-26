"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { StopSearch } from "@/components/search/stop-search";
import { AreaSearchResults } from "@/components/search/area-search-results";
import { FavoritesSection } from "@/components/favorites/favorites-list";
import { useAgency } from "@/hooks/use-agency";
import type { AreaSearchResult } from "@/types/api";

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const { agencyId, setAgency, agencies } = useAgency();

  const [searchResults, setSearchResults] = useState<AreaSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [hasSearched, setHasSearched] = useState(!!initialQuery);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(
    async (query: string) => {
      if (query.trim().length < 3) {
        setSearchResults([]);
        setHasSearched(false);
        // Clear query param when search is cleared
        router.replace("/", { scroll: false });
        return;
      }

      // Update URL with search query
      router.replace(`/?q=${encodeURIComponent(query)}`, { scroll: false });

      setIsSearching(true);
      setHasSearched(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/areas/search?q=${encodeURIComponent(query)}&agencyId=${encodeURIComponent(agencyId)}`,
        );

        if (!response.ok) {
          throw new Error("Kunde inte söka efter hållplats");
        }

        const data = await response.json();
        setSearchResults(data.areas || []);
      } catch (err) {
        console.error("Search error:", err);
        setError(err instanceof Error ? err.message : "Ett fel uppstod");
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [router, agencyId],
  );

  // Restore search results on mount if query param exists
  useEffect(() => {
    if (initialQuery) {
      handleSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run on mount

  // Re-search when agency changes if there's an active query
  useEffect(() => {
    const currentQuery = searchParams.get("q");
    if (currentQuery && currentQuery.trim().length >= 3) {
      handleSearch(currentQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId]);

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
            `/api/areas/nearby?lat=${latitude}&lon=${longitude}&radius=600&agencyId=${encodeURIComponent(agencyId)}`,
          );

          if (!response.ok) {
            throw new Error("Kunde inte hämta närliggande hållplatser");
          }

          const data = await response.json();
          setSearchResults(data.areas || []);
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
  }, [agencyId]);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold mb-4">Hitta avgångar</h1>
        <div className="flex items-center gap-2 mb-3">
          <label htmlFor="agency-select" className="text-sm font-medium">
            Trafikområde:
          </label>
          <select
            id="agency-select"
            value={agencyId}
            onChange={(e) => setAgency(e.target.value as typeof agencyId)}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.longName}
              </option>
            ))}
          </select>
        </div>
        <StopSearch
          onSearch={handleSearch}
          onNearby={handleNearby}
          isLoading={isSearching}
          isLocating={isLocating}
          initialValue={initialQuery}
        />
      </section>

      {error && (
        <div className="p-4 bg-red-50 text-red-800 rounded-lg">{error}</div>
      )}

      {hasSearched ? (
        <section>
          <h2 className="text-lg font-semibold mb-3">Sökresultat</h2>
          <AreaSearchResults
            results={searchResults}
            isLoading={isSearching}
            agencyId={agencyId}
          />
        </section>
      ) : (
        <FavoritesSection />
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="p-4">Laddar...</div>}>
      <HomePageContent />
    </Suspense>
  );
}
