import { describe, it, expect } from "vitest";
import { filterToViewport, type MapViewport } from "./viewport";

// A 2x2 degree box around central Stockholm.
const viewport: MapViewport = {
  south: 59,
  north: 61,
  west: 17,
  east: 19,
  zoom: 12,
};

const at = (lat: number, lon: number) => ({ id: `${lat},${lon}`, lat, lon });

describe("filterToViewport", () => {
  it("returns everything when there is no viewport yet", () => {
    const items = [at(0, 0), at(80, 170)];
    expect(filterToViewport(items, null)).toBe(items);
  });

  it("keeps items inside the bounds", () => {
    const inside = at(60, 18);
    expect(filterToViewport([inside], viewport)).toEqual([inside]);
  });

  it("drops items well outside the bounds", () => {
    const far = at(40, 5);
    expect(filterToViewport([far], viewport)).toEqual([]);
  });

  it("keeps items within the padding margin", () => {
    // 25% of the 2 degree span is 0.5, so 61.4 is outside the bounds but
    // inside the margin.
    const justOutside = at(61.4, 18);
    expect(filterToViewport([justOutside], viewport)).toEqual([justOutside]);
  });

  it("drops items beyond the padding margin", () => {
    // 61.6 is past the 0.5 degree margin.
    expect(filterToViewport([at(61.6, 18)], viewport)).toEqual([]);
  });

  it("applies padding to longitude as well", () => {
    expect(filterToViewport([at(60, 19.4)], viewport)).toEqual([at(60, 19.4)]);
    expect(filterToViewport([at(60, 19.6)], viewport)).toEqual([]);
  });

  it("honours a custom padding ratio", () => {
    const justOutside = at(61.4, 18);
    expect(filterToViewport([justOutside], viewport, 0)).toEqual([]);
    expect(filterToViewport([justOutside], viewport, 1)).toEqual([justOutside]);
  });

  it("ignores longitude when the bounds wrap the globe", () => {
    // Zoomed right out, Leaflet reports bounds wider than the world; filtering
    // on longitude there would drop every vehicle.
    const worldView: MapViewport = {
      south: -85,
      north: 85,
      west: -400,
      east: 400,
      zoom: 1,
    };

    const items = [at(59.3, 18.1), at(59.3, -170)];
    expect(filterToViewport(items, worldView)).toEqual(items);
  });

  it("keeps items exactly on the padded boundary", () => {
    expect(filterToViewport([at(61.5, 18)], viewport)).toEqual([at(61.5, 18)]);
  });

  it("preserves input order", () => {
    const items = [at(60, 18), at(59.5, 17.5), at(60.5, 18.5)];
    expect(filterToViewport(items, viewport).map((i) => i.id)).toEqual(
      items.map((i) => i.id),
    );
  });
});
