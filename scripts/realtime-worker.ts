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

async function updateRealtime(): Promise<void> {
  const startTime = Date.now();

  try {
    // Fetch all feeds in parallel
    const [tripUpdates, vehiclePositions, serviceAlerts] = await Promise.all([
      fetchTripUpdates().catch((err) => {
        console.error("Failed to fetch trip updates:", err.message);
        return [];
      }),
      fetchVehiclePositions().catch((err) => {
        console.error("Failed to fetch vehicle positions:", err.message);
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
      storeVehiclePositions(vehiclePositions),
      storeServiceAlerts(serviceAlerts),
    ]);

    await setLastRealtimeUpdate();

    const duration = Date.now() - startTime;
    console.log(
      `[${new Date().toISOString()}] Updated: ${tripUpdates.length} trip updates, ${vehiclePositions.length} vehicles, ${serviceAlerts.length} alerts (${duration}ms)`,
    );
  } catch (error) {
    console.error("Error updating realtime data:", error);
  }
}

async function runWorker(): Promise<void> {
  console.log("=== GTFS Realtime Worker ===");
  console.log(`Update interval: ${GTFS_CONFIG.realtimeUpdateInterval}ms`);
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

  // Initial update
  await updateRealtime();

  // Set up interval
  const interval = setInterval(async () => {
    if (isRunning) {
      await updateRealtime();
    }
  }, GTFS_CONFIG.realtimeUpdateInterval);

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log("\nShutting down...");
    isRunning = false;
    clearInterval(interval);
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
