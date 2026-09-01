import type { DivIcon } from "leaflet";

/**
 * Bearings are snapped to this many degrees before an icon is built.
 *
 * A vehicle's bearing changes on almost every tick, and a fresh icon makes
 * Leaflet call setIcon, which tears down and rebuilds the marker's DOM
 * element. Snapping means a marker only rebuilds when it actually turns, at
 * a worst-case visual error of half a bucket.
 */
const BEARING_BUCKET_DEGREES = 15;

function snapBearing(bearing: number): number {
  const snapped =
    Math.round(bearing / BEARING_BUCKET_DEGREES) * BEARING_BUCKET_DEGREES;
  // Keep 0 and 360 as the same bucket, and cope with negative bearings.
  return ((snapped % 360) + 360) % 360;
}

/**
 * Creates an arrow-shaped SVG icon for a vehicle marker
 * @param color - Fill color for the arrow
 * @param bearing - The direction the vehicle is facing in degrees (0 = North)
 * @param size - The size of the icon in pixels (default: 32)
 * @returns HTML string containing the SVG
 */
export function createVehicleArrowIcon(
  color: string,
  bearing: number = 0,
  size: number = 32,
): string {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(${bearing} 16 16)">
        <!-- Main arrow -->
        <path d="M 16 4 L 24 26 L 16 23 L 8 26 Z"
              fill="${color}"
              stroke="#FFFFFF"
              stroke-width="0.8" />
      </g>
    </svg>
  `;
}

// A DivIcon is immutable once built and Leaflet calls createIcon() per marker,
// so one instance is safely shared by every vehicle drawn the same way. With
// bearings snapped there are only a few hundred distinct combinations, versus
// one new icon per vehicle per tick.
const iconCache = new Map<string, DivIcon>();

/**
 * Creates a Leaflet divIcon for a vehicle marker, reusing an existing one
 * whenever the same color, bearing bucket and size have been built before.
 *
 * Requires Leaflet to be loaded.
 * @param L - Leaflet instance
 * @param color - Fill color for the arrow
 * @param bearing - The direction the vehicle is facing in degrees (0 = North)
 * @param size - The size of the icon in pixels (default: 32)
 * @returns Leaflet DivIcon
 */
export function createVehicleLeafletIcon(
  L: typeof import("leaflet"),
  color: string,
  bearing: number = 0,
  size: number = 32,
): DivIcon {
  const snapped = snapBearing(bearing);
  const key = `${color}|${snapped}|${size}`;

  const cached = iconCache.get(key);
  if (cached) return cached;

  const icon = L.divIcon({
    html: createVehicleArrowIcon(color, snapped, size),
    className: "vehicle-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });

  iconCache.set(key, icon);
  return icon;
}
