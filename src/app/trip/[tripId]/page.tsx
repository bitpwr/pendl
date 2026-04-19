"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteBadge } from "@/components/departures/route-badge";
import { TripMap } from "@/components/trip/trip-map";
import { TripStopList } from "@/components/trip/trip-stop-list";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { routeTypeName, type RouteType } from "@/types/gtfs";
import { getAgencyName } from "@/lib/config/agencies";

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

interface StopRealtime {
  stopId: string;
  stopSequence: number;
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
  updatedAt: string;
}

interface TripVehicle {
  vehicleId: string;
  lat: number;
  long: number;
  bearing?: number;
  speed?: number;
  currentStatus: string;
  timestamp: number;
  routeType: RouteType;
  routeShortName: string | null;
  headsign: string | null;
}

export default function TripPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripId = params.tripId as string;
  const agencyId = searchParams.get("agency") || undefined;
  const agencyParam = agencyId
    ? `?agencyId=${encodeURIComponent(agencyId)}`
    : "";

  const [data, setData] = useState<TripData | null>(null);
  const [shape, setShape] = useState<{
    type: "LineString";
    coordinates: [number, number][];
  } | null>(null);
  const [vehicle, setVehicle] = useState<TripVehicle | null>(null);
  const [realtimeStops, setRealtimeStops] = useState<StopRealtime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const lastLoggedTripId = useRef<string | null>(null);

  const fetchTrip = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}${agencyParam}`,
      );

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
  }, [tripId, agencyParam]);

  const fetchShape = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/shape`,
      );
      if (response.ok) {
        const shapeData = await response.json();
        setShape(shapeData.shape ?? null);
      }
    } catch {
      // Shape is optional; fall back to no shape.
    }
  }, [tripId]);

  const fetchVehicle = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/vehicle${agencyParam}`,
      );

      if (!response.ok) {
        throw new Error("Kunde inte hämta fordonsposition");
      }

      const vehicleData = await response.json();
      setVehicle(vehicleData.vehicle ?? null);
    } catch {
      // Vehicle data is optional; fall back to no realtime position.
      setVehicle(null);
    }
  }, [tripId, agencyParam]);

  const fetchRealtime = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/realtime${agencyParam}`,
      );
      if (response.ok) {
        const realtimeData = await response.json();
        setRealtimeStops(realtimeData.stops ?? []);
      }
    } catch {
      // Realtime data is optional; keep previous values.
    }
  }, [tripId, agencyParam]);

  // Scroll to top when page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    // Fetch trip and shape once — static data does not change during the trip view.
    fetchTrip();
    fetchVehicle();
    fetchRealtime();

    // Refresh vehicle position frequently for smooth realtime movement.
    const vehicleInterval = setInterval(fetchVehicle, 2000);
    // Refresh realtime stop data at a lower rate.
    const realtimeInterval = setInterval(fetchRealtime, 15000);

    return () => {
      clearInterval(vehicleInterval);
      clearInterval(realtimeInterval);
    };
  }, [fetchTrip, fetchVehicle, fetchRealtime]);

  // Fetch shape once — it does not change during the trip view.
  useEffect(() => {
    void fetchShape();
  }, [fetchShape]);

  useEffect(() => {
    if (!data?.trip?.tripId || !data.trip.routeShortName) {
      return;
    }

    if (lastLoggedTripId.current === data.trip.tripId) {
      return;
    }

    lastLoggedTripId.current = data.trip.tripId;

    void fetch("/api/analytics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key: "trip",
        value: `${routeTypeName(data.trip.routeType)} ${data.trip.routeShortName}`,
        agency: getAgencyName(agencyId ?? ""),
      }),
      keepalive: true,
    });
  }, [
    data?.trip?.tripId,
    data?.trip?.routeType,
    data?.trip?.routeShortName,
    agencyId,
  ]);

  useEffect(() => {
    if (!data || !data.trip || !data.stops) {
      return;
    }

    const title = `${routeTypeName(data.trip.routeType)} ${data.trip.routeShortName} mot ${data.stops.at(-1)?.stopName}`;

    document.title = `${title} | Pendl`;
  }, [data]);

  if (error) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Resa</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8">
            <p className="text-destructive font-medium mb-3">{error.message}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void fetchTrip();
                void fetchVehicle();
                void fetchRealtime();
              }}
            >
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
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-7 w-48" />
        </div>
        <Skeleton className="h-75 w-full rounded-xl" />
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

  const realtimeMap = new Map(realtimeStops.map((r) => [r.stopSequence, r]));
  const stopsWithRealtime = data.stops.map((stop) => {
    const rt = realtimeMap.get(stop.stopSequence);
    if (!rt) return stop;
    return {
      ...stop,
      realtimeArrival: rt.realtimeArrival,
      realtimeDeparture: rt.realtimeDeparture,
      delaySeconds: rt.delaySeconds,
      isSkipped: rt.isSkipped,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <RouteBadge
            shortName={data.trip.routeShortName}
            routeType={data.trip.routeType}
            size="lg"
          />
          <h1 className="text-xl font-bold">{data.stops.at(-1)?.stopName}</h1>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
              vehicle ? "animate-ping bg-green-400" : "bg-red-400"
            }`}
          ></span>
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              vehicle ? "bg-green-500" : "bg-red-500"
            }`}
          ></span>
        </span>
        {vehicle
          ? "Realtidsposition tillgänglig"
          : "Realtidsposition inte tillgänglig än"}
      </div>

      <TripMap
        shape={shape}
        stops={stopsWithRealtime}
        vehicle={vehicle}
        routeType={data.trip.routeType}
        routeName={data.trip.routeShortName}
        height="300px"
      />

      <TripStopList
        stops={stopsWithRealtime}
        routeType={data.trip.routeType}
        routeName={data.trip.routeShortName}
        agencyId={agencyId}
      />
    </div>
  );
}
