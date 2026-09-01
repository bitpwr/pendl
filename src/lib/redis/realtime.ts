import { getRedis, REDIS_KEYS, buildKey } from "./index";
import type {
  TripUpdate,
  VehiclePosition,
  ServiceAlert,
} from "@/types/realtime";

const VEHICLE_POSITION_TTL = 120;
const TRIP_UPDATE_TTL = 300;
const SERVICE_ALERT_TTL = 600;

/**
 * Store a trip update in Redis
 */
export async function storeTripUpdate(tripUpdate: TripUpdate): Promise<void> {
  const redis = getRedis();
  const key = buildKey(REDIS_KEYS.TRIP_UPDATE, tripUpdate.tripId);
  await redis.setex(key, TRIP_UPDATE_TTL, JSON.stringify(tripUpdate));
}

/**
 * Store multiple trip updates in a pipeline
 */
export async function storeTripUpdates(
  tripUpdates: TripUpdate[],
): Promise<void> {
  if (tripUpdates.length === 0) return;

  const redis = getRedis();
  const pipeline = redis.pipeline();

  for (const update of tripUpdates) {
    const key = buildKey(REDIS_KEYS.TRIP_UPDATE, update.tripId);
    pipeline.setex(key, TRIP_UPDATE_TTL, JSON.stringify(update));
  }

  await pipeline.exec();
}

/**
 * Get a trip update by trip ID
 */
export async function getTripUpdate(
  tripId: string,
): Promise<TripUpdate | null> {
  const redis = getRedis();
  const key = buildKey(REDIS_KEYS.TRIP_UPDATE, tripId);
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

/**
 * Get multiple trip updates at once
 */
export async function getTripUpdates(
  tripIds: string[],
): Promise<Map<string, TripUpdate>> {
  if (tripIds.length === 0) return new Map();

  const redis = getRedis();
  const keys = tripIds.map((id) => buildKey(REDIS_KEYS.TRIP_UPDATE, id));
  const values = await redis.mget(...keys);

  const result = new Map<string, TripUpdate>();
  values.forEach((value, index) => {
    if (value) {
      result.set(tripIds[index], JSON.parse(value));
    }
  });

  return result;
}

/**
 * Store multiple vehicle positions in a pipeline
 */
export async function storeVehiclePositions(
  vehicles: VehiclePosition[],
): Promise<void> {
  if (vehicles.length === 0) return;

  const redis = getRedis();
  const pipeline = redis.pipeline();

  for (const vehicle of vehicles.filter((v) => v.tripId)) {
    const key = buildKey(REDIS_KEYS.VEHICLE_POSITION, vehicle.vehicleId);
    const tripKey = buildKey(REDIS_KEYS.VEHICLE_BY_TRIP, vehicle.tripId);
    pipeline.setex(key, VEHICLE_POSITION_TTL, JSON.stringify(vehicle));
    pipeline.setex(tripKey, VEHICLE_POSITION_TTL, vehicle.vehicleId);
  }

  await pipeline.exec();
}

/**
 * Store the prebuilt map payload for an agency.
 *
 * Holds the finished JSON body so a request is a single GET with no parse,
 * join or re-serialisation on the way out.
 */
export async function storeVehicleSnapshot(
  agencyTag: string,
  payload: string,
): Promise<void> {
  const redis = getRedis();
  const key = buildKey(REDIS_KEYS.VEHICLE_SNAPSHOT, agencyTag);
  await redis.setex(key, VEHICLE_POSITION_TTL, payload);
}

/**
 * Get the prebuilt map payload for an agency, if one is still fresh
 */
export async function getVehicleSnapshot(
  agencyTag: string,
): Promise<string | null> {
  const redis = getRedis();
  return redis.get(buildKey(REDIS_KEYS.VEHICLE_SNAPSHOT, agencyTag));
}

/**
 * Get a vehicle position by vehicle ID
 */
export async function getVehiclePosition(
  vehicleId: string,
): Promise<VehiclePosition | null> {
  const redis = getRedis();
  const key = buildKey(REDIS_KEYS.VEHICLE_POSITION, vehicleId);
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

/**
 * Get vehicle position by trip ID
 */
export async function getVehicleByTrip(
  tripId: string,
): Promise<VehiclePosition | null> {
  const redis = getRedis();
  const tripKey = buildKey(REDIS_KEYS.VEHICLE_BY_TRIP, tripId);

  // O(1) tripId -> vehicleId lookup. storeVehiclePositions writes this index
  // for every vehicle on every tick with the same TTL as the position itself,
  // so a miss means the trip has no vehicle running rather than a lost entry.
  const vehicleId = await redis.get(tripKey);
  if (!vehicleId) return null;

  const vehicle = await getVehiclePosition(vehicleId);

  // Guard against a stale index entry pointing at a vehicle that moved on.
  if (vehicle?.tripId === tripId) {
    return vehicle;
  }

  await redis.del(tripKey);
  return null;
}

/**
 * Store a service alert
 */
export async function storeServiceAlert(alert: ServiceAlert): Promise<void> {
  const redis = getRedis();
  const key = buildKey(REDIS_KEYS.SERVICE_ALERT, alert.alertId);
  // Alerts have longer TTL (10 minutes)
  await redis.setex(key, SERVICE_ALERT_TTL, JSON.stringify(alert));
}

/**
 * Store multiple service alerts
 */
export async function storeServiceAlerts(
  alerts: ServiceAlert[],
): Promise<void> {
  if (alerts.length === 0) return;

  const redis = getRedis();
  const pipeline = redis.pipeline();

  for (const alert of alerts) {
    const key = buildKey(REDIS_KEYS.SERVICE_ALERT, alert.alertId);
    pipeline.setex(key, SERVICE_ALERT_TTL, JSON.stringify(alert));
  }

  await pipeline.exec();
}

/**
 * Get all active service alerts
 */
export async function getServiceAlerts(): Promise<ServiceAlert[]> {
  const redis = getRedis();
  const pattern = buildKey(REDIS_KEYS.SERVICE_ALERT, "*");
  const keys = await redis.keys(pattern);

  if (keys.length === 0) return [];

  const values = await redis.mget(...keys);
  return values
    .filter((v): v is string => v !== null)
    .map((v) => JSON.parse(v) as ServiceAlert);
}

/**
 * Update the last realtime update timestamp
 */
export async function setLastRealtimeUpdate(): Promise<void> {
  const redis = getRedis();
  await redis.set(REDIS_KEYS.LAST_REALTIME_UPDATE, Date.now().toString());
}

/**
 * Get the last realtime update timestamp
 */
export async function getLastRealtimeUpdate(): Promise<number | null> {
  const redis = getRedis();
  const timestamp = await redis.get(REDIS_KEYS.LAST_REALTIME_UPDATE);
  return timestamp ? parseInt(timestamp, 10) : null;
}
