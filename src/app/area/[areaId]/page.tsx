"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AreaDepartureBoard } from "@/components/departures/area-departure-board";
import { AreaMap } from "@/components/map/area-map";
import { Star, ArrowLeft, Map } from "lucide-react";
import { useFavorites } from "@/hooks/use-favorites";
import { cn } from "@/lib/utils";
import type { AreaDepartureResponse } from "@/types/api";
import { getAgencyName } from "@/lib/config/agencies";

export default function AreaPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const areaId = params.areaId as string;
  const agencyId = searchParams.get("agency") || undefined;
  const { isFavorite, toggleFavorite } = useFavorites();

  const [data, setData] = useState<AreaDepartureResponse | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>();
  const [showMap, setShowMap] = useState(false);
  const lastLoggedAreaId = useRef<string | null>(null);

  const fetchDepartures = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const agencyParam = agencyId
        ? `?agencyId=${encodeURIComponent(agencyId)}`
        : "";
      const response = await fetch(
        `/api/areas/${encodeURIComponent(areaId)}/departures${agencyParam}`,
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
  }, [areaId, agencyId]);

  useEffect(() => {
    fetchDepartures();

    // First refresh after 2 seconds, then every 15 seconds
    let interval: ReturnType<typeof setInterval> | undefined;
    const firstTimeout = setTimeout(() => {
      fetchDepartures();
      interval = setInterval(fetchDepartures, 15000);
    }, 1500);

    return () => {
      clearTimeout(firstTimeout);
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [fetchDepartures]);

  useEffect(() => {
    if (!data?.area?.areaId || !data.area.areaName) {
      return;
    }

    if (lastLoggedAreaId.current === data.area.areaId) {
      return;
    }

    lastLoggedAreaId.current = data.area.areaId;

    void fetch("/api/analytics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key: "area",
        value: data.area.areaName,
        agency: getAgencyName(agencyId ?? ""),
      }),
      keepalive: true,
    });
  }, [data?.area?.areaId, data?.area?.areaName, agencyId]);

  const areaName = data?.area?.areaName || "Laddar...";

  useEffect(() => {
    if (!data?.area?.areaName) {
      return;
    }

    document.title = `${data.area.areaName} | Pendl`;
  }, [data?.area?.areaName]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" className="-ml-2" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">{areaName}</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toggleFavorite(areaId, areaName, agencyId || "")}
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
          <Button
            variant={showMap ? "default" : "outline"}
            size="sm"
            onClick={() => setShowMap((v) => !v)}
          >
            <Map className="mr-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      {data?.area && (
        <div
          className="grid transition-[grid-template-rows] duration-300 ease-in-out"
          style={{ gridTemplateRows: showMap ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <AreaMap
              latitude={data.area.latitude}
              longitude={data.area.longitude}
              areaName={data.area.areaName}
            />
          </div>
        </div>
      )}

      <AreaDepartureBoard
        data={data}
        isLoading={isLoading}
        error={error}
        onRefresh={fetchDepartures}
        lastUpdated={lastUpdated}
        agencyId={agencyId}
      />
    </div>
  );
}
