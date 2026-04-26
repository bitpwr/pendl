"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AreaDepartureBoard } from "@/components/departures/area-departure-board";
import { AreaMap } from "@/components/map/area-map";
import { Star, ArrowLeft, Map as MapIcon, RefreshCw } from "lucide-react";
import { useFavorites } from "@/hooks/use-favorites";
import { cn } from "@/lib/utils";
import type { AreaDepartureResponse } from "@/types/api";
import type { RouteType } from "@/types/gtfs";
import { getAgencyName } from "@/lib/config/agencies";
import { RouteBadge } from "@/components/departures/route-badge";

const refreshInterval = 15000;
const inactivityTimeout = 30 * 60 * 1000;
const initialRefreshDelay = 1500;

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
  const [selectedRoutes, setSelectedRoutes] = useState<Set<string>>(new Set());
  const [autoRefreshPaused, setAutoRefreshPaused] = useState(false);
  const lastLoggedAreaId = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const storageKey = `pendl-route-filter-${areaId}`;

  const uniqueRoutes = useMemo(() => {
    if (!data) return [];
    const seen = new Map<string, { shortName: string; routeType: RouteType }>();
    for (const group of data.groups) {
      for (const d of group.departures) {
        const key = `${d.routeShortName}-${d.routeType}`;
        if (!seen.has(key)) {
          seen.set(key, {
            shortName: d.routeShortName,
            routeType: d.routeType,
          });
        }
      }
    }
    return [...seen.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) =>
        a.routeType !== b.routeType
          ? a.routeType - b.routeType
          : a.shortName.localeCompare(b.shortName, undefined, {
              numeric: true,
            }),
      );
  }, [data]);

  const filteredData = useMemo(() => {
    if (!data || selectedRoutes.size === 0) return data;
    return {
      ...data,
      groups: data.groups
        .map((group) => ({
          ...group,
          departures: group.departures.filter((d) =>
            selectedRoutes.has(`${d.routeShortName}-${d.routeType}`),
          ),
        }))
        .filter((group) => group.departures.length > 0),
    };
  }, [data, selectedRoutes]);

  const toggleRoute = useCallback(
    (key: string) => {
      setSelectedRoutes((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);

        if (next.size === 0) {
          localStorage.removeItem(storageKey);
        } else {
          localStorage.setItem(storageKey, JSON.stringify([...next]));
        }
        return next;
      });
    },
    [storageKey],
  );

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

  const startAutoRefresh = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    setAutoRefreshPaused(false);
    void fetchDepartures();
    intervalRef.current = setInterval(fetchDepartures, refreshInterval);
    pauseTimeoutRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setAutoRefreshPaused(true);
    }, inactivityTimeout);
  }, [fetchDepartures]);

  useEffect(() => {
    setAutoRefreshPaused(false);
    fetchDepartures();

    // First refresh after 1.5 seconds, then every 15 seconds
    const firstTimeout = setTimeout(() => {
      fetchDepartures();
      intervalRef.current = setInterval(fetchDepartures, refreshInterval);
      pauseTimeoutRef.current = setTimeout(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setAutoRefreshPaused(true);
      }, inactivityTimeout);
    }, initialRefreshDelay);

    return () => {
      clearTimeout(firstTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
        pauseTimeoutRef.current = undefined;
      }
    };
  }, [fetchDepartures]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      setSelectedRoutes(
        stored ? new Set(JSON.parse(stored) as string[]) : new Set(),
      );
    } catch {
      setSelectedRoutes(new Set());
    }
  }, [storageKey]);

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
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2"
            onClick={() => router.back()}
          >
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
            <MapIcon className="mr-2 h-4 w-4" />
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

      {uniqueRoutes.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {uniqueRoutes.map(({ key, shortName, routeType }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleRoute(key)}
              aria-pressed={selectedRoutes.has(key)}
              className={cn(
                "rounded-md transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selectedRoutes.size > 0 && !selectedRoutes.has(key)
                  ? "opacity-35"
                  : "opacity-100",
              )}
            >
              <RouteBadge
                shortName={shortName}
                routeType={routeType}
                size="sm"
              />
            </button>
          ))}
        </div>
      )}

      {autoRefreshPaused && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-400/50 bg-yellow-50 px-4 py-3 text-sm dark:border-yellow-500/40 dark:bg-yellow-950/50">
          <span className="flex-1 font-medium text-yellow-900 dark:text-yellow-200">
            Uppdatering pausad pga inaktivitet.
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={startAutoRefresh}
            className="border-yellow-400/70 bg-yellow-100 text-yellow-900 hover:bg-yellow-200 dark:border-yellow-500/50 dark:bg-yellow-900/50 dark:text-yellow-200 dark:hover:bg-yellow-900"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Starta igen
          </Button>
        </div>
      )}

      <AreaDepartureBoard
        data={filteredData}
        isLoading={isLoading}
        error={error}
        onRefresh={fetchDepartures}
        lastUpdated={lastUpdated}
        agencyId={agencyId}
        areaId={areaId}
      />
    </div>
  );
}
