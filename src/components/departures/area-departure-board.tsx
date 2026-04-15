"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DepartureRow } from "./departure-row";
import { RefreshCw, AlertTriangle, Clock, ChevronDown } from "lucide-react";
import type { AreaDepartureResponse, AreaDepartureGroup } from "@/types/api";
import { formatTime } from "@/lib/gtfs/time-utils";

interface AreaDepartureBoardProps {
  data?: AreaDepartureResponse;
  isLoading?: boolean;
  error?: Error | null;
  onRefresh?: () => void;
  lastUpdated?: Date;
  agencyId?: string;
  areaId?: string;
}

export function AreaDepartureBoard({
  data,
  isLoading,
  error,
  onRefresh,
  lastUpdated,
  agencyId,
  areaId,
}: AreaDepartureBoardProps) {
  const storageKey = areaId ? `pendl-hidden-stops-${areaId}` : null;

  const [collapsedStops, setCollapsedStops] = useState<Set<string>>(() => {
    if (!areaId || typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem(`pendl-hidden-stops-${areaId}`);
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    if (!storageKey) return;
    if (collapsedStops.size === 0) {
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(storageKey, JSON.stringify([...collapsedStops]));
    }
  }, [collapsedStops, storageKey]);

  const toggleStop = useCallback((stopId: string) => {
    setCollapsedStops((prev) => {
      const next = new Set(prev);
      if (next.has(stopId)) next.delete(stopId);
      else next.add(stopId);
      return next;
    });
  }, []);
  if (isLoading && !data) {
    return <AreaDepartureBoardSkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-destructive/80 mb-3" />
          <p className="text-base font-semibold">Kunde inte ladda avgångar</p>
          <p className="text-sm text-muted-foreground mt-1.5">
            {error.message}
          </p>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              className="mt-5"
              onClick={onRefresh}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Försök igen
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!data || data.groups.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
          <Clock className="mx-auto h-10 w-10 mb-3 opacity-40" />
          <p className="text-base font-medium text-foreground">
            Inga avgångar hittades
          </p>
          <p className="text-sm mt-1.5">
            Det finns inga avgångar de närmaste timmarna
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasRealtimePositions = data.groups.some((group) =>
    group.departures.some((departure) => !!departure.realtimeDeparture),
  );

  const sortedGroups = [...data.groups].sort((a, b) => {
    const routeTypeA = a.departures[0]?.routeType;
    const routeTypeB = b.departures[0]?.routeType;

    if (routeTypeA === undefined && routeTypeB === undefined) {
      return 0;
    }

    if (routeTypeA === undefined) {
      return 1;
    }

    if (routeTypeB === undefined) {
      return -1;
    }

    return routeTypeA - routeTypeB;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Uppdaterad {formatTime(lastUpdated)}
            </span>
          )}
        </div>
      </div>

      {sortedGroups.map((group) => (
        <StopGroupCard
          key={group.stopId}
          group={group}
          agencyId={agencyId}
          isCollapsed={collapsedStops.has(group.stopId)}
          onToggle={toggleStop}
        />
      ))}

      {!hasRealtimePositions && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          Avvikelser från tidtabellen inte tillgängliga än
        </div>
      )}
    </div>
  );
}

interface StopGroupCardProps {
  group: AreaDepartureGroup;
  agencyId?: string;
  isCollapsed: boolean;
  onToggle: (stopId: string) => void;
}

function StopGroupCard({
  group,
  agencyId,
  isCollapsed,
  onToggle,
}: StopGroupCardProps) {
  const open = !isCollapsed;

  if (group.departures.length === 0) {
    return null;
  }

  return (
    <Card className="overflow-hidden py-2">
      <CardHeader className={`px-4 ${open ? "py-3" : "pt-3 pb-0"}`}>
        <CardTitle>
          <button
            onClick={() => onToggle(group.stopId)}
            aria-expanded={open}
            aria-label={open ? "Dölj avgångar" : "Visa avgångar"}
            className="flex w-full items-baseline gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            <span className="text-base font-semibold">{group.stopName}</span>
            {group.platformCode && <span>({group.platformCode})</span>}
            <ChevronDown
              className="ml-auto h-4 w-4 self-center text-muted-foreground transition-transform duration-300"
              style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
            />
          </button>
          {!open && (
            <p className="mt-0.5 text-xs font-normal text-muted-foreground">
              {(() => {
                const count = Math.min(group.departures.length, 10);
                return count === 1
                  ? "1 dold avgång"
                  : `${count} dolda avgångar`;
              })()}
            </p>
          )}
        </CardTitle>
      </CardHeader>
      <div
        className="grid transition-all duration-300 ease-in-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <CardContent className="overflow-hidden p-0">
          <div className="divide-y divide-border/50">
            {group.departures.slice(0, 10).map((departure, index) => (
              <DepartureRow
                key={`${departure.tripId}-${departure.scheduledDeparture}-${index}`}
                departure={departure}
                agencyId={agencyId}
              />
            ))}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

function AreaDepartureBoardSkeleton() {
  return (
    <div className="space-y-5">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="overflow-hidden py-0">
          <CardHeader className="border-b border-border/50 bg-muted/40 px-4 py-3">
            <Skeleton className="h-4 w-28" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex items-center gap-3 px-3 py-3">
                  <Skeleton className="h-8 w-12 rounded-md" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-40" />
                  </div>
                  <Skeleton className="h-6 w-12" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
