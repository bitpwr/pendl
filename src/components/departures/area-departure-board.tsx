"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DepartureRow } from "./departure-row";
import { RefreshCw, AlertTriangle, Clock } from "lucide-react";
import type { AreaDepartureResponse, AreaDepartureGroup } from "@/types/api";
import { formatTime } from "@/lib/gtfs/time-utils";

interface AreaDepartureBoardProps {
  data?: AreaDepartureResponse;
  isLoading?: boolean;
  error?: Error | null;
  onRefresh?: () => void;
  lastUpdated?: Date;
}

export function AreaDepartureBoard({
  data,
  isLoading,
  error,
  onRefresh,
  lastUpdated,
}: AreaDepartureBoardProps) {
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
        {onRefresh && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>
        )}
      </div>

      {!hasRealtimePositions && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          Avvikelser från tidtabellen inte tillgängliga
        </div>
      )}

      {data.groups.map((group) => (
        <StopGroupCard key={group.stopId} group={group} />
      ))}
    </div>
  );
}

interface StopGroupCardProps {
  group: AreaDepartureGroup;
}

function StopGroupCard({ group }: StopGroupCardProps) {
  if (group.departures.length === 0) {
    return null;
  }

  return (
    <Card className="overflow-hidden py-2">
      <CardHeader className="px-4 py-3">
        <CardTitle className="flex items-baseline gap-2">
          <span className="text-base font-semibold">{group.stopName}</span>
          {group.platformCode && <span>({group.platformCode})</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/50">
          {group.departures.slice(0, 8).map((departure, index) => (
            <DepartureRow
              key={`${departure.tripId}-${departure.scheduledDeparture}-${index}`}
              departure={departure}
            />
          ))}
        </div>
      </CardContent>
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
