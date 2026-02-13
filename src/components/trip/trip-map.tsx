"use client";

import { useMemo, useSyncExternalStore, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteType, routeTypeColor, routeTypeName } from "@/types/gtfs";
import { createVehicleLeafletIcon } from "@/components/map/vehicle-arrow-icon";

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
const Polyline = dynamic(
  () => import("react-leaflet").then((mod) => mod.Polyline),
  { ssr: false },
);
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), {
  ssr: false,
});
const CircleMarker = dynamic(
  () => import("react-leaflet").then((mod) => mod.CircleMarker),
  { ssr: false },
);

interface TripStop {
  stopId: string;
  stopName: string;
  stopSequence: number;
  latitude: number;
  longitude: number;
}

interface Vehicle {
  vehicleId: string;
  latitude: number;
  longitude: number;
  bearing?: number;
  currentStatus: string;
  currentStopSequence?: number;
}

interface TripMapProps {
  shape: {
    type: "LineString";
    coordinates: [number, number][];
  } | null;
  stops: TripStop[];
  vehicle: Vehicle | null;
  routeType: RouteType;
  routeName: string;
  height?: string;
}

export function TripMap({
  shape,
  stops,
  vehicle,
  routeType,
  routeName,
  height = "300px",
}: TripMapProps) {
  // Use useSyncExternalStore to check if we're on the client
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Calculate bounds from shape or stops
  const bounds = useMemo(() => {
    const points: [number, number][] = [];

    if (shape) {
      shape.coordinates.forEach(([lon, lat]) => {
        points.push([lat, lon]);
      });
    }

    stops.forEach((stop) => {
      points.push([stop.latitude, stop.longitude]);
    });

    if (points.length === 0) {
      // Default to Stockholm
      return [
        [59.28, 18.0],
        [59.38, 18.12],
      ] as [[number, number], [number, number]];
    }

    const lats = points.map((p) => p[0]);
    const lons = points.map((p) => p[1]);

    const padding = 0.0;
    return [
      [Math.min(...lats) - padding, Math.min(...lons) - padding],
      [Math.max(...lats) + padding, Math.max(...lons) + padding],
    ] as [[number, number], [number, number]];
  }, [shape, stops]);

  const routeColor = routeTypeColor(routeType).bg;

  // Convert shape coordinates from [lon, lat] to [lat, lon] for Leaflet
  const polylinePositions = useMemo(() => {
    if (!shape) return null;
    return shape.coordinates.map(
      ([lon, lat]) => [lat, lon] as [number, number],
    );
  }, [shape]);

  if (!isClient) {
    return <Skeleton style={{ height }} className="rounded-lg" />;
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div style={{ height }} className="relative rounded-lg overflow-hidden">
          <MapContainer
            bounds={bounds}
            boundsOptions={{ padding: [0, 0] }}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Route shape */}
            {polylinePositions && (
              <Polyline
                positions={polylinePositions}
                color={routeColor}
                weight={4}
                opacity={0.8}
              />
            )}

            {/* Stop markers */}
            {stops.map((stop, index) => (
              <CircleMarker
                key={stop.stopId}
                center={[stop.latitude, stop.longitude]}
                radius={index === 0 || index === stops.length - 1 ? 8 : 5}
                fillColor={
                  index === 0
                    ? "#22c55e"
                    : index === stops.length - 1
                      ? "#ef4444"
                      : "#ffffff"
                }
                color={routeColor}
                weight={2}
                fillOpacity={1}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-bold">{stop.stopName}</p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {/* Vehicle marker */}
            {vehicle && (
              <VehicleMarker
                vehicle={vehicle}
                routeType={routeType}
                routeName={routeName}
              />
            )}
          </MapContainer>
        </div>
      </CardContent>
    </Card>
  );
}

interface VehicleMarkerProps {
  vehicle: Vehicle;
  routeType: RouteType;
  routeName: string;
}

function VehicleMarker({ vehicle, routeType, routeName }: VehicleMarkerProps) {
  const [L, setL] = useState<typeof import("leaflet") | null>(null);

  useEffect(() => {
    // Import Leaflet only on client side
    import("leaflet").then((leaflet) => setL(leaflet));
  }, []);

  if (!L) return null;

  const bearing = vehicle.bearing ?? 0;
  const icon = createVehicleLeafletIcon(L, routeType, bearing, 48);

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
              {routeTypeName(routeType)} {routeName}
            </p>
          </div>
        </Popup>
      </Marker>
    </>
  );
}
