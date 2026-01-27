// GTFS Static Data Types

export interface Agency {
  agencyId: string;
  agencyName: string;
  agencyUrl?: string;
  agencyTimezone: string;
  agencyLang?: string;
  agencyPhone?: string;
}

export interface Stop {
  stopId: string;
  stopCode?: string;
  stopName: string;
  stopDesc?: string;
  stopLat: number;
  stopLon: number;
  locationType: number;
  parentStation?: string;
  platformCode?: string;
}

export interface Route {
  routeId: string;
  agencyId?: string;
  routeShortName?: string;
  routeLongName?: string;
  routeDesc?: string;
  routeType: RouteType;
  routeColor?: string;
  routeTextColor?: string;
  routeSortOrder?: number;
}

export enum RouteType {
  Tram = 0,
  Subway = 1,
  Rail = 2,
  Bus = 3,
  Ferry = 4,
  CableTram = 5,
  AerialLift = 6,
  Funicular = 7,
  Trolleybus = 11,
  Monorail = 12,
}

export interface Calendar {
  serviceId: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  startDate: Date;
  endDate: Date;
}

export interface CalendarDate {
  serviceId: string;
  date: Date;
  exceptionType: 1 | 2; // 1 = added, 2 = removed
}

export interface Trip {
  tripId: string;
  routeId: string;
  serviceId: string;
  tripHeadsign?: string;
  tripShortName?: string;
  directionId?: number;
  blockId?: string;
  shapeId?: string;
  wheelchairAccessible?: number;
  bikesAllowed?: number;
}

export interface StopTime {
  tripId: string;
  arrivalTime: string; // HH:MM:SS format (can exceed 24:00:00)
  departureTime: string;
  stopId: string;
  stopSequence: number;
  stopHeadsign?: string;
  pickupType?: number;
  dropOffType?: number;
  timepoint?: number;
}

export interface Shape {
  shapeId: string;
  shapePtLat: number;
  shapePtLon: number;
  shapePtSequence: number;
  shapeDistTraveled?: number;
}
