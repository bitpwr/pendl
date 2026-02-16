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
  tripUpdateInterval: NodeJS.Timeout | null;
  serviceAlertInterval: NodeJS.Timeout | null;
  lastConsumerActivityTime: number;
  vehicleUpdateInProgress: boolean;
  tripUpdateInProgress: boolean;
  serviceAlertUpdateInProgress: boolean;
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
      tripUpdateInterval: null,
      serviceAlertInterval: null,
      lastConsumerActivityTime: 0,
      vehicleUpdateInProgress: false,
      tripUpdateInProgress: false,
      serviceAlertUpdateInProgress: false,
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
  await setLastRealtimeUpdate();

  const duration = Date.now() - startedAt;
  console.log(
    `[${new Date().toISOString()}] Updated vehicle positions: ${vehiclePositions.length} vehicles (${duration}ms)`,
  );
}

async function updateTripUpdates(now: number): Promise<void> {
  const startedAt = now;

  const tripUpdates = await fetchTripUpdates().catch((err) => {
    console.error("Failed to fetch trip updates:", err.message);
    return [];
  });

  await storeTripUpdates(tripUpdates);
  await setLastRealtimeUpdate();

  const duration = Date.now() - startedAt;
  console.log(
    `[${new Date().toISOString()}] Updated trip updates: ${tripUpdates.length} entries (${duration}ms)`,
  );
}

async function updateServiceAlerts(now: number): Promise<void> {
  const startedAt = now;

  const serviceAlerts = await fetchServiceAlerts().catch((err) => {
    console.error("Failed to fetch service alerts:", err.message);
    return [];
  });

  await storeServiceAlerts(serviceAlerts);

  await setLastRealtimeUpdate();

  const duration = Date.now() - startedAt;
  console.log(
    `[${new Date().toISOString()}] Updated service alerts: ${serviceAlerts.length} entries (${duration}ms)`,
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
  } catch (error) {
    console.error("Error updating vehicle positions:", error);
  } finally {
    state.vehicleUpdateInProgress = false;
  }
}

async function runTripUpdateTick(force = false): Promise<void> {
  const state = getWorkerState();
  if (state.tripUpdateInProgress) {
    return;
  }

  const now = Date.now();
  if (
    !force &&
    !hasRecentConsumerActivity(now, state.lastConsumerActivityTime)
  ) {
    return;
  }

  state.tripUpdateInProgress = true;
  try {
    await updateTripUpdates(now);
  } catch (error) {
    console.error("Error updating trip updates:", error);
  } finally {
    state.tripUpdateInProgress = false;
  }
}

async function runServiceAlertTick(force = false): Promise<void> {
  const state = getWorkerState();
  if (state.serviceAlertUpdateInProgress) {
    return;
  }

  const now = Date.now();
  if (
    !force &&
    !hasRecentConsumerActivity(now, state.lastConsumerActivityTime)
  ) {
    return;
  }

  state.serviceAlertUpdateInProgress = true;
  try {
    await updateServiceAlerts(now);
  } catch (error) {
    console.error("Error updating service alerts:", error);
  } finally {
    state.serviceAlertUpdateInProgress = false;
  }
}

function startIntervals(): void {
  const state = getWorkerState();

  if (!state.vehicleInterval) {
    state.vehicleInterval = setInterval(() => {
      void runVehicleTick();
    }, GTFS_CONFIG.realtimeVehicleUpdateInterval);
  }

  if (!state.tripUpdateInterval) {
    state.tripUpdateInterval = setInterval(() => {
      void runTripUpdateTick();
    }, GTFS_CONFIG.realtimeTripUpdateInterval);
  }

  if (!state.serviceAlertInterval) {
    state.serviceAlertInterval = setInterval(() => {
      void runServiceAlertTick();
    }, GTFS_CONFIG.realtimeServiceAlertUpdateInterval);
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
      `Trip update interval: ${GTFS_CONFIG.realtimeTripUpdateInterval}ms`,
    );
    console.log(
      `Service alert update interval: ${GTFS_CONFIG.realtimeServiceAlertUpdateInterval}ms`,
    );
    console.log(
      `Active window: ${getActiveWindowMs()}ms since latest realtime API request`,
    );

    await Promise.all([
      runVehicleTick(true),
      runTripUpdateTick(true),
      runServiceAlertTick(true),
    ]);
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
