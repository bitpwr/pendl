/**
 * Creates an arrow-shaped SVG icon for a vehicle marker
 * @param routeType - The type of route (bus, train, etc.)
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
  color: string,
  bearing: number = 0,
  size: number = 32,
) {
  const html = createVehicleArrowIcon(color, bearing, size);
  return L.divIcon({
    html,
    className: "vehicle-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}
