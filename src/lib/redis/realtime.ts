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
 * Store a vehicle position in Redis
 */
export async function storeVehiclePosition(
  vehicle: VehiclePosition,
): Promise<void> {
  const redis = getRedis();
  const vehicleKey = buildKey(REDIS_KEYS.VEHICLE_POSITION, vehicle.vehicleId);
  const tripKey = buildKey(REDIS_KEYS.VEHICLE_BY_TRIP, vehicle.tripId);

  // Read previous value to clean stale trip->vehicle index if this vehicle
  // switched trips.
  const previousData = await redis.get(vehicleKey);
  const previousVehicle = previousData
    ? (JSON.parse(previousData) as VehiclePosition)
    : null;

  await redis.setex(vehicleKey, VEHICLE_POSITION_TTL, JSON.stringify(vehicle));
  await redis.setex(tripKey, VEHICLE_POSITION_TTL, vehicle.vehicleId);

  if (previousVehicle && previousVehicle.tripId !== vehicle.tripId) {
    const oldTripKey = buildKey(
      REDIS_KEYS.VEHICLE_BY_TRIP,
      previousVehicle.tripId,
    );
    await redis.del(oldTripKey);
  }

  // Also add to route set if route is known
  if (vehicle.routeId) {
    const routeKey = buildKey(REDIS_KEYS.VEHICLES_BY_ROUTE, vehicle.routeId);
    await redis.sadd(routeKey, vehicle.vehicleId);
    await redis.expire(routeKey, VEHICLE_POSITION_TTL);
  }
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

  // Group vehicles by route
  const vehiclesByRoute = new Map<string, string[]>();

  for (const vehicle of vehicles) {
    const key = buildKey(REDIS_KEYS.VEHICLE_POSITION, vehicle.vehicleId);
    const tripKey = buildKey(REDIS_KEYS.VEHICLE_BY_TRIP, vehicle.tripId);
    pipeline.setex(key, VEHICLE_POSITION_TTL, JSON.stringify(vehicle));
    pipeline.setex(tripKey, VEHICLE_POSITION_TTL, vehicle.vehicleId);

    if (vehicle.routeId) {
      if (!vehiclesByRoute.has(vehicle.routeId)) {
        vehiclesByRoute.set(vehicle.routeId, []);
      }
      vehiclesByRoute.get(vehicle.routeId)!.push(vehicle.vehicleId);
    }
  }

  // Update route vehicle sets
  for (const [routeId, vehicleIds] of vehiclesByRoute) {
    const routeKey = buildKey(REDIS_KEYS.VEHICLES_BY_ROUTE, routeId);
    // Delete old set and add new members
    pipeline.del(routeKey);
    pipeline.sadd(routeKey, ...vehicleIds);
    pipeline.expire(routeKey, VEHICLE_POSITION_TTL);
  }

  await pipeline.exec();
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
 * Get all vehicles for a route
 */
export async function getVehiclesByRoute(
  routeId: string,
): Promise<VehiclePosition[]> {
  const redis = getRedis();
  const routeKey = buildKey(REDIS_KEYS.VEHICLES_BY_ROUTE, routeId);
  const vehicleIds = await redis.smembers(routeKey);

  if (vehicleIds.length === 0) return [];

  const keys = vehicleIds.map((id) =>
    buildKey(REDIS_KEYS.VEHICLE_POSITION, id),
  );
  const values = await redis.mget(...keys);

  return values
    .filter((v): v is string => v !== null)
    .map((v) => JSON.parse(v) as VehiclePosition);
}

/**
 * Get all vehicle positions (for map view)
 */
export async function getAllVehiclePositions(): Promise<VehiclePosition[]> {
  const redis = getRedis();
  const pattern = buildKey(REDIS_KEYS.VEHICLE_POSITION, "*");
  const keys = await redis.keys(pattern);

  if (keys.length === 0) return [];

  const values = await redis.mget(...keys);
  return values
    .filter((v): v is string => v !== null)
    .map((v) => JSON.parse(v) as VehiclePosition);
}

/**
 * Get vehicle position by trip ID
 */
export async function getVehicleByTrip(
  tripId: string,
): Promise<VehiclePosition | null> {
  const redis = getRedis();
  const tripKey = buildKey(REDIS_KEYS.VEHICLE_BY_TRIP, tripId);

  // Fast path: O(1) tripId -> vehicleId lookup.
  const vehicleId = await redis.get(tripKey);
  if (vehicleId) {
    const vehicle = await getVehiclePosition(vehicleId);

    // Guard against stale index entries.
    if (vehicle?.tripId === tripId) {
      return vehicle;
    }

    await redis.del(tripKey);
  }

  // Fallback: scan all vehicles, then self-heal the index.
  const vehicles = await getAllVehiclePositions();
  const vehicle = vehicles.find((v) => v.tripId === tripId) || null;

  if (vehicle) {
    await redis.setex(tripKey, VEHICLE_POSITION_TTL, vehicle.vehicleId);
  }

  return vehicle;
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
