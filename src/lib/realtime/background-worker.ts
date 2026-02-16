import "server-only";

import {
  fetchServiceAlerts,
  fetchTripUpdates,
  fetchVehiclePositions,
} from "@/lib/gtfs/realtime-client";
import { GTFS_CONFIG } from "@/lib/gtfs/config";
import {
  setLastRealtimeUpdate,
  storeServiceAlerts,
  storeTripUpdates,
  storeVehiclePositions,
} from "@/lib/redis/realtime";

const DEFAULT_ACTIVE_WINDOW_MS = 15 * 60 * 1000;

type RealtimeWorkerState = {
  started: boolean;
  startupPromise: Promise<void> | null;
  vehicleInterval: NodeJS.Timeout | null;
  tripAlertInterval: NodeJS.Timeout | null;
  lastVehicleUpdateTime: number;
  lastTripAlertUpdateTime: number;
  lastConsumerActivityTime: number;
  vehicleUpdateInProgress: boolean;
  tripAlertUpdateInProgress: boolean;
  warnedAboutMissingFeeds: boolean;
};

declare global {
  var __pendlRealtimeWorkerState: RealtimeWorkerState | undefined;
}

function getWorkerState(): RealtimeWorkerState {
  if (!globalThis.__pendlRealtimeWorkerState) {
    globalThis.__pendlRealtimeWorkerState = {
      started: false,
      startupPromise: null,
      vehicleInterval: null,
      tripAlertInterval: null,
      lastVehicleUpdateTime: 0,
      lastTripAlertUpdateTime: 0,
      lastConsumerActivityTime: 0,
      vehicleUpdateInProgress: false,
      tripAlertUpdateInProgress: false,
      warnedAboutMissingFeeds: false,
    };
  }

  return globalThis.__pendlRealtimeWorkerState;
}

function hasConfiguredRealtimeFeed(): boolean {
  const { tripUpdates, vehiclePositions, serviceAlerts } =
    GTFS_CONFIG.realtimeUrls;

  return Boolean(tripUpdates || vehiclePositions || serviceAlerts);
}

function getActiveWindowMs(): number {
  const value = Number(process.env.GTFS_REALTIME_ACTIVE_WINDOW_MS);
  if (Number.isFinite(value) && value > 0) {
    return value;
  }

  return DEFAULT_ACTIVE_WINDOW_MS;
}

function hasRecentConsumerActivity(now: number, lastActivity: number): boolean {
  return now - lastActivity <= getActiveWindowMs();
}

async function updateVehiclePositions(now: number): Promise<void> {
  const startedAt = now;

  const vehiclePositions = await fetchVehiclePositions().catch((err) => {
    console.error("Failed to fetch vehicle positions:", err.message);
    return [];
  });

  await storeVehiclePositions(vehiclePositions);

  const duration = Date.now() - startedAt;
  console.log(
    `[${new Date().toISOString()}] Updated vehicle positions: ${vehiclePositions.length} vehicles (${duration}ms)`,
  );
}

async function updateTripUpdatesAndAlerts(now: number): Promise<void> {
  const startedAt = now;

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

  await Promise.all([
    storeTripUpdates(tripUpdates),
    storeServiceAlerts(serviceAlerts),
  ]);

  await setLastRealtimeUpdate();

  const duration = Date.now() - startedAt;
  console.log(
    `[${new Date().toISOString()}] Updated: ${tripUpdates.length} trip updates, ${serviceAlerts.length} alerts (${duration}ms)`,
  );
}

async function runVehicleTick(force = false): Promise<void> {
  const state = getWorkerState();
  if (state.vehicleUpdateInProgress) {
    return;
  }

  const now = Date.now();
  if (
    !force &&
    !hasRecentConsumerActivity(now, state.lastConsumerActivityTime)
  ) {
    return;
  }

  state.vehicleUpdateInProgress = true;
  try {
    await updateVehiclePositions(now);
    state.lastVehicleUpdateTime = now;
  } catch (error) {
    console.error("Error updating vehicle positions:", error);
  } finally {
    state.vehicleUpdateInProgress = false;
  }
}

async function runTripAlertTick(force = false): Promise<void> {
  const state = getWorkerState();
  if (state.tripAlertUpdateInProgress) {
    return;
  }

  const now = Date.now();
  if (
    !force &&
    !hasRecentConsumerActivity(now, state.lastConsumerActivityTime)
  ) {
    return;
  }

  state.tripAlertUpdateInProgress = true;
  try {
    await updateTripUpdatesAndAlerts(now);
    state.lastTripAlertUpdateTime = now;
  } catch (error) {
    console.error("Error updating trip updates and alerts:", error);
  } finally {
    state.tripAlertUpdateInProgress = false;
  }
}

function startIntervals(): void {
  const state = getWorkerState();

  if (!state.vehicleInterval) {
    state.vehicleInterval = setInterval(() => {
      void runVehicleTick();
    }, GTFS_CONFIG.realtimeVehicleUpdateInterval);
  }

  if (!state.tripAlertInterval) {
    state.tripAlertInterval = setInterval(() => {
      void runTripAlertTick();
    }, GTFS_CONFIG.realtimeTripUpdateInterval);
  }
}

/**
 * Ensures that realtime polling is running in-process.
 *
 * Call this from API routes that read realtime data.
 */
export async function ensureRealtimeWorkerRunning(
  source = "unknown",
): Promise<void> {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const state = getWorkerState();
  state.lastConsumerActivityTime = Date.now();

  console.log(`user activity detected: ${source}`);

  if (state.started) {
    return;
  }

  if (!hasConfiguredRealtimeFeed()) {
    if (!state.warnedAboutMissingFeeds) {
      console.warn(
        "Realtime worker not started: no GTFS realtime feed URLs are configured.",
      );
      state.warnedAboutMissingFeeds = true;
    }
    return;
  }

  if (state.startupPromise) {
    await state.startupPromise;
    return;
  }

  state.startupPromise = (async () => {
    console.log("=== GTFS Realtime Worker (in-app) ===");
    console.log(`Triggered by: ${source}`);
    console.log(
      `Vehicle update interval: ${GTFS_CONFIG.realtimeVehicleUpdateInterval}ms`,
    );
    console.log(
      `Trip/Alert update interval: ${GTFS_CONFIG.realtimeTripUpdateInterval}ms`,
    );
    console.log(
      `Active window: ${getActiveWindowMs()}ms since latest realtime API request`,
    );

    await Promise.all([runVehicleTick(true), runTripAlertTick(true)]);
    startIntervals();
    state.started = true;

    console.log("Realtime worker started in backend process.");
  })()
    .catch((error) => {
      state.started = false;
      console.error("Failed to start realtime worker:", error);
    })
    .finally(() => {
      state.startupPromise = null;
    });

  await state.startupPromise;
}
