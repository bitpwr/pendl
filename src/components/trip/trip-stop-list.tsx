"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RouteType, routeTypeColor } from "@/types/gtfs";
import { cn } from "@/lib/utils";
import {
  parseGtfsTime,
  getCurrentGtfsSeconds,
  formatDepartureTime,
  formatDelay,
} from "@/lib/gtfs/time-utils";

interface TripStop {
  stopId: string;
  areaId?: string;
  stopName: string;
  stopSequence: number;
  arrivalTime: string;
  departureTime: string;
  platform?: string;
  latitude: number;
  longitude: number;
  realtimeArrival?: string;
  realtimeDeparture?: string;
  delaySeconds?: number;
  isSkipped?: boolean;
}

interface TripStopListProps {
  stops: TripStop[];
  routeType: RouteType;
  routeName: string;
  agencyId?: string;
}

export function TripStopList({
  stops,
  routeType,
  routeName,
  agencyId,
}: TripStopListProps) {
  const routeColor = routeTypeColor(routeType, parseInt(routeName));
  // Calculate current time in GTFS seconds for comparison
  const currentSeconds = getCurrentGtfsSeconds();
  // Find the index of the next stop (first stop that hasn't passed yet)
  const nextStopIndex = stops.findIndex((stop) => {
    return (
      parseGtfsTime(stop.departureTime).totalSeconds +
        (stop.delaySeconds ?? 0) >=
        currentSeconds && !stop.isSkipped
    );
  });

  // Stops between the first stop and the one just before the current stop can
  // be collapsed into a single row. The count follows nextStopIndex, so it
  // stays up to date as the trip progresses.
  const [passedExpanded, setPassedExpanded] = useState(false);
  const collapsedCount = nextStopIndex > 1 ? nextStopIndex - 2 : 0;
  const isCollapsed = !passedExpanded && collapsedCount > 2;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-baseline gap-2 text-lg font-semibold">
          Hållplatser
          <span className="text-muted-foreground">({stops.length} stopp)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative">
          {/* Vertical line connecting stops */}
          <div
            className="absolute left-6 top-4 bottom-4 w-0.5"
            style={{ backgroundColor: routeColor }}
          />

          <ul className="divide-y">
            {stops.map((stop, index) => {
              if (isCollapsed && index >= 1 && index < nextStopIndex - 1) {
                if (index > 1) return null;
                return (
                  <li key={stop.stopSequence}>
                    <button
                      type="button"
                      onClick={() => setPassedExpanded(true)}
                      className="relative flex w-full items-center gap-4 py-2 px-4 text-left hover:bg-muted/50"
                    >
                      {/* Stop marker */}
                      <div className="relative z-10 flex items-center justify-center w-5 h-5">
                        <div
                          className="rounded-full border-2 w-3 h-3 border-dashed bg-background"
                          style={{ borderColor: routeColor }}
                        />
                      </div>

                      <span className="flex-1 min-w-0 text-sm text-muted-foreground">
                        {collapsedCount} hållplatser passerade
                      </span>

                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </li>
                );
              }

              const isFirst = index === 0;
              const isLast = index === stops.length - 1;
              const isPassed = index < nextStopIndex;
              const isNext = index === nextStopIndex;

              return (
                <li
                  key={stop.stopSequence}
                  className={cn(
                    "relative flex items-center gap-4 py-2 px-4",
                    stop.isSkipped && "opacity-50 line-through",
                    isPassed && "opacity-60",
                  )}
                >
                  {/* Stop marker */}
                  <div className="relative z-10 flex items-center justify-center w-5 h-5">
                    {isNext && (
                      <span
                        className="absolute inline-flex h-4 w-4 rounded-full opacity-80 animate-ping"
                        style={{ backgroundColor: routeColor }}
                      />
                    )}
                    <div
                      className={cn(
                        "rounded-full border-2",
                        isFirst || isLast ? "w-4 h-4" : "w-3 h-3",
                      )}
                      style={{
                        borderColor: routeColor,
                        backgroundColor: isFirst
                          ? "#22c55e"
                          : isLast
                            ? "#ef4444"
                            : isPassed
                              ? routeColor
                              : "#ffffff",
                        color: routeColor,
                      }}
                    />
                  </div>

                  {/* Stop info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/area/${encodeURIComponent(stop.areaId ?? "0")}${agencyId ? `?agency=${agencyId}` : ""}`}
                      className="hover:underline"
                    >
                      <p
                        className={cn(
                          "font-medium break-words",
                          (isFirst || isLast) && "font-semibold",
                        )}
                      >
                        {stop.stopName}
                      </p>
                    </Link>
                  </div>

                  {/* Times */}
                  <div className="text-right tabular-nums">
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        stop.delaySeconds &&
                          stop.delaySeconds > 180 &&
                          "text-amber-600 dark:text-amber-400",
                        stop.delaySeconds &&
                          stop.delaySeconds > 300 &&
                          "text-red-600 dark:text-red-400",
                      )}
                    >
                      {formatDepartureTime(stop)}
                    </p>
                    {stop.delaySeconds !== undefined &&
                      stop.delaySeconds > 0 && (
                        <p className="text-xs text-amber-600">
                          {formatDelay(stop.delaySeconds)}
                        </p>
                      )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
