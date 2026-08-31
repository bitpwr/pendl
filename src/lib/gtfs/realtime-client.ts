import protobuf from "protobufjs";
import type {
  TripUpdate,
  VehiclePosition,
  ServiceAlert,
} from "@/types/realtime";
import type {
  FeedMessage,
  TripUpdateProto,
  VehiclePositionProto,
  AlertProto,
  VehicleStopStatus,
  StopTimeScheduleRelationship,
} from "./realtime-proto";
import {
  GTFS_CONFIG,
  getTripUpdatesUrl,
  getVehiclePositionsUrl,
  getServiceAlertsUrl,
} from "./config";
import {
  trackServiceAlertDownload,
  trackTripUpdateDownload,
  trackVehicleDownload,
} from "@/lib/analytics/influx";

// GTFS Realtime proto definition (inline for simplicity).
// Exported so tests can encode feeds against the exact same field numbers.
export const protoDefinition = `
syntax = "proto2";

package transit_realtime;

message FeedMessage {
  required FeedHeader header = 1;
  repeated FeedEntity entity = 2;
}

message FeedHeader {
  required string gtfs_realtime_version = 1;
  optional Incrementality incrementality = 2 [default = FULL_DATASET];
  optional uint64 timestamp = 3;

  enum Incrementality {
    FULL_DATASET = 0;
    DIFFERENTIAL = 1;
  }
}

message FeedEntity {
  required string id = 1;
  optional bool is_deleted = 2 [default = false];
  optional TripUpdate trip_update = 3;
  optional VehiclePosition vehicle = 4;
  optional Alert alert = 5;
}

message TripUpdate {
  optional TripDescriptor trip = 1;
  optional VehicleDescriptor vehicle = 3;
  repeated StopTimeUpdate stop_time_update = 2;
  optional uint64 timestamp = 4;
  optional int32 delay = 5;

  message StopTimeUpdate {
    optional uint32 stop_sequence = 1;
    optional string stop_id = 4;
    optional StopTimeEvent arrival = 2;
    optional StopTimeEvent departure = 3;
    optional ScheduleRelationship schedule_relationship = 5 [default = SCHEDULED];

    enum ScheduleRelationship {
      SCHEDULED = 0;
      SKIPPED = 1;
      NO_DATA = 2;
    }
  }

  message StopTimeEvent {
    optional int32 delay = 1;
    optional int64 time = 2;
    optional int32 uncertainty = 3;
  }
}

message VehiclePosition {
  optional TripDescriptor trip = 1;
  optional VehicleDescriptor vehicle = 8;
  optional Position position = 2;
  optional uint32 current_stop_sequence = 3;
  optional string stop_id = 7;
  optional VehicleStopStatus current_status = 4 [default = IN_TRANSIT_TO];
  optional uint64 timestamp = 5;

  enum VehicleStopStatus {
    INCOMING_AT = 0;
    STOPPED_AT = 1;
    IN_TRANSIT_TO = 2;
  }
}

message Alert {
  repeated TimeRange active_period = 1;
  repeated EntitySelector informed_entity = 5;
  optional Cause cause = 6 [default = UNKNOWN_CAUSE];
  optional Effect effect = 7 [default = UNKNOWN_EFFECT];
  optional TranslatedString url = 8;
  optional TranslatedString header_text = 10;
  optional TranslatedString description_text = 11;

  enum Cause {
    UNKNOWN_CAUSE = 1;
    OTHER_CAUSE = 2;
    TECHNICAL_PROBLEM = 3;
    STRIKE = 4;
    DEMONSTRATION = 5;
    ACCIDENT = 6;
    HOLIDAY = 7;
    WEATHER = 8;
    MAINTENANCE = 9;
    CONSTRUCTION = 10;
    POLICE_ACTIVITY = 11;
    MEDICAL_EMERGENCY = 12;
  }

  enum Effect {
    NO_SERVICE = 1;
    REDUCED_SERVICE = 2;
    SIGNIFICANT_DELAYS = 3;
    DETOUR = 4;
    ADDITIONAL_SERVICE = 5;
    MODIFIED_SERVICE = 6;
    OTHER_EFFECT = 7;
    UNKNOWN_EFFECT = 8;
    STOP_MOVED = 9;
  }
}

message TripDescriptor {
  optional string trip_id = 1;
  optional string route_id = 5;
  optional uint32 direction_id = 6;
  optional string start_time = 2;
  optional string start_date = 3;
  optional ScheduleRelationship schedule_relationship = 4 [default = SCHEDULED];

  enum ScheduleRelationship {
    SCHEDULED = 0;
    ADDED = 1;
    UNSCHEDULED = 2;
    CANCELED = 3;
  }
}

message VehicleDescriptor {
  optional string id = 1;
  optional string label = 2;
  optional string license_plate = 3;
}

message Position {
  required float latitude = 1;
  required float longitude = 2;
  optional float bearing = 3;
  optional double odometer = 4;
  optional float speed = 5;
}

message TimeRange {
  optional uint64 start = 1;
  optional uint64 end = 2;
}

message EntitySelector {
  optional string agency_id = 1;
  optional string route_id = 2;
  optional int32 route_type = 3;
  optional TripDescriptor trip = 4;
  optional string stop_id = 5;
}

message TranslatedString {
  repeated Translation translation = 1;

  message Translation {
    required string text = 1;
    optional string language = 2;
  }
}
`;

let root: protobuf.Root | null = null;
let FeedMessageType: protobuf.Type | null = null;

async function getProtoType(): Promise<protobuf.Type> {
  if (FeedMessageType) {
    return FeedMessageType;
  }

  root = protobuf.parse(protoDefinition).root;
  FeedMessageType = root.lookupType("transit_realtime.FeedMessage");
  return FeedMessageType;
}

// Per-feed cache validators, so repeated polls can be answered with a 304
// instead of a full download. Trafiklab supports both ETag and Last-Modified.
type FeedCacheEntry = {
  etag?: string;
  lastModified?: string;
  headerTimestamp?: number;
};

const feedCache = new Map<string, FeedCacheEntry>();

/**
 * Fetch and parse GTFS Realtime feed.
 *
 * Returns null when the feed has not changed since the last call for this URL,
 * either because the server answered 304 or because the feed header carries a
 * timestamp we have already processed.
 */
export async function fetchRealtimeFeed(
  url: string,
): Promise<FeedMessage | null> {
  const request = new URL(url);
  if (GTFS_CONFIG.realtimeApiKey) {
    request.searchParams.set("key", GTFS_CONFIG.realtimeApiKey);
  }

  const cached = feedCache.get(url);
  const headers: Record<string, string> = {
    accept: "application/octet-stream",
    "Accept-encoding": "br, gzip, deflate",
  };

  if (cached?.etag) {
    headers["If-None-Match"] = cached.etag;
  }
  if (cached?.lastModified) {
    headers["If-Modified-Since"] = cached.lastModified;
  }

  const response = await fetch(request.toString(), { headers });

  if (response.status === 304) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch realtime feed: ${response.status}`);
  }

  const etag = response.headers.get("etag") ?? undefined;
  const lastModified = response.headers.get("last-modified") ?? undefined;

  const buffer = await response.arrayBuffer();
  const FeedMessage = await getProtoType();
  const message = FeedMessage.decode(new Uint8Array(buffer));

  const feed = FeedMessage.toObject(message, {
    longs: Number,
    enums: Number,
    defaults: true,
    arrays: true,
  }) as FeedMessage;

  // A 200 does not guarantee new content: the feed can be regenerated with an
  // unchanged header timestamp, or be served without validators at all.
  // `defaults: true` decodes a missing timestamp as 0, which must not be
  // mistaken for a real value or every feed would look unchanged forever.
  const headerTimestamp = feed.header?.timestamp || undefined;
  const unchanged =
    headerTimestamp !== undefined &&
    cached?.headerTimestamp !== undefined &&
    headerTimestamp === cached.headerTimestamp;

  feedCache.set(url, { etag, lastModified, headerTimestamp });

  return unchanged ? null : feed;
}

/**
 * Fetch trip updates from GTFS Realtime
 */
export async function fetchTripUpdates(
  agencyTag: string,
): Promise<TripUpdate[] | null> {
  const url = getTripUpdatesUrl(agencyTag);

  trackTripUpdateDownload();
  const feed = await fetchRealtimeFeed(url);
  if (!feed) return null;

  return feed.entity
    .filter((e) => e.tripUpdate)
    .map((e) => convertTripUpdate(e.tripUpdate!));
}

/**
 * Fetch vehicle positions from GTFS Realtime
 */
export async function fetchVehiclePositions(
  agencyTag: string,
): Promise<VehiclePosition[] | null> {
  const url = getVehiclePositionsUrl(agencyTag);

  trackVehicleDownload();
  const feed = await fetchRealtimeFeed(url);
  if (!feed) return null;

  return feed.entity
    .filter((e) => e.vehicle)
    .map((e) => convertVehiclePosition(e.vehicle!));
}

/**
 * Fetch service alerts from GTFS Realtime
 */
export async function fetchServiceAlerts(
  agencyTag: string,
): Promise<ServiceAlert[] | null> {
  const url = getServiceAlertsUrl(agencyTag);

  trackServiceAlertDownload();
  const feed = await fetchRealtimeFeed(url);
  if (!feed) return null;

  return feed.entity
    .filter((e) => e.alert)
    .map((e, i) => convertServiceAlert(e.alert!, e.id || `alert-${i}`));
}

function convertTripUpdate(proto: TripUpdateProto): TripUpdate {
  const scheduleRelationshipMap: Record<
    number,
    TripUpdate["scheduleRelationship"]
  > = {
    0: "SCHEDULED",
    1: "ADDED",
    2: "UNSCHEDULED",
    3: "CANCELED",
  };

  const stopScheduleRelationshipMap: Record<
    number,
    "SCHEDULED" | "SKIPPED" | "NO_DATA"
  > = {
    0: "SCHEDULED",
    1: "SKIPPED",
    2: "NO_DATA",
  };

  return {
    tripId: proto.trip?.tripId || "",
    routeId: proto.trip?.routeId || "",
    vehicleId: proto.vehicle?.id,
    timestamp: proto.timestamp || Date.now(),
    scheduleRelationship:
      scheduleRelationshipMap[proto.trip?.scheduleRelationship || 0],
    stopTimeUpdates: (proto.stopTimeUpdate || []).map((stu) => ({
      stopId: stu.stopId || "",
      stopSequence: stu.stopSequence || 0,
      arrival: stu.arrival
        ? {
            delay: stu.arrival.delay || 0,
            time: stu.arrival.time,
          }
        : undefined,
      departure: stu.departure
        ? {
            delay: stu.departure.delay || 0,
            time: stu.departure.time,
          }
        : undefined,
      scheduleRelationship:
        stopScheduleRelationshipMap[
          (stu.scheduleRelationship as unknown as StopTimeScheduleRelationship) ||
            0
        ],
    })),
  };
}

function convertVehiclePosition(proto: VehiclePositionProto): VehiclePosition {
  const statusMap: Record<VehicleStopStatus, VehiclePosition["currentStatus"]> =
    {
      0: "INCOMING_AT",
      1: "STOPPED_AT",
      2: "IN_TRANSIT_TO",
    };

  return {
    vehicleId: proto.vehicle?.id || "",
    tripId: proto.trip?.tripId || "",
    routeId: proto.trip?.routeId || "",
    latitude: proto.position?.latitude || 0,
    longitude: proto.position?.longitude || 0,
    bearing: proto.position?.bearing,
    speed: proto.position?.speed,
    currentStopSequence: proto.currentStopSequence,
    currentStatus: statusMap[(proto.currentStatus as VehicleStopStatus) || 2],
    timestamp: proto.timestamp || Date.now(),
  };
}

function convertServiceAlert(proto: AlertProto, id: string): ServiceAlert {
  const getTranslation = (ts?: {
    translation?: { text: string; language?: string }[];
  }): string => {
    if (!ts?.translation?.length) return "";
    // Prefer Swedish translation
    const sv = ts.translation.find((t) => t.language === "sv");
    return sv?.text || ts.translation[0]?.text || "";
  };

  return {
    alertId: id,
    headerText: getTranslation(proto.headerText),
    descriptionText: getTranslation(proto.descriptionText),
    cause: String(proto.cause || "UNKNOWN_CAUSE"),
    effect: String(proto.effect || "UNKNOWN_EFFECT"),
    activePeriods: (proto.activePeriod || []).map((ap) => ({
      start: ap.start || 0,
      end: ap.end,
    })),
    informedEntities: (proto.informedEntity || []).map((ie) => ({
      agencyId: ie.agencyId,
      routeId: ie.routeId,
      stopId: ie.stopId,
      tripId: ie.trip?.tripId,
    })),
  };
}
