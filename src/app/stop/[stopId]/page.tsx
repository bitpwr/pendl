"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DepartureBoard } from "@/components/departures/departure-board";
import { Star, ArrowLeft, Map } from "lucide-react";
import { useFavorites } from "@/hooks/use-favorites";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { DepartureResponse } from "@/types/api";
import { RouteType } from "@/types/gtfs";

// Mock data for UI development
const mockDepartures: DepartureResponse = {
  stop: {
    stopId: "1",
    stopName: "T-Centralen",
    latitude: 59.3309,
    longitude: 18.0591,
  },
  updatedAt: new Date().toISOString(),
  departures: [
    {
      tripId: "trip-1",
      routeId: "1",
      routeShortName: "1",
      routeLongName: "Fruängen - Ropsten",
      routeColor: "E74C3C",
      routeTextColor: "FFFFFF",
      routeType: RouteType.Subway,
      headsign: "Fruängen",
      scheduledDeparture: new Date(Date.now() + 2 * 60000).toISOString(),
      realtimeDeparture: new Date(Date.now() + 3 * 60000).toISOString(),
      delaySeconds: 60,
      stopId: "1",
      directionId: 0,
      platform: "1",
    },
    {
      tripId: "trip-2",
      routeId: "2",
      routeShortName: "2",
      routeLongName: "Bagarmossen - Mörby centrum",
      routeColor: "9B59B6",
      routeTextColor: "FFFFFF",
      routeType: RouteType.Subway,
      headsign: "Bagarmossen",
      scheduledDeparture: new Date(Date.now() + 5 * 60000).toISOString(),
      stopId: "1",
      directionId: 0,
      platform: "2",
    },
    {
      tripId: "trip-3",
      routeId: "14",
      routeShortName: "14",
      routeLongName: "T-Centralen - Mörby centrum",
      routeColor: "3498DB",
      routeTextColor: "FFFFFF",
      routeType: RouteType.Subway,
      headsign: "Mörby centrum",
      scheduledDeparture: new Date(Date.now() + 8 * 60000).toISOString(),
      stopId: "1",
      directionId: 0,
      platform: "3",
    },
    {
      tripId: "trip-4",
      routeId: "1",
      routeShortName: "1",
      routeLongName: "Fruängen - Ropsten",
      routeColor: "E74C3C",
      routeTextColor: "FFFFFF",
      routeType: RouteType.Subway,
      headsign: "Fruängen",
      scheduledDeparture: new Date(Date.now() + 12 * 60000).toISOString(),
      isCancelled: true,
      stopId: "1",
      directionId: 0,
      platform: "1",
    },
    {
      tripId: "trip-5",
      routeId: "42",
      routeShortName: "42",
      routeLongName: "Linje 42",
      routeColor: "2ECC71",
      routeTextColor: "FFFFFF",
      routeType: RouteType.Bus,
      headsign: "Centralen",
      scheduledDeparture: new Date(Date.now() + 45 * 60000).toISOString(),
      stopId: "1",
      directionId: 0,
    },
  ],
};

export default function StopPage() {
  const params = useParams();
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
      // Simulate API call - will be replaced with real API
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Use mock data with the actual stopId
      const response = {
        ...mockDepartures,
        stopId,
      };

      setData(response);
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
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
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
          <Button variant="outline" size="sm">
            <Map className="mr-2 h-4 w-4" />
            Visa på karta
          </Button>
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
