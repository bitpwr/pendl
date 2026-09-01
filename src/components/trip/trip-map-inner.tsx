"use client";

import { useMemo, Fragment } from "react";
import * as L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  CircleMarker,
  Pane,
} from "react-leaflet";
import { Card, CardContent } from "@/components/ui/card";
import { RouteType, routeTypeColor, routeTypeName } from "@/types/gtfs";
import { createVehicleLeafletIcon } from "@/components/map/vehicle-arrow-icon";
import Link from "next/link";
import { formatDepartureTime } from "@/lib/gtfs/time-utils";

interface TripStop {
  stopId: string;
  areaId?: string;
  stopName: string;
  stopSequence: number;
  latitude: number;
  longitude: number;
  departureTime: string;
  realtimeDeparture?: string;
  delaySeconds?: number;
}

interface Vehicle {
  id: string;
  lat: number;
  lon: number;
  bearing?: number;
  currentStatus: string;
  speed?: number;
}

export interface TripMapProps {
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

export default function TripMapInner({
  shape,
  stops,
  vehicle,
  routeType,
  routeName,
  height = "300px",
}: TripMapProps) {
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

  const routeColor = routeTypeColor(routeType, parseInt(routeName));

  // Convert shape coordinates from [lon, lat] to [lat, lon] for Leaflet
  const polylinePositions = useMemo(() => {
    if (!shape) return null;
    return shape.coordinates.map(
      ([lon, lat]) => [lat, lon] as [number, number],
    );
  }, [shape]);

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

            {/* Route shape — rendered in a pane below the overlay pane (z-index 400)
                so stop circles always appear on top regardless of load order */}
            <Pane name="shape-pane" style={{ zIndex: 350 }}>
              {polylinePositions && (
                <Polyline
                  positions={polylinePositions}
                  color={routeColor}
                  weight={4}
                  opacity={0.7}
                />
              )}
            </Pane>

            {/* Stop markers */}
            {stops.map((stop, index) => (
              <Fragment key={stop.stopSequence}>
                {/* Visual circle (non-interactive) */}
                <CircleMarker
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
                  weight={1.5}
                  fillOpacity={1}
                  interactive={false}
                />
                {/* Larger transparent touch/hover target */}
                <CircleMarker
                  center={[stop.latitude, stop.longitude]}
                  radius={20}
                  fillOpacity={0}
                  opacity={0}
                  eventHandlers={{
                    mouseover: (e) => e.target.openPopup(),
                    mouseout: (e) => e.target.closePopup(),
                  }}
                >
                  <Popup>
                    <div className="text-sm">
                      <Link
                        href={`/area/${encodeURIComponent(stop.areaId ?? "0")}`}
                        className="font-bold text-inherit! no-underline hover:underline"
                      >
                        {stop.stopName}
                      </Link>
                      <div className="text-gray-600 mt-1">
                        {formatDepartureTime(stop)}
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              </Fragment>
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

const VEHICLE_ICON_SIZE = 40;

function VehicleMarker({ vehicle, routeType, routeName }: VehicleMarkerProps) {
  const bearing = vehicle.bearing ?? 0;
  const speedMps = vehicle.speed ?? 0;
  const color = routeTypeColor(routeType, parseInt(routeName));

  // Shared cache, so this is a lookup rather than a new DivIcon each render.
  const icon = useMemo(
    () => createVehicleLeafletIcon(L, color, bearing, VEHICLE_ICON_SIZE),
    [color, bearing],
  );

  return (
    <>
      <Marker position={[vehicle.lat, vehicle.lon]} icon={icon}>
        <Popup>
          <div className="text-sm font-bold">
            {routeTypeName(routeType)} {routeName}
          </div>{" "}
          {speedMps > 0 && (
            <div className="text-gray-600 mt-1">
              {routeType === RouteType.Ferry
                ? `Hastighet: ${(speedMps * 1.94).toFixed(0)} knop`
                : `Hastighet: ${(speedMps * 3.6).toFixed(0)} km/h`}
            </div>
          )}
        </Popup>
      </Marker>
    </>
  );
}
