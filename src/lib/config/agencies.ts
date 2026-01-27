// List of agency IDs to include in data import
// Add more agency IDs as needed
export const INCLUDED_AGENCY_IDS = [
  "505000000000000001",
  // Add more agency IDs here
] as const;

export type AgencyId = (typeof INCLUDED_AGENCY_IDS)[number];

export function isIncludedAgency(agencyId: string): boolean {
  return INCLUDED_AGENCY_IDS.includes(agencyId as AgencyId);
}
