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
import {
  getAgencyTag,
  INCLUDED_AGENCIES,
  type AgencyTag,
} from "@/lib/config/agencies";

type RealtimeWorkerState = {
  started: boolean;
  startupPromise: Promise<void> | null;
  vehicleInterval: NodeJS.Timeout | null;
  tripUpdateInterval: NodeJS.Timeout | null;
  serviceAlertInterval: NodeJS.Timeout | null;
  vehicleConsumerActivity: Map<string, number>;
  tripUpdateConsumerActivity: Map<string, number>;
  serviceAlertConsumerActivity: Map<string, number>;
  vehicleUpdateInProgress: Set<string>;
  tripUpdateInProgress: Set<string>;
  serviceAlertUpdateInProgress: Set<string>;
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
      vehicleConsumerActivity: new Map(),
      tripUpdateConsumerActivity: new Map(),
      serviceAlertConsumerActivity: new Map(),
      vehicleUpdateInProgress: new Set(),
      tripUpdateInProgress: new Set(),
      serviceAlertUpdateInProgress: new Set(),
    };
  }

  return globalThis.__pendlRealtimeWorkerState;
}

function resolveTag(agencyId?: string): AgencyTag {
  if (agencyId) {
    const tag = getAgencyTag(agencyId);
    if (tag) return tag;
  }
  return INCLUDED_AGENCIES[0].tag;
}

async function updateVehiclePositions(
  agencyTag: string,
  now: number,
): Promise<void> {
  const startedAt = now;

  const vehiclePositions = await fetchVehiclePositions(agencyTag).catch(
    (err) => {
      console.error(
        `Failed to fetch vehicle positions for ${agencyTag}:`,
        err.message,
      );
      return [];
    },
  );

  await storeVehiclePositions(vehiclePositions);
  await setLastRealtimeUpdate();

  const duration = Date.now() - startedAt;
  console.log(
    `Updated vehicle positions [${agencyTag}]: ${vehiclePositions.length} vehicles (${duration}ms)`,
  );
}

async function updateTripUpdates(
  agencyTag: string,
  now: number,
): Promise<void> {
  const startedAt = now;

  const tripUpdates = await fetchTripUpdates(agencyTag).catch((err) => {
    console.error(
      `Failed to fetch trip updates for ${agencyTag}:`,
      err.message,
    );
    return [];
  });

  await storeTripUpdates(tripUpdates);
  await setLastRealtimeUpdate();

  const duration = Date.now() - startedAt;
  console.log(
    `Updated trip updates [${agencyTag}]: ${tripUpdates.length} entries (${duration}ms)`,
  );
}

async function updateServiceAlerts(
  agencyTag: string,
  now: number,
): Promise<void> {
  const startedAt = now;

  const serviceAlerts = await fetchServiceAlerts(agencyTag).catch((err) => {
    console.error(
      `Failed to fetch service alerts for ${agencyTag}:`,
      err.message,
    );
    return [];
  });

  await storeServiceAlerts(serviceAlerts);
  await setLastRealtimeUpdate();

  const duration = Date.now() - startedAt;
  console.log(
    `Updated service alerts [${agencyTag}]: ${serviceAlerts.length} entries (${duration}ms)`,
  );
}

async function runVehicleTick(forceTag?: string): Promise<void> {
  const state = getWorkerState();
  const now = Date.now();

  const tagsToUpdate: string[] = [];
  if (forceTag) {
    tagsToUpdate.push(forceTag);
  } else {
    for (const [tag, lastActivity] of state.vehicleConsumerActivity) {
      if (now - lastActivity < GTFS_CONFIG.realtimeVehicleUpdateInterval * 2) {
        tagsToUpdate.push(tag);
      }
    }
  }

  for (const tag of tagsToUpdate) {
    if (state.vehicleUpdateInProgress.has(tag)) continue;
    state.vehicleUpdateInProgress.add(tag);
    try {
      await updateVehiclePositions(tag, now);
    } catch (error) {
      console.error(`Error updating vehicle positions for ${tag}:`, error);
    } finally {
      state.vehicleUpdateInProgress.delete(tag);
    }
  }
}

async function runTripUpdateTick(forceTag?: string): Promise<void> {
  const state = getWorkerState();
  const now = Date.now();

  const tagsToUpdate: string[] = [];
  if (forceTag) {
    tagsToUpdate.push(forceTag);
  } else {
    for (const [tag, lastActivity] of state.tripUpdateConsumerActivity) {
      if (now - lastActivity < GTFS_CONFIG.realtimeTripUpdateInterval * 2) {
        tagsToUpdate.push(tag);
      }
    }
  }

  for (const tag of tagsToUpdate) {
    if (state.tripUpdateInProgress.has(tag)) continue;
    state.tripUpdateInProgress.add(tag);
    try {
      await updateTripUpdates(tag, now);
    } catch (error) {
      console.error(`Error updating trip updates for ${tag}:`, error);
    } finally {
      state.tripUpdateInProgress.delete(tag);
    }
  }
}

async function runServiceAlertTick(forceTag?: string): Promise<void> {
  const state = getWorkerState();
  const now = Date.now();

  const tagsToUpdate: string[] = [];
  if (forceTag) {
    tagsToUpdate.push(forceTag);
  } else {
    for (const [tag, lastActivity] of state.serviceAlertConsumerActivity) {
      if (
        now - lastActivity <
        GTFS_CONFIG.realtimeServiceAlertUpdateInterval * 2
      ) {
        tagsToUpdate.push(tag);
      }
    }
  }

  for (const tag of tagsToUpdate) {
    if (state.serviceAlertUpdateInProgress.has(tag)) continue;
    state.serviceAlertUpdateInProgress.add(tag);
    try {
      await updateServiceAlerts(tag, now);
    } catch (error) {
      console.error(`Error updating service alerts for ${tag}:`, error);
    } finally {
      state.serviceAlertUpdateInProgress.delete(tag);
    }
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
async function ensureWorkerRunning(
  state: RealtimeWorkerState,
  agencyTag: string,
): Promise<void> {
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
      runVehicleTick(agencyTag),
      runTripUpdateTick(agencyTag),
      runServiceAlertTick(agencyTag),
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

export async function triggerVehiclePositions(
  agencyId?: string,
): Promise<void> {
  const tag = resolveTag(agencyId);
  const state = getWorkerState();
  state.vehicleConsumerActivity.set(tag, Date.now());
  await ensureWorkerRunning(state, tag);
}

export async function triggerTripUpdates(agencyId?: string): Promise<void> {
  const tag = resolveTag(agencyId);
  const state = getWorkerState();
  const now = Date.now();
  if (!state.started) {
    state.tripUpdateConsumerActivity.set(tag, now);
    await ensureWorkerRunning(state, tag);
  } else {
    const lastActivity = state.tripUpdateConsumerActivity.get(tag) ?? 0;
    if (now - lastActivity > GTFS_CONFIG.realtimeTripUpdateInterval) {
      console.log(
        `Forcing trip update tick for ${tag} due to consumer activity`,
      );
      void runTripUpdateTick(tag);
    }
    state.tripUpdateConsumerActivity.set(tag, now);
  }
}

export async function triggerServiceAlerts(agencyId?: string): Promise<void> {
  const tag = resolveTag(agencyId);
  const state = getWorkerState();
  state.serviceAlertConsumerActivity.set(tag, Date.now());
  await ensureWorkerRunning(state, tag);
}
