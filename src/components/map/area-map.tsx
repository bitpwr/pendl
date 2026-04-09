"use client";

import { useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false },
);
const CircleMarker = dynamic(
  () => import("react-leaflet").then((mod) => mod.CircleMarker),
  { ssr: false },
);
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), {
  ssr: false,
});

interface AreaMapProps {
  latitude: number;
  longitude: number;
  areaName: string;
  height?: string;
}

export function AreaMap({
  latitude,
  longitude,
  areaName,
  height = "250px",
}: AreaMapProps) {
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!isClient) {
    return <Skeleton style={{ height }} className="rounded-lg" />;
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div style={{ height }} className="relative rounded-lg overflow-hidden">
          <MapContainer
            center={[latitude, longitude]}
            zoom={12}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <CircleMarker
              center={[latitude, longitude]}
              radius={10}
              fillColor="#2563EB"
              color="#1d4ed8"
              weight={2}
              fillOpacity={0.9}
            >
              <Popup>
                <span className="font-semibold">{areaName}</span>
              </Popup>
            </CircleMarker>
          </MapContainer>
        </div>
      </CardContent>
    </Card>
  );
}
