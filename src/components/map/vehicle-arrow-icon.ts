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

/** Longest label that still fits inside the badge circle. */
const MAX_LABEL_LENGTH = 4;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function labelFontSize(length: number): number {
  if (length <= 3) return 5;
  return 4;
}

/**
 * The route badge is drawn outside the rotated group, so the text stays
 * upright however the vehicle is heading.
 */
function routeBadge(color: string, label: string): string {
  const text = label.slice(0, MAX_LABEL_LENGTH);

  return `
      <circle cx="16" cy="16" r="5.8"
              fill="#FFFFFFBB" />
      <text x="16" y="16" dy="0.35em"
            text-anchor="middle"
            fill="#000000"
            font-family="system-ui, sans-serif"
            font-weight="700"
            font-size="${labelFontSize(text.length)}">${escapeXml(text)}</text>`;
}

/**
 * Creates an arrow-shaped SVG icon for a vehicle marker
 * @param color - Fill color for the arrow
 * @param bearing - The direction the vehicle is facing in degrees (0 = North)
 * @param size - The size of the icon in pixels (default: 32)
 * @param label - Route name to draw in a badge at the center, if any
 * @returns HTML string containing the SVG
 */
export function createVehicleArrowIcon(
  color: string,
  bearing: number = 0,
  size: number = 32,
  label?: string,
): string {
  const badge = label ? routeBadge(color, label) : "";
  const path = label
    ? `M 16 4 L 22 12 L 24 26 L 16 23 L 8 26 L 10 12 Z`
    : `M 16 4 L 24 26 L 16 23 L 8 26 Z`;

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(${bearing} 16 16)">
        <!-- Main arrow -->
        <path d="${path}"
              fill="${color}"
              stroke="#FFFFFF"
              stroke-width="0.8" />
      </g>${badge}
    </svg>
  `;
}

// A DivIcon is immutable once built and Leaflet calls createIcon() per marker,
// so one instance is safely shared by every vehicle drawn the same way. With
// bearings snapped there are only a few hundred distinct combinations, versus
// one new icon per vehicle per tick.
const iconCache = new Map<string, DivIcon>();

/**
 * Route labels multiply the key space by every line drawn, so a long session of
 * panning around would otherwise grow the cache without bound. Icons are cheap
 * to rebuild, so the whole cache is dropped once it gets that large.
 */
const MAX_CACHED_ICONS = 2000;

/**
 * Creates a Leaflet divIcon for a vehicle marker, reusing an existing one
 * whenever the same color, bearing bucket, size and label have been built
 * before.
 *
 * Requires Leaflet to be loaded.
 * @param L - Leaflet instance
 * @param color - Fill color for the arrow
 * @param bearing - The direction the vehicle is facing in degrees (0 = North)
 * @param size - The size of the icon in pixels (default: 32)
 * @param label - Route name to draw in a badge at the center, if any
 * @returns Leaflet DivIcon
 */
export function createVehicleLeafletIcon(
  L: typeof import("leaflet"),
  color: string,
  bearing: number = 0,
  size: number = 32,
  label?: string,
): DivIcon {
  const snapped = snapBearing(bearing);
  const key = `${color}|${snapped}|${size}|${label ?? ""}`;

  const cached = iconCache.get(key);
  if (cached) return cached;

  const icon = L.divIcon({
    html: createVehicleArrowIcon(color, snapped, size, label),
    className: "vehicle-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });

  if (iconCache.size >= MAX_CACHED_ICONS) {
    iconCache.clear();
  }

  iconCache.set(key, icon);
  return icon;
}
