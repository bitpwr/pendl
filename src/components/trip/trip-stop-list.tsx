"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RouteType, routeTypeColor } from "@/types/gtfs";
import { cn } from "@/lib/utils";
import { parseGtfsTime, getCurrentGtfsSeconds } from "@/lib/gtfs/time-utils";

interface TripStop {
  stopId: string;
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

interface Vehicle {
  vehicleId: string;
  latitude: number;
  longitude: number;
  bearing?: number;
  currentStatus: string;
  currentStopSequence?: number;
}

interface TripStopListProps {
  stops: TripStop[];
  vehicle: Vehicle | null;
  routeType: RouteType;
  routeName: string;
}

export function TripStopList({
  stops,
  routeType,
  routeName,
}: TripStopListProps) {
  const routeColor = routeTypeColor(routeType, parseInt(routeName));
  // Calculate current time in GTFS seconds for comparison
  const currentSeconds = getCurrentGtfsSeconds();

  // Helper to format GTFS time (HH:MM:SS) to display (HH:MM)
  const formatGtfsTime = (gtfsTime: string) => {
    const parsed = parseGtfsTime(gtfsTime);
    const h = parsed.hours.toString().padStart(2, "0");
    const m = parsed.minutes.toString().padStart(2, "0");
    return `${h}:${m}`;
  };

  // Get actual departure time considering realtime updates
  const formatDepartureTime = (stop: TripStop) => {
    if (stop.delaySeconds && stop.delaySeconds !== 0) {
      // Add delay to scheduled time
      const parsed = parseGtfsTime(stop.departureTime);
      const delayedSeconds = parsed.totalSeconds + stop.delaySeconds;
      const h = Math.floor(delayedSeconds / 3600) % 24;
      const m = Math.floor((delayedSeconds % 3600) / 60);
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    }

    // Fall back to scheduled time
    return formatGtfsTime(stop.departureTime);
  };

  // Find the index of the next stop (first stop that hasn't passed yet)
  const nextStopIndex = stops.findIndex((stop) => {
    return (
      parseGtfsTime(stop.departureTime).totalSeconds +
        (stop.delaySeconds ?? 0) >=
        currentSeconds && !stop.isSkipped
    );
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Hållplatser ({stops.length})</CardTitle>
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
              const isFirst = index === 0;
              const isLast = index === stops.length - 1;
              const isPassed = index < nextStopIndex;
              const isNext = index === nextStopIndex;

              return (
                <li
                  key={`${stop.stopId}-${stop.stopSequence}`}
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
                        className="absolute inline-flex h-4 w-4 rounded-full opacity-40 animate-ping"
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
                      href={`/stop/${encodeURIComponent(stop.stopId)}`}
                      className="hover:underline"
                    >
                      <p
                        className={cn(
                          "font-medium truncate",
                          (isFirst || isLast) && "font-semibold",
                        )}
                      >
                        {stop.stopName}
                      </p>
                    </Link>
                  </div>

                  {/* Times */}
                  <div className="text-right">
                    <p
                      className={cn(
                        "font-mono text-sm",
                        stop.delaySeconds &&
                          stop.delaySeconds > 60 &&
                          "text-amber-600",
                        stop.delaySeconds &&
                          stop.delaySeconds > 300 &&
                          "text-red-600",
                      )}
                    >
                      {formatDepartureTime(stop)}
                    </p>
                    {stop.delaySeconds !== undefined &&
                      stop.delaySeconds > 0 && (
                        <p className="text-xs text-amber-600">
                          +{Math.round(stop.delaySeconds / 60)} min
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
