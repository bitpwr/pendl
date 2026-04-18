// API Response Types
import type { RouteType } from "./gtfs";

export interface DepartureResponse {
  stop: {
    stopId: string;
    stopName: string;
    latitude: number;
    longitude: number;
  };
  departures: Departure[];
  updatedAt: string;
}

export interface AreaDepartureGroup {
  stopId: string;
  stopName: string;
  platformCode: string | null;
  departures: Departure[];
}

export interface AreaDepartureResponse {
  area: {
    areaId: string;
    areaName: string;
    latitude: number;
    longitude: number;
  };
  groups: AreaDepartureGroup[];
  updatedAt: string;
}

export interface Departure {
  tripId: string;
  routeId: string;
  routeShortName: string;
  routeLongName: string;
  routeType: RouteType;
  headsign: string;
  scheduledDeparture: string; // ISO datetime
  realtimeDeparture?: string; // ISO datetime (if realtime available)
  delaySeconds?: number;
  isCancelled?: boolean;
  directionId: number;
  vehicleId?: string;
  alerts?: AlertSummary[];
}

export interface AlertSummary {
  alertId: string;
  headerText: string;
  effect: string;
}

export interface VehicleResponse {
  vehicles: Vehicle[];
  generatedAt: string;
}

export interface Vehicle {
  vehicleId: string;
  tripId: string;
  routeId: string;
  routeShortName: string;
  routeType: RouteType;
  headsign: string;
  lat: number;
  long: number;
  bearing?: number;
  speed?: number;
  currentStatus?: string;
  nextStop?: {
    stopId: string;
    stopName: string;
    arrivalTime?: string;
  };
}

export interface StopSearchResult {
  stopId: string;
  stopName: string;
  stopCode?: string;
  latitude: number;
  longitude: number;
  platformCode?: string;
  distance?: number; // For nearby search (meters)
  routes?: RouteSummary[];
}

export interface AreaSearchResult {
  areaId: string;
  areaName: string;
  latitude: number;
  longitude: number;
  routeTypes: number[];
  stopIds: string[];
  distance?: number; // For nearby search (meters)
}

export interface RouteSummary {
  routeId: string;
  routeShortName: string;
  routeType: RouteType;
}

export interface TripDetails {
  tripId: string;
  routeId: string;
  routeShortName: string;
  headsign: string;
  stops: TripStop[];
  shape?: GeoJSONLineString;
}

export interface TripStop {
  stopId: string;
  stopName: string;
  stopSequence: number;
  arrivalTime: string;
  departureTime: string;
  platform?: string;
}

export interface GeoJSONLineString {
  type: "LineString";
  coordinates: [number, number][]; // [lon, lat]
}
