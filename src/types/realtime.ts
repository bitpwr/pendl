// GTFS Realtime Types

export type TripScheduleRelationship =
  | "SCHEDULED"
  | "ADDED"
  | "UNSCHEDULED"
  | "CANCELED";

export interface TripUpdate {
  tripId: string;
  routeId: string;
  vehicleId?: string;
  timestamp: number;
  scheduleRelationship?: TripScheduleRelationship;
  stopTimeUpdates: StopTimeUpdate[];
}

export interface StopTimeUpdate {
  stopId: string;
  stopSequence: number;
  arrival?: {
    delay: number; // seconds
    time?: number; // unix timestamp in ms
  };
  departure?: {
    delay: number;
    time?: number;
  };
  scheduleRelationship: ScheduleRelationship;
}

export type ScheduleRelationship = "SCHEDULED" | "SKIPPED" | "NO_DATA";

export interface VehiclePosition {
  vehicleId: string;
  tripId: string;
  routeId: string;
  latitude: number;
  longitude: number;
  bearing?: number;
  speed?: number;
  currentStopSequence?: number;
  currentStatus: VehicleStatus;
  timestamp: number;
}

export type VehicleStatus = "INCOMING_AT" | "STOPPED_AT" | "IN_TRANSIT_TO";

export interface ServiceAlert {
  alertId: string;
  headerText: string;
  descriptionText: string;
  cause: string;
  effect: string;
  activePeriods: Array<{ start: number; end?: number }>;
  informedEntities: Array<{
    agencyId?: string;
    routeId?: string;
    stopId?: string;
    tripId?: string;
  }>;
}
