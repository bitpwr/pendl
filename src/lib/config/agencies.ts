// List of agencies to include in data import
// Add more agencies as needed
export const INCLUDED_AGENCIES = [
  { id: "505000000000000001", tag: "sl", name: "SL" },
  { id: "505000000000000003", tag: "ul", name: "UL" },
  // Add more agencies here
] as const;

export type Agency = (typeof INCLUDED_AGENCIES)[number];
export type AgencyId = Agency["id"];
export type AgencyTag = Agency["tag"];

// Derived array of agency IDs for convenience
export const INCLUDED_AGENCY_IDS = INCLUDED_AGENCIES.map((a) => a.id);

export function isIncludedAgency(agencyId: string): boolean {
  return INCLUDED_AGENCIES.some((a) => a.id === agencyId);
}

export function getAgencyTag(agencyId: string): AgencyTag | undefined {
  return INCLUDED_AGENCIES.find((a) => a.id === agencyId)?.tag;
}

export function getAgencyName(agencyId: string): string | undefined {
  return INCLUDED_AGENCIES.find((a) => a.id === agencyId)?.name;
}
