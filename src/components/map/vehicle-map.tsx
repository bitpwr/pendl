"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Locate } from "lucide-react";
import type { Vehicle } from "@/types/api";
import { routeTypeColor, routeTypeName, RouteType } from "@/types/gtfs";
import { createVehicleLeafletIcon } from "./vehicle-arrow-icon";

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false },
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false },
);
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), {
  ssr: false,
});
const CircleMarker = dynamic(
  () => import("react-leaflet").then((mod) => mod.CircleMarker),
  { ssr: false },
);

interface VehicleMapProps {
  center?: [number, number];
  zoom?: number;
  height?: string;
}

// Stockholm default center
const DEFAULT_CENTER: [number, number] = [59.3293, 18.0686];
const DEFAULT_ZOOM = 10;

export function VehicleMap({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  height = "400px",
}: VehicleMapProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>();
  const [mapCenter, setMapCenter] = useState(center);
  const [isClient, setIsClient] = useState(false);
  const [selectedRouteType, setSelectedRouteType] = useState<RouteType | null>(
    null,
  );
  const [locateKey, setLocateKey] = useState(0);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null,
  );

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchVehicles = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const url =
        selectedRouteType !== null
          ? `/api/vehicles?routeType=${selectedRouteType}`
          : "/api/vehicles";

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Kunde inte hämta fordonspositioner");
      }

      const data = await response.json();
      setVehicles(data.vehicles || []);
      setLastUpdated(new Date(data.updatedAt));
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Okänt fel"));
    } finally {
      setIsLoading(false);
    }
  }, [selectedRouteType]);

  useEffect(() => {
    fetchVehicles();

    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchVehicles, 10000);
    return () => clearInterval(interval);
  }, [fetchVehicles, selectedRouteType]);

  const handleLocateMe = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: [number, number] = [
            position.coords.latitude,
            position.coords.longitude,
          ];
          setMapCenter(location);
          setUserLocation(location);
          setLocateKey((prev) => prev + 1);
        },
        (err) => {
          console.error("Geolocation error:", err);
        },
      );
    } else {
      alert("Din webbläsare stödjer inte positionering");
    }
  };

  // Create vehicle markers only on client
  const vehicleMarkers = useMemo(() => {
    if (!isClient) return null;
    return vehicles.map((vehicle) => (
      <VehicleMarker key={vehicle.vehicleId} vehicle={vehicle} />
    ));
  }, [vehicles, isClient]);

  if (!isClient) {
    return <MapSkeleton height={height} />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-6">
          <p className="text-destructive mb-2">Kunde inte ladda karta</p>
          <Button variant="outline" size="sm" onClick={fetchVehicles}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Försök igen
          </Button>
        </CardContent>
      </Card>
    );
  }

  const routeTypes = [
    { type: RouteType.Metro, label: "Tunnelbana" },
    { type: RouteType.Tram, label: "Spårvagn" },
    { type: RouteType.Train, label: "Pendeltåg" },
    { type: RouteType.Bus, label: "Buss" },
    { type: RouteType.Ferry, label: "Båt" },
  ];

  return (
    <Card>
      <CardHeader className="pb-2 space-y-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            Fordon i realtid
            {vehicles.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({vehicles.length} fordon)
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground">
                Uppdaterad{" "}
                {lastUpdated.toLocaleTimeString("sv-SE", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleLocateMe}
              title="Min position"
            >
              <Locate className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={fetchVehicles}
              disabled={isLoading}
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedRouteType === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedRouteType(null)}
            className="h-8 text-xs"
          >
            Alla
          </Button>
          {routeTypes.map(({ type, label }) => {
            const colors = routeTypeColor(type);
            return (
              <Button
                key={type}
                variant={selectedRouteType === type ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedRouteType(type)}
                className="h-8 text-xs"
                style={
                  selectedRouteType === type
                    ? {
                        backgroundColor: colors.bg,
                        color: colors.text,
                        borderColor: colors.bg,
                      }
                    : undefined
                }
              >
                {label}
              </Button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div
          style={{ height }}
          className="relative rounded-b-lg overflow-hidden"
        >
          <MapContainer
            center={mapCenter}
            zoom={zoom}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
          >
            <MapUpdater center={mapCenter} locateKey={locateKey} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {userLocation && (
              <CircleMarker
                center={userLocation}
                radius={8}
                fillColor="#3B82F6"
                color="#FFFFFF"
                weight={3}
                fillOpacity={0.8}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-bold">Din position</p>
                  </div>
                </Popup>
              </CircleMarker>
            )}
            {vehicleMarkers}
          </MapContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// MapUpdater component must be inside MapContainer to access useMap
const MapUpdater = dynamic(
  () =>
    import("react-leaflet").then((mod) => {
      const { useMap } = mod;

      return function MapUpdaterComponent({
        center,
        locateKey,
      }: {
        center: [number, number];
        locateKey: number;
      }) {
        const map = useMap();

        useEffect(() => {
          if (locateKey > 0) {
            map.flyTo(center, 12, { duration: 1.5 });
          }
        }, [locateKey, center, map]);

        return null;
      };
    }),
  { ssr: false },
);

interface VehicleMarkerProps {
  vehicle: Vehicle;
}

function VehicleMarker({ vehicle }: VehicleMarkerProps) {
  const [L, setL] = useState<typeof import("leaflet") | null>(null);

  useEffect(() => {
    // Import Leaflet only on client side
    import("leaflet").then((leaflet) => setL(leaflet));
  }, []);

  if (!L) return null;

  // Get the color for this route type
  const bearing = vehicle.bearing ?? 0;

  // Create custom arrow icon
  const icon = createVehicleLeafletIcon(L, vehicle.routeType, bearing);

  return (
    <>
      <style jsx global>{`
        .vehicle-marker {
          background: transparent !important;
          border: none !important;
        }
      `}</style>
      <Marker position={[vehicle.latitude, vehicle.longitude]} icon={icon}>
        <Popup>
          <div className="text-sm">
            <p className="font-bold">
              {routeTypeName(vehicle.routeType)} {vehicle.routeShortName ?? ""}
            </p>
            <a
              href={`/trip/${vehicle.tripId}`}
              className="text-blue-600 hover:underline mt-1 inline-block"
            >
              Visa resa
            </a>
          </div>
        </Popup>
      </Marker>
    </>
  );
}

function MapSkeleton({ height }: { height: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-8" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Skeleton style={{ height }} className="rounded-b-lg" />
      </CardContent>
    </Card>
  );
}
