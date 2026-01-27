'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DepartureRow } from './departure-row';
import { RefreshCw, AlertTriangle, Clock } from 'lucide-react';
import type { DepartureResponse } from '@/types/api';
import { formatTime } from '@/lib/gtfs/time-utils';

interface DepartureBoardProps {
  data?: DepartureResponse;
  isLoading?: boolean;
  error?: Error | null;
  onRefresh?: () => void;
  lastUpdated?: Date;
}

export function DepartureBoard({
  data,
  isLoading,
  error,
  onRefresh,
  lastUpdated,
}: DepartureBoardProps) {
  if (isLoading && !data) {
    return <DepartureBoardSkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive mb-2" />
          <p className="font-medium">Kunde inte ladda avgångar</p>
          <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
          {onRefresh && (
            <Button variant="outline" size="sm" className="mt-4" onClick={onRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Försök igen
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!data || data.departures.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <Clock className="mx-auto h-8 w-8 mb-2 opacity-50" />
          <p>Inga avgångar hittades</p>
          <p className="text-sm mt-1">Det finns inga avgångar de närmaste timmarna</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{data.stopName}</CardTitle>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground">
                Uppdaterad {formatTime(lastUpdated)}
              </span>
            )}
            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {data.departures.map((departure, index) => (
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

function DepartureBoardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-0">
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-8 w-16 rounded" />
              <div className="flex-1">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-20 mt-1" />
              </div>
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
