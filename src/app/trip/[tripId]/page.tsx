"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteBadge } from "@/components/departures/route-badge";
import { TripMap } from "@/components/trip/trip-map";
import { TripStopList } from "@/components/trip/trip-stop-list";
import { ArrowLeft, RefreshCw } from "lucide-react";
import type { RouteType } from "@/types/gtfs";

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

interface TripData {
  trip: {
    tripId: string;
    routeId: string;
    routeShortName: string;
    routeLongName: string;
    routeType: RouteType;
    headsign: string;
    directionId: number;
  };
  stops: TripStop[];
  shape: {
    type: "LineString";
    coordinates: [number, number][];
  } | null;
  vehicle: {
    vehicleId: string;
    latitude: number;
    longitude: number;
    bearing?: number;
    currentStatus: string;
    currentStopSequence?: number;
    timestamp: number;
  } | null;
  updatedAt: string;
}

export default function TripPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  const [data, setData] = useState<TripData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTrip = useCallback(async () => {
    try {
      const response = await fetch(`/api/trips/${encodeURIComponent(tripId)}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Resan hittades inte");
        }
        throw new Error("Kunde inte hämta reseinformation");
      }

      const tripData = await response.json();
      setData(tripData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Ett fel uppstod"));
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  // Scroll to top when page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    fetchTrip();

    // Refresh every 2 seconds for realtime updates
    const interval = setInterval(fetchTrip, 2000);
    return () => clearInterval(interval);
  }, [fetchTrip]);

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Resa</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <p className="text-destructive mb-2">{error.message}</p>
            <Button variant="outline" size="sm" onClick={fetchTrip}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Försök igen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-7 w-48" />
        </div>
        <Skeleton className="h-75 w-full rounded-lg" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <RouteBadge
            shortName={data.trip.routeShortName}
            routeType={data.trip.routeType}
            size="lg"
          />
          <h1 className="text-xl font-bold">{data.stops.at(-1)?.stopName}</h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={fetchTrip}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
              data.vehicle ? "animate-ping bg-green-400" : "bg-red-400"
            }`}
          ></span>
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              data.vehicle ? "bg-green-500" : "bg-red-500"
            }`}
          ></span>
        </span>
        {data.vehicle
          ? "Realtidsposition tillgänglig"
          : "Realtidsposition inte tillgänglig"}
      </div>

      <TripMap
        shape={data.shape}
        stops={data.stops}
        vehicle={data.vehicle}
        routeType={data.trip.routeType}
        routeName={data.trip.routeShortName}
        height="300px"
      />

      <TripStopList
        stops={data.stops}
        vehicle={data.vehicle}
        routeType={data.trip.routeType}
      />
    </div>
  );
}
