"use client";

import { useEffect, useRef } from "react";
import { VehicleMap } from "@/components/map/vehicle-map";

export default function MapPage() {
  const hasLoggedMapView = useRef(false);

  useEffect(() => {
    if (hasLoggedMapView.current) {
      return;
    }

    hasLoggedMapView.current = true;

    void fetch("/api/analytics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key: "map",
        value: "",
      }),
      keepalive: true,
    });
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Karta</h1>
      <p className="text-muted-foreground">
        Se alla fordon i realtid på kartan.
      </p>
      <VehicleMap height="calc(100vh - 200px)" />
    </div>
  );
}
