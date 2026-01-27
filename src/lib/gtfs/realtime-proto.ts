/**
 * GTFS Realtime Proto Schema
 *
 * This is a simplified TypeScript representation of the GTFS Realtime protobuf schema.
 * The actual parsing is done using protobufjs with the official .proto file.
 */

export interface FeedMessage {
  header: FeedHeader;
  entity: FeedEntity[];
}

export interface FeedHeader {
  gtfsRealtimeVersion: string;
  incrementality: Incrementality;
  timestamp: number;
}

export enum Incrementality {
  FULL_DATASET = 0,
  DIFFERENTIAL = 1,
}

export interface FeedEntity {
  id: string;
  isDeleted?: boolean;
  tripUpdate?: TripUpdateProto;
  vehicle?: VehiclePositionProto;
  alert?: AlertProto;
}

export interface TripUpdateProto {
  trip: TripDescriptor;
  vehicle?: VehicleDescriptor;
  stopTimeUpdate?: StopTimeUpdateProto[];
  timestamp?: number;
  delay?: number;
}

export interface TripDescriptor {
  tripId?: string;
  routeId?: string;
  directionId?: number;
  startTime?: string;
  startDate?: string;
  scheduleRelationship?: TripScheduleRelationship;
}

export enum TripScheduleRelationship {
  SCHEDULED = 0,
  ADDED = 1,
  UNSCHEDULED = 2,
  CANCELED = 3,
}

export interface VehicleDescriptor {
  id?: string;
  label?: string;
  licensePlate?: string;
}

export interface StopTimeUpdateProto {
  stopSequence?: number;
  stopId?: string;
  arrival?: StopTimeEventProto;
  departure?: StopTimeEventProto;
  scheduleRelationship?: StopTimeScheduleRelationship;
}

export enum StopTimeScheduleRelationship {
  SCHEDULED = 0,
  SKIPPED = 1,
  NO_DATA = 2,
}

export interface StopTimeEventProto {
  delay?: number;
  time?: number;
  uncertainty?: number;
}

export interface VehiclePositionProto {
  trip?: TripDescriptor;
  vehicle?: VehicleDescriptor;
  position?: Position;
  currentStopSequence?: number;
  stopId?: string;
  currentStatus?: VehicleStopStatus;
  timestamp?: number;
  congestionLevel?: CongestionLevel;
  occupancyStatus?: OccupancyStatus;
}

export interface Position {
  latitude: number;
  longitude: number;
  bearing?: number;
  odometer?: number;
  speed?: number;
}

export enum VehicleStopStatus {
  INCOMING_AT = 0,
  STOPPED_AT = 1,
  IN_TRANSIT_TO = 2,
}

export enum CongestionLevel {
  UNKNOWN_CONGESTION_LEVEL = 0,
  RUNNING_SMOOTHLY = 1,
  STOP_AND_GO = 2,
  CONGESTION = 3,
  SEVERE_CONGESTION = 4,
}

export enum OccupancyStatus {
  EMPTY = 0,
  MANY_SEATS_AVAILABLE = 1,
  FEW_SEATS_AVAILABLE = 2,
  STANDING_ROOM_ONLY = 3,
  CRUSHED_STANDING_ROOM_ONLY = 4,
  FULL = 5,
  NOT_ACCEPTING_PASSENGERS = 6,
}

export interface AlertProto {
  activePeriod?: TimeRange[];
  informedEntity?: EntitySelector[];
  cause?: Cause;
  effect?: Effect;
  url?: TranslatedString;
  headerText?: TranslatedString;
  descriptionText?: TranslatedString;
}

export interface TimeRange {
  start?: number;
  end?: number;
}

export interface EntitySelector {
  agencyId?: string;
  routeId?: string;
  routeType?: number;
  trip?: TripDescriptor;
  stopId?: string;
}

export enum Cause {
  UNKNOWN_CAUSE = 1,
  OTHER_CAUSE = 2,
  TECHNICAL_PROBLEM = 3,
  STRIKE = 4,
  DEMONSTRATION = 5,
  ACCIDENT = 6,
  HOLIDAY = 7,
  WEATHER = 8,
  MAINTENANCE = 9,
  CONSTRUCTION = 10,
  POLICE_ACTIVITY = 11,
  MEDICAL_EMERGENCY = 12,
}

export enum Effect {
  NO_SERVICE = 1,
  REDUCED_SERVICE = 2,
  SIGNIFICANT_DELAYS = 3,
  DETOUR = 4,
  ADDITIONAL_SERVICE = 5,
  MODIFIED_SERVICE = 6,
  OTHER_EFFECT = 7,
  UNKNOWN_EFFECT = 8,
  STOP_MOVED = 9,
}

export interface TranslatedString {
  translation: Translation[];
}

export interface Translation {
  text: string;
  language?: string;
}
