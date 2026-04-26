import { RouteType } from "@/types/gtfs";

// List of agencies to include in data import
// Add more agencies as needed
export const INCLUDED_AGENCIES = [
  {
    id: "505000000000000001",
    tag: "sl",
    name: "SL",
    longName: "Stockholm",
    mapCenter: [59.3293, 18.0686] as [number, number],
    mapZoom: 10,
    routeTypes: [
      RouteType.Metro,
      RouteType.Train,
      RouteType.Bus,
      RouteType.Tram,
      RouteType.Ferry,
    ],
  },
  {
    id: "505000000000000003",
    tag: "ul",
    name: "UL",
    longName: "Uppland",
    mapCenter: [59.8586, 17.6389] as [number, number],
    mapZoom: 9,
    routeTypes: [RouteType.Bus],
  },
  // Add more agencies here
] as const;

export type Agency = (typeof INCLUDED_AGENCIES)[number];
export type AgencyId = Agency["id"];
export type AgencyTag = Agency["tag"];

// Derived array of agency IDs for convenience
export const INCLUDED_AGENCY_IDS = INCLUDED_AGENCIES.map((a) => a.id);
export const INCLUDED_AGENCY_NAMES = INCLUDED_AGENCIES.map((a) => a.name);

export function isIncludedAgency(agencyId: string): boolean {
  return INCLUDED_AGENCIES.some((a) => a.id === agencyId);
}

export function getAgencyTag(agencyId: string): AgencyTag | undefined {
  return INCLUDED_AGENCIES.find((a) => a.id === agencyId)?.tag;
}

export function getAgencyName(agencyId: string): string | undefined {
  return INCLUDED_AGENCIES.find((a) => a.id === agencyId)?.name;
}

export function getAgencyLongName(agencyId: string): string | undefined {
  return INCLUDED_AGENCIES.find((a) => a.id === agencyId)?.longName;
}

export function getAgencyMapConfig(agencyId: string | undefined): {
  center: [number, number];
  zoom: number;
} {
  const agency = INCLUDED_AGENCIES.find((a) => a.id === agencyId);
  if (agency) {
    return {
      center: [agency.mapCenter[0], agency.mapCenter[1]],
      zoom: agency.mapZoom,
    };
  }
  return { center: [59.3293, 18.0686], zoom: 10 };
}

const DEFAULT_ROUTE_TYPES: RouteType[] = [
  RouteType.Metro,
  RouteType.Train,
  RouteType.Bus,
  RouteType.Tram,
  RouteType.Ferry,
];

export function getAgencyRouteTypes(agencyId: string | undefined): RouteType[] {
  const agency = INCLUDED_AGENCIES.find((a) => a.id === agencyId);
  return agency ? [...agency.routeTypes] : DEFAULT_ROUTE_TYPES;
}
