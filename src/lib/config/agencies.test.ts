import { describe, it, expect } from "vitest";
import { INCLUDED_AGENCY_IDS, isIncludedAgency } from "./agencies";

describe("agencies config", () => {
  it("should have at least one agency ID", () => {
    expect(INCLUDED_AGENCY_IDS.length).toBeGreaterThan(0);
  });

  it("should include the SL agency ID", () => {
    expect(INCLUDED_AGENCY_IDS).toContain("505000000000000001");
  });

  it("isIncludedAgency should return true for included agencies", () => {
    expect(isIncludedAgency("505000000000000001")).toBe(true);
  });

  it("isIncludedAgency should return false for non-included agencies", () => {
    expect(isIncludedAgency("some-other-agency")).toBe(false);
  });
});
