import Redis from "ioredis";

const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    // Retry after an exponential backoff
    return Math.min(times * 50, 2000);
  },
};

declare global {
  var __pendlRedis: Redis | undefined;
}

export function getRedis(): Redis {
  if (!globalThis.__pendlRedis) {
    globalThis.__pendlRedis = new Redis(redisConfig);

    globalThis.__pendlRedis.on("error", (err) => {
      console.error("Redis connection error:", err);
    });
  }
  return globalThis.__pendlRedis;
}

export async function closeRedis(): Promise<void> {
  if (globalThis.__pendlRedis) {
    await globalThis.__pendlRedis.quit();
    globalThis.__pendlRedis = undefined;
  }
}

// Key prefixes for organizing data
export const REDIS_KEYS = {
  // Trip updates: tripUpdate:{tripId}
  TRIP_UPDATE: "tripUpdate",
  // Vehicle positions: vehicle:{vehicleId}
  VEHICLE_POSITION: "vehicle",
  // Service alerts: alert:{alertId}
  SERVICE_ALERT: "alert",
  // Stop departures cache: stopDepartures:{stopId}
  STOP_DEPARTURES: "stopDepartures",
  // Last update timestamp
  LAST_REALTIME_UPDATE: "lastRealtimeUpdate",
  // Vehicle lookup by trip: vehicleByTrip:{tripId}
  VEHICLE_BY_TRIP: "vehicleByTrip",
  // Prebuilt /api/vehicles body per agency: vehiclesSnapshot:{agencyTag}
  VEHICLE_SNAPSHOT: "vehiclesSnapshot",
} as const;

/**
 * Build a Redis key with prefix
 */
export function buildKey(prefix: string, id: string): string {
  return `${prefix}:${id}`;
}
