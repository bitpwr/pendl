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

type RealtimeWorkerState = {
  started: boolean;
  startupPromise: Promise<void> | null;
  vehicleInterval: NodeJS.Timeout | null;
  tripUpdateInterval: NodeJS.Timeout | null;
  serviceAlertInterval: NodeJS.Timeout | null;
  lastVehicleConsumerActivityTime: number;
  lastTripUpdateConsumerActivityTime: number;
  lastServiceAlertConsumerActivityTime: number;
  vehicleUpdateInProgress: boolean;
  tripUpdateInProgress: boolean;
  serviceAlertUpdateInProgress: boolean;
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
      lastVehicleConsumerActivityTime: 0,
      lastTripUpdateConsumerActivityTime: 0,
      lastServiceAlertConsumerActivityTime: 0,
      vehicleUpdateInProgress: false,
      tripUpdateInProgress: false,
      serviceAlertUpdateInProgress: false,
    };
  }

  return globalThis.__pendlRealtimeWorkerState;
}

async function updateVehiclePositions(now: number): Promise<void> {
  const startedAt = now;

  const vehiclePositions = await fetchVehiclePositions("sl").catch((err) => {
    console.error("Failed to fetch vehicle positions:", err.message);
    return [];
  });

  await storeVehiclePositions(vehiclePositions);
  await setLastRealtimeUpdate();

  const duration = Date.now() - startedAt;
  console.log(
    `Updated vehicle positions: ${vehiclePositions.length} vehicles (${duration}ms)`,
  );
}

async function updateTripUpdates(now: number): Promise<void> {
  const startedAt = now;

  const tripUpdates = await fetchTripUpdates("sl").catch((err) => {
    console.error("Failed to fetch trip updates:", err.message);
    return [];
  });

  await storeTripUpdates(tripUpdates);
  await setLastRealtimeUpdate();

  const duration = Date.now() - startedAt;
  console.log(
    `Updated trip updates: ${tripUpdates.length} entries (${duration}ms)`,
  );
}

async function updateServiceAlerts(now: number): Promise<void> {
  const startedAt = now;

  const serviceAlerts = await fetchServiceAlerts("sl").catch((err) => {
    console.error("Failed to fetch service alerts:", err.message);
    return [];
  });

  await storeServiceAlerts(serviceAlerts);

  await setLastRealtimeUpdate();

  const duration = Date.now() - startedAt;
  console.log(
    `Updated service alerts: ${serviceAlerts.length} entries (${duration}ms)`,
  );
}

async function runVehicleTick(force = false): Promise<void> {
  const state = getWorkerState();
  if (state.vehicleUpdateInProgress) {
    return;
  }

  // skip if no vehicle activity the the last 2 periods
  const now = Date.now();
  if (
    !force &&
    now - state.lastVehicleConsumerActivityTime >
      GTFS_CONFIG.realtimeVehicleUpdateInterval * 2
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

  // skip if no trip activity the last 20 seconds
  const now = Date.now();
  if (!force && now - state.lastTripUpdateConsumerActivityTime > 20000) {
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

  // skip if no service alert activity the last 20 seconds
  const now = Date.now();
  if (!force && now - state.lastServiceAlertConsumerActivityTime > 20000) {
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
 * Ensures that realtime polling loops are running in-process.
 *
 * Call this from API routes that read realtime data.
 */
async function ensureWorkerRunning(state: RealtimeWorkerState): Promise<void> {
  if (state.started) {
    return;
  }

  if (state.startupPromise) {
    await state.startupPromise;
    return;
  }

  state.startupPromise = (async () => {
    console.log("=== GTFS Realtime Worker (in-app) ===");
    console.log(
      `Vehicle update interval: ${GTFS_CONFIG.realtimeVehicleUpdateInterval}ms`,
    );
    console.log(
      `Trip update interval: ${GTFS_CONFIG.realtimeTripUpdateInterval}ms`,
    );
    console.log(
      `Service alert update interval: ${GTFS_CONFIG.realtimeServiceAlertUpdateInterval}ms`,
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

export async function triggerVehiclePositions(): Promise<void> {
  const state = getWorkerState();
  // no need to force, checked often enough
  state.lastVehicleConsumerActivityTime = Date.now();
  await ensureWorkerRunning(state);
}

export async function triggerTripUpdates(): Promise<void> {
  const state = getWorkerState();
  const now = Date.now();
  if (!state.started) {
    await ensureWorkerRunning(state);
  } else {
    // force update if no activity the last update period
    if (
      now - state.lastTripUpdateConsumerActivityTime >
      GTFS_CONFIG.realtimeTripUpdateInterval
    ) {
      console.log("Forcing trip update tick due to consumer activity");
      void runTripUpdateTick(true);
    }
  }
  state.lastTripUpdateConsumerActivityTime = now;
}

export async function triggerServiceAlerts(): Promise<void> {
  const state = getWorkerState();
  state.lastServiceAlertConsumerActivityTime = Date.now();
  await ensureWorkerRunning(state);
}
