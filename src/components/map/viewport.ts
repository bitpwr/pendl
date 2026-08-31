export interface MapViewport {
  north: number;
  south: number;
  east: number;
  west: number;
  zoom: number;
}

/** Fraction of the viewport span kept as a margin on each side. */
export const VIEWPORT_PADDING_RATIO = 0.25;

/**
 * Narrow a set of positioned items to the ones worth drawing.
 *
 * The bounds are padded so markers do not pop in at the edges while panning,
 * since the viewport only updates on moveend.
 */
export function filterToViewport<T extends { lat: number; lon: number }>(
  items: T[],
  viewport: MapViewport | null,
  paddingRatio: number = VIEWPORT_PADDING_RATIO,
): T[] {
  if (!viewport) return items;

  const latPadding = (viewport.north - viewport.south) * paddingRatio;
  const lonPadding = (viewport.east - viewport.west) * paddingRatio;

  const south = viewport.south - latPadding;
  const north = viewport.north + latPadding;
  const west = viewport.west - lonPadding;
  const east = viewport.east + lonPadding;

  // Zoomed far enough out that the bounds wrap the globe, so longitude
  // carries no information and filtering on it would drop everything.
  const spansAllLongitudes = east - west >= 360;

  return items.filter(
    (item) =>
      item.lat >= south &&
      item.lat <= north &&
      (spansAllLongitudes || (item.lon >= west && item.lon <= east)),
  );
}
