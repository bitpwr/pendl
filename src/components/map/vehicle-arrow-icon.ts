import { routeTypeColor, type RouteType } from "@/types/gtfs";

/**
 * Creates an arrow-shaped SVG icon for a vehicle marker
 * @param routeType - The type of route (bus, train, etc.)
 * @param bearing - The direction the vehicle is facing in degrees (0 = North)
 * @param size - The size of the icon in pixels (default: 32)
 * @returns HTML string containing the SVG
 */
export function createVehicleArrowIcon(
  routeType: RouteType,
  bearing: number = 0,
  size: number = 32,
): string {
  const colors = routeTypeColor(routeType);

  // shadow is also translated, update to depend on bearing

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(${bearing} 16 16)">
        <!-- Drop shadow -->
        <path d="M 16 4 L 22 22 L 16 18 L 10 22 Z"
              fill="rgba(0,0,0,0.4)"
              transform="translate(2,2)" />
        <!-- Main arrow -->
        <path d="M 16 4 L 22 22 L 16 18 L 10 22 Z"
              fill="${colors.bg}"
              stroke="#FFFFFF"
              stroke-width="1.5" />
        <!-- Inner highlight -->
        <path d="M 16 6 L 20 20 L 16 17 L 12 20 Z"
              fill="${colors.bg}"
              opacity="0.8" />
      </g>
    </svg>
  `;
}

/**
 * Creates a Leaflet divIcon for a vehicle marker
 * Requires Leaflet to be loaded
 * @param L - Leaflet instance
 * @param routeType - The type of route (bus, train, etc.)
 * @param bearing - The direction the vehicle is facing in degrees (0 = North)
 * @param size - The size of the icon in pixels (default: 32)
 * @returns Leaflet DivIcon
 */
export function createVehicleLeafletIcon(
  L: typeof import("leaflet"),
  routeType: RouteType,
  bearing: number = 0,
  size: number = 32,
) {
  const html = createVehicleArrowIcon(routeType, bearing, size);

  return L.divIcon({
    html,
    className: "vehicle-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}
