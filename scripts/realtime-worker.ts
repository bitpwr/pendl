#!/usr/bin/env npx tsx
/**
 * GTFS Realtime Data Worker
 *
 * This script polls GTFS Realtime feeds every 10 seconds
 * and stores the data in Redis for fast access.
 *
 * Usage:
 *   npx tsx scripts/realtime-worker.ts
 *
 * Environment variables:
 *   GTFS_RT_TRIP_UPDATES_URL - URL for trip updates feed
 *   GTFS_RT_VEHICLE_POSITIONS_URL - URL for vehicle positions feed
 *   GTFS_RT_SERVICE_ALERTS_URL - URL for service alerts feed
 *   REDIS_HOST, REDIS_PORT - Redis connection
 */

import {
  fetchTripUpdates,
  fetchVehiclePositions,
  fetchServiceAlerts,
} from "@/lib/gtfs/realtime-client";
import {
  storeTripUpdates,
  storeVehiclePositions,
  storeServiceAlerts,
  setLastRealtimeUpdate,
} from "@/lib/redis/realtime";
import { closeRedis } from "@/lib/redis";
import { GTFS_CONFIG } from "@/lib/gtfs/config";

let isRunning = true;
let lastVehicleUpdateTime = 0;
let lastTripAlertUpdateTime = 0;

const NIGHT_THROTTLE_START_HOUR = 1;
const NIGHT_THROTTLE_END_HOUR = 7;
const NIGHT_UPDATE_INTERVAL_MS = 30 * 60 * 1000;

function shouldRunUpdate(lastUpdateTime: number): boolean {
  const now = Date.now();
  const hour = new Date(now).getHours();
  const isNightThrottleWindow =
    hour >= NIGHT_THROTTLE_START_HOUR && hour < NIGHT_THROTTLE_END_HOUR;

  const doUpdate = isNightThrottleWindow
    ? now - lastUpdateTime >= NIGHT_UPDATE_INTERVAL_MS
    : true;

  if (doUpdate) {
    lastUpdateTime = now;
  }

  return doUpdate;
}

async function updateVehiclePositions(): Promise<void> {
  const startTime = Date.now();

  try {
    const vehiclePositions = await fetchVehiclePositions().catch((err) => {
      console.error("Failed to fetch vehicle positions:", err.message);
      return [];
    });

    await storeVehiclePositions(vehiclePositions);

    const duration = Date.now() - startTime;
    console.log(
      `Updated vehicle positions: ${vehiclePositions.length} vehicles (${duration}ms)`,
    );
  } catch (error) {
    console.error("Error updating vehicle positions:", error);
  }
}

async function updateTripUpdatesAndAlerts(): Promise<void> {
  const startTime = Date.now();

  try {
    // Fetch trip updates and service alerts in parallel
    const [tripUpdates, serviceAlerts] = await Promise.all([
      fetchTripUpdates().catch((err) => {
        console.error("Failed to fetch trip updates:", err.message);
        return [];
      }),
      fetchServiceAlerts().catch((err) => {
        console.error("Failed to fetch service alerts:", err.message);
        return [];
      }),
    ]);

    // Store in Redis
    await Promise.all([
      storeTripUpdates(tripUpdates),
      storeServiceAlerts(serviceAlerts),
    ]);

    await setLastRealtimeUpdate();

    const duration = Date.now() - startTime;
    console.log(
      `Updated: ${tripUpdates.length} trip updates, ${serviceAlerts.length} alerts (${duration}ms)`,
    );
  } catch (error) {
    console.error("Error updating trip updates and alerts:", error);
  }
}

async function runWorker(): Promise<void> {
  console.log("=== GTFS Realtime Worker ===");
  console.log(
    `Vehicle update interval: ${GTFS_CONFIG.realtimeVehicleUpdateInterval}ms`,
  );
  console.log(
    `Trip/Alert update interval: ${GTFS_CONFIG.realtimeTripUpdateInterval}ms`,
  );
  console.log(
    `Trip updates URL: ${GTFS_CONFIG.realtimeUrls.tripUpdates || "not configured"}`,
  );
  console.log(
    `Vehicle positions URL: ${GTFS_CONFIG.realtimeUrls.vehiclePositions || "not configured"}`,
  );
  console.log(
    `Service alerts URL: ${GTFS_CONFIG.realtimeUrls.serviceAlerts || "not configured"}`,
  );
  console.log("");
  console.log("Starting worker...");
  console.log("");

  // Initial updates
  await updateVehiclePositions();
  lastVehicleUpdateTime = Date.now();
  await updateTripUpdatesAndAlerts();
  lastTripAlertUpdateTime = Date.now();

  // Set up intervals
  const vehicleInterval = setInterval(async () => {
    if (isRunning && shouldRunUpdate(lastVehicleUpdateTime)) {
      await updateVehiclePositions();
    }
  }, GTFS_CONFIG.realtimeVehicleUpdateInterval);

  const tripAlertInterval = setInterval(async () => {
    if (isRunning && shouldRunUpdate(lastTripAlertUpdateTime)) {
      await updateTripUpdatesAndAlerts();
    }
  }, GTFS_CONFIG.realtimeTripUpdateInterval);

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log("\nShutting down...");
    isRunning = false;
    clearInterval(vehicleInterval);
    clearInterval(tripAlertInterval);
    await closeRedis();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep the process running
  await new Promise(() => {
    // This promise never resolves, keeping the process alive
  });
}

runWorker().catch((error) => {
  console.error("Worker failed:", error);
  process.exit(1);
});
