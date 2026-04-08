"use client";

import { useEffect, useRef } from "react";
import { VehicleMap } from "@/components/map/vehicle-map";
import { useAgency } from "@/hooks/use-agency";

export default function MapPage() {
  const { agencyId, agencyName, setAgency, agencies } = useAgency();
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
        <div className="flex items-center gap-2 mt-3">
          <label htmlFor="agency-select" className="text-sm font-medium">
            Trafikbolag
          </label>
          <select
            id="agency-select"
            value={agencyId}
            onChange={(e) => setAgency(e.target.value as typeof agencyId)}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <VehicleMap height="calc(100vh - 220px)" agencyId={agencyId} />
    </div>
  );
}
