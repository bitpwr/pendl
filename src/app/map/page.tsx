"use client";

import { useEffect, useRef } from "react";
import { VehicleMap } from "@/components/map/vehicle-map";
import { useAgency } from "@/hooks/use-agency";

export default function MapPage() {
  const { agencyId, agencyName } = useAgency();
  const lastReportedAgency = useRef<string | null>(null);

  useEffect(() => {
    document.title = "Karta | Pendl";
  }, []);

  useEffect(() => {
    if (lastReportedAgency.current === agencyName) return;
    lastReportedAgency.current = agencyName;

    void fetch("/api/analytics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key: "map",
        value: "",
        agency: agencyName,
      }),
      keepalive: true,
    });
  }, [agencyName]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Karta</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Se alla fordon i realtid på kartan.
        </p>
      </div>
      <VehicleMap height="calc(100vh - 172px)" agencyId={agencyId} />
    </div>
  );
}
