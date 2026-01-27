// API Response Types
import type { RouteType } from './gtfs';

export interface DepartureResponse {
  stopId: string;
  stopName: string;
  departures: Departure[];
  generatedAt: string;
}

export interface Departure {
  tripId: string;
  routeId: string;
  routeShortName: string;
  routeColor: string;
  routeType: RouteType;
  headsign: string;
  scheduledDeparture: string; // ISO datetime
  predictedDeparture?: string; // ISO datetime (if realtime available)
  delayMinutes?: number;
  status: DepartureStatus;
  isRealtime: boolean;
  platform?: string;
  vehicleId?: string;
  alerts?: AlertSummary[];
}

export type DepartureStatus = 'on-time' | 'delayed' | 'early' | 'cancelled' | 'scheduled';

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
  routeColor: string;
  headsign: string;
  latitude: number;
  longitude: number;
  bearing?: number;
  speed?: number;
  currentStatus: string;
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
  distance?: number; // For nearby search (meters)
  routes?: RouteSummary[];
}

export interface RouteSummary {
  routeId: string;
  routeShortName: string;
  routeColor: string;
  routeType: RouteType;
}

export interface TripDetails {
  tripId: string;
  routeId: string;
  routeShortName: string;
  routeColor: string;
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
  type: 'LineString';
  coordinates: [number, number][]; // [lon, lat]
}
