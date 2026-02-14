"use client";

import { VehicleMap } from "@/components/map/vehicle-map";

export default function MapPage() {
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
