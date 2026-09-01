"use client";

import { useEffect, useRef, useState } from "react";
import type { Marker as LeafletMarker } from "leaflet";
import {
  MAX_ANIMATED_DEGREES,
  POSITION_ANIMATION_MS,
  interpolate,
  prefersReducedMotion,
  samePosition,
  shouldSnap,
  type Position,
} from "./marker-animation";

export interface AnimatedMarker {
  /** Attach to the react-leaflet Marker. */
  markerRef: React.RefObject<LeafletMarker | null>;
  /**
   * Pass as the Marker's `position`.
   *
   * It is pinned to where the marker mounted so react-leaflet never calls
   * setLatLng itself: its update is `props.position !== prevProps.position`,
   * and a fresh array each render would snap the marker to the target before
   * every animation frame. After mount the position belongs to the animation.
   */
  mountPosition: Position;
}

/**
 * Slide a marker to each new position rather than letting it jump.
 *
 * Runs outside React on requestAnimationFrame: re-rendering to move a marker
 * would cost far more than the jump it smooths.
 */
export function useAnimatedMarker(lat: number, lon: number): AnimatedMarker {
  const markerRef = useRef<LeafletMarker | null>(null);
  const [mountPosition] = useState<Position>(() => [lat, lon]);
  const drawnPosition = useRef<Position>([lat, lon]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const from = drawnPosition.current;
    const to: Position = [lat, lon];

    if (samePosition(from, to)) return;

    if (shouldSnap(from, to, MAX_ANIMATED_DEGREES) || prefersReducedMotion()) {
      drawnPosition.current = to;
      marker.setLatLng(to);
      return;
    }

    const startedAt = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / POSITION_ANIMATION_MS);
      const next = interpolate(from, to, progress);

      drawnPosition.current = next;
      marker.setLatLng(next);

      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };

    let frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
  }, [lat, lon]);

  return { markerRef, mountPosition };
}
