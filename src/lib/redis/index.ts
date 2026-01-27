import Redis from 'ioredis';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    // Retry after an exponential backoff
    return Math.min(times * 50, 2000);
  },
};

// Global Redis instance (singleton pattern)
let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(redisConfig);

    redis.on('error', (err) => {
      console.error('Redis connection error:', err);
    });
  }
  return redis;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

// Key prefixes for organizing data
export const REDIS_KEYS = {
  // Trip updates: tripUpdate:{tripId}
  TRIP_UPDATE: 'tripUpdate',
  // Vehicle positions: vehicle:{vehicleId}
  VEHICLE_POSITION: 'vehicle',
  // Service alerts: alert:{alertId}
  SERVICE_ALERT: 'alert',
  // Stop departures cache: stopDepartures:{stopId}
  STOP_DEPARTURES: 'stopDepartures',
  // Last update timestamp
  LAST_REALTIME_UPDATE: 'lastRealtimeUpdate',
  // Vehicle positions by route: vehiclesByRoute:{routeId}
  VEHICLES_BY_ROUTE: 'vehiclesByRoute',
} as const;

/**
 * Build a Redis key with prefix
 */
export function buildKey(prefix: string, id: string): string {
  return `${prefix}:${id}`;
}
