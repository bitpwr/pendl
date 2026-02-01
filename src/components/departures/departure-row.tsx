"use client";

import Link from "next/link";
import { RouteBadge } from "./route-badge";
import { DepartureTime } from "./departure-time";
import type { Departure } from "@/types/api";
import { cn } from "@/lib/utils";

interface DepartureRowProps {
  departure: Departure;
}

export function DepartureRow({ departure }: DepartureRowProps) {
  const scheduledTime = new Date(departure.scheduledDeparture);
  const realtimeTime = departure.realtimeDeparture
    ? new Date(departure.realtimeDeparture)
    : undefined;
  const isRealtime = !!departure.realtimeDeparture;

  return (
    <Link
      href={`/trip/${departure.tripId}`}
      className={cn(
        "flex items-center gap-4 p-4 transition-colors hover:bg-accent/50",
        departure.isCancelled && "opacity-60",
      )}
    >
      <RouteBadge
        shortName={departure.routeShortName}
        routeType={departure.routeType}
        size="md"
      />

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{departure.headsign}</p>
        {departure.platform && (
          <p className="text-sm text-muted-foreground">
            Läge {departure.platform}
          </p>
        )}
      </div>

      <DepartureTime
        scheduledTime={scheduledTime}
        predictedTime={realtimeTime}
        isRealtime={isRealtime}
        isCancelled={departure.isCancelled}
      />
    </Link>
  );
}
