"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DepartureBoard } from "@/components/departures/departure-board";
import { Star, ArrowLeft } from "lucide-react";
import { useFavorites } from "@/hooks/use-favorites";
import { cn } from "@/lib/utils";
import type { DepartureResponse } from "@/types/api";

export default function StopPage() {
  const params = useParams();
  const router = useRouter();
  const stopId = params.stopId as string;
  const { isFavorite, toggleFavorite } = useFavorites();

  const [data, setData] = useState<DepartureResponse | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>();

  const fetchDepartures = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/departures/${encodeURIComponent(stopId)}`,
      );

      if (!response.ok) {
        throw new Error("Kunde inte hämta avgångar");
      }

      const responseData = await response.json();
      setData(responseData);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Ett fel uppstod"));
    } finally {
      setIsLoading(false);
    }
  }, [stopId]);

  useEffect(() => {
    fetchDepartures();

    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchDepartures, 10000);
    return () => clearInterval(interval);
  }, [fetchDepartures]);

  const stopName = data?.stop?.stopName || "Laddar...";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">{stopName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toggleFavorite(stopId, stopName)}
            title={isFavorite(stopId) ? "Ta bort favorit" : "Lägg till favorit"}
          >
            <Star
              className={cn(
                "h-5 w-5",
                isFavorite(stopId)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground",
              )}
            />
          </Button>
          {/* <Button variant="outline" size="sm">
            <Map className="mr-2 h-4 w-4" />
            Visa på karta
          </Button> */}
        </div>
      </div>

      <DepartureBoard
        data={data}
        isLoading={isLoading}
        error={error}
        onRefresh={fetchDepartures}
        lastUpdated={lastUpdated}
      />
    </div>
  );
}
