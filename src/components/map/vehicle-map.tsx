"use client";

import { Suspense, lazy, useSyncExternalStore } from "react";
import { MapSkeleton } from "./map-skeleton";

interface VehicleMapProps {
  center?: [number, number];
  zoom?: number;
  height?: string;
  agencyId?: string;
}

// One lazy boundary around the whole map instead of one per react-leaflet
// primitive. Wrapping each primitive individually put a loader component
// around every marker, and next/dynamic's LoadableComponent claims the ref
// for itself - so `ref` on a Marker never reached the Leaflet instance.
// Importing react-leaflet normally inside vehicle-map-inner keeps refs real.
const VehicleMapInner = lazy(() => import("./vehicle-map-inner"));

export function VehicleMap({ height = "400px", ...props }: VehicleMapProps) {
  // Same client check area-map.tsx uses.
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Leaflet touches `window` on import, so the inner module must not be
  // reached during SSR or the first hydrating render.
  if (!isClient) {
    return <MapSkeleton height={height} />;
  }

  return (
    <Suspense fallback={<MapSkeleton height={height} />}>
      <VehicleMapInner height={height} {...props} />
    </Suspense>
  );
}
