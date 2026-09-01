import { describe, it, expect } from "vitest";
import * as L from "leaflet";
import {
  createVehicleArrowIcon,
  createVehicleLeafletIcon,
} from "./vehicle-arrow-icon";

describe("createVehicleArrowIcon", () => {
  it("renders the requested size and color", () => {
    const html = createVehicleArrowIcon("#FF0000", 0, 24);

    expect(html).toContain('width="24"');
    expect(html).toContain('height="24"');
    expect(html).toContain('fill="#FF0000"');
  });

  it("rotates about the center of the viewBox", () => {
    expect(createVehicleArrowIcon("#000", 90)).toContain("rotate(90 16 16)");
  });
});

describe("createVehicleLeafletIcon caching", () => {
  it("reuses one icon for identical inputs", () => {
    const a = createVehicleLeafletIcon(L, "#111111", 0, 28);
    const b = createVehicleLeafletIcon(L, "#111111", 0, 28);

    expect(a).toBe(b);
  });

  it("reuses one icon across bearings inside the same bucket", () => {
    // A vehicle drifting a few degrees must not rebuild its marker: a new
    // icon makes Leaflet setIcon, which recreates the DOM element.
    const a = createVehicleLeafletIcon(L, "#222222", 90, 28);
    const b = createVehicleLeafletIcon(L, "#222222", 94, 28);
    const c = createVehicleLeafletIcon(L, "#222222", 86, 28);

    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("builds a different icon once the bearing crosses a bucket", () => {
    const a = createVehicleLeafletIcon(L, "#333333", 90, 28);
    const b = createVehicleLeafletIcon(L, "#333333", 105, 28);

    expect(b).not.toBe(a);
  });

  it("treats 0 and 360 degrees as the same bucket", () => {
    const a = createVehicleLeafletIcon(L, "#444444", 0, 28);
    const b = createVehicleLeafletIcon(L, "#444444", 359, 28);
    const c = createVehicleLeafletIcon(L, "#444444", 360, 28);

    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("handles negative bearings without leaking a separate bucket", () => {
    const a = createVehicleLeafletIcon(L, "#555555", 345, 28);
    const b = createVehicleLeafletIcon(L, "#555555", -15, 28);

    expect(b).toBe(a);
  });

  it("keeps colors and sizes apart", () => {
    const base = createVehicleLeafletIcon(L, "#666666", 0, 28);

    expect(createVehicleLeafletIcon(L, "#777777", 0, 28)).not.toBe(base);
    expect(createVehicleLeafletIcon(L, "#666666", 0, 40)).not.toBe(base);
  });

  it("snaps the rendered rotation to the bucket", () => {
    const icon = createVehicleLeafletIcon(L, "#888888", 94, 28);

    expect(icon.options.html).toContain("rotate(90 16 16)");
  });

  it("still applies the anchors Leaflet needs", () => {
    const icon = createVehicleLeafletIcon(L, "#999999", 0, 40);

    expect(icon.options.iconSize).toEqual([40, 40]);
    expect(icon.options.iconAnchor).toEqual([20, 20]);
    expect(icon.options.popupAnchor).toEqual([0, -20]);
  });
});
