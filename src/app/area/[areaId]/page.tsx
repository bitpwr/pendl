"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AreaDepartureBoard } from "@/components/departures/area-departure-board";
import { Star, ArrowLeft } from "lucide-react";
import { useFavorites } from "@/hooks/use-favorites";
import { cn } from "@/lib/utils";
import type { AreaDepartureResponse } from "@/types/api";

export default function AreaPage() {
  const params = useParams();
  const router = useRouter();
  const areaId = params.areaId as string;
  const { isFavorite, toggleFavorite } = useFavorites();

  const [data, setData] = useState<AreaDepartureResponse | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>();

  const fetchDepartures = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/areas/${encodeURIComponent(areaId)}/departures`,
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
  }, [areaId]);

  useEffect(() => {
    fetchDepartures();

    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchDepartures, 10000);
    return () => clearInterval(interval);
  }, [fetchDepartures]);

  const areaName = data?.area?.areaName || "Laddar...";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">{areaName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toggleFavorite(areaId, areaName)}
            title={isFavorite(areaId) ? "Ta bort favorit" : "Lägg till favorit"}
          >
            <Star
              className={cn(
                "h-5 w-5",
                isFavorite(areaId)
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

      <AreaDepartureBoard
        data={data}
        isLoading={isLoading}
        error={error}
        onRefresh={fetchDepartures}
        lastUpdated={lastUpdated}
      />
    </div>
  );
}
