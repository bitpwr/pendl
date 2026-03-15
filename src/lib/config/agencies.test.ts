import { describe, it, expect } from "vitest";
import {
  INCLUDED_AGENCIES,
  INCLUDED_AGENCY_IDS,
  isIncludedAgency,
  getAgencyTag,
} from "./agencies";

describe("agencies config", () => {
  it("should have at least one agency", () => {
    expect(INCLUDED_AGENCIES.length).toBeGreaterThan(0);
  });

  it("should have at least one agency ID", () => {
    expect(INCLUDED_AGENCY_IDS.length).toBeGreaterThan(0);
  });

  it("should include the SL agency ID", () => {
    expect(INCLUDED_AGENCY_IDS).toContain("505000000000000001");
  });

  it("SL agency should have tag 'sl'", () => {
    const sl = INCLUDED_AGENCIES.find((a) => a.id === "505000000000000001");
    expect(sl?.tag).toBe("sl");
  });

  it("isIncludedAgency should return true for included agencies", () => {
    expect(isIncludedAgency("505000000000000001")).toBe(true);
  });

  it("isIncludedAgency should return false for non-included agencies", () => {
    expect(isIncludedAgency("some-other-agency")).toBe(false);
  });

  it("getAgencyTag should return the tag for a known agency", () => {
    expect(getAgencyTag("505000000000000001")).toBe("sl");
  });

  it("getAgencyTag should return undefined for an unknown agency", () => {
    expect(getAgencyTag("unknown-id")).toBeUndefined();
  });
});
