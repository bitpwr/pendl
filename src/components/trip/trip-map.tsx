"use client";

import { Suspense, lazy, useSyncExternalStore } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { TripMapProps } from "./trip-map-inner";

// One lazy boundary rather than one per react-leaflet primitive. Besides the
// loader component that wrapped every marker, next/dynamic keeps the ref for
// itself, so nothing could reach a Leaflet instance to drive the vehicle.
const TripMapInner = lazy(() => import("./trip-map-inner"));

export function TripMap({ height = "300px", ...props }: TripMapProps) {
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Leaflet touches `window` on import, so the inner module must not be
  // reached during SSR or the first hydrating render.
  if (!isClient) {
    return <Skeleton style={{ height }} className="rounded-lg" />;
  }

  return (
    <Suspense fallback={<Skeleton style={{ height }} className="rounded-lg" />}>
      <TripMapInner height={height} {...props} />
    </Suspense>
  );
}
