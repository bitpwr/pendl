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
  storeVehicleSnapshot,
} from "@/lib/redis/realtime";
import { buildVehicleList } from "./vehicle-snapshot";
import { publish, subscribedTags } from "./broadcast";
import { diffVehicles } from "./vehicle-delta";
import type { Vehicle } from "@/types/api";
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
  vehicleLastTick: Map<string, number>;
  publishedVehicles: Map<
    string,
    { seq: number; byId: Map<string, Vehicle>; payload: string }
  >;
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
      vehicleLastTick: new Map(),
      publishedVehicles: new Map(),
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
  const state = getWorkerState();

  // Recorded before the fetch, and whatever its outcome, so a feed that is
  // failing or quiet cannot make every new connection force a tick.
  state.vehicleLastTick.set(agencyTag, now);

  let vehiclePositions;
  try {
    vehiclePositions = await fetchVehiclePositions(agencyTag);
  } catch (err) {
    console.error(
      `Failed to fetch vehicle positions for ${agencyTag}:`,
      (err as Error).message,
    );
    return;
  }

  // Feed unchanged since the last tick - nothing new to publish. The stored
  // snapshot still expires though, and a client opening a stream has only
  // that to start from, so keep the last one alive rather than leaving the
  // next connection with nothing to draw.
  if (vehiclePositions === null) {
    const published = state.publishedVehicles.get(agencyTag);
    if (published) {
      await storeVehicleSnapshot(agencyTag, published.payload);
    }
    return;
  }

  await storeVehiclePositions(vehiclePositions);

  // Build the map payload here, once, rather than per request.
  const vehicles = await buildVehicleList(agencyTag, vehiclePositions);
  const updatedAt = new Date().toISOString();

  const previous = state.publishedVehicles.get(agencyTag);
  const seq = (previous?.seq ?? 0) + 1;

  // The stored snapshot is what a fresh reader gets, so it stays whole.
  const payload = JSON.stringify({
    type: "snapshot",
    seq,
    updatedAt,
    vehicles,
  });
  await storeVehicleSnapshot(agencyTag, payload);
  await setLastRealtimeUpdate();

  // Open streams already hold the previous set, so send only the change.
  // Descriptive fields are the bulk of a vehicle and never change mid-trip.
  publish(
    agencyTag,
    JSON.stringify(
      previous
        ? diffVehicles(previous.byId, vehicles, seq, updatedAt)
        : { type: "snapshot", seq, updatedAt, vehicles },
    ),
  );

  state.publishedVehicles.set(agencyTag, {
    seq,
    byId: new Map(vehicles.map((v) => [v.id, v])),
    payload,
  });

  const duration = Date.now() - startedAt;
  console.log(
    `Updated vehicle positions [${agencyTag}]: ${vehicles.length} vehicles (${duration}ms)`,
  );
}

async function updateTripUpdates(
  agencyTag: string,
  now: number,
): Promise<void> {
  const startedAt = now;

  let tripUpdates;
  try {
    tripUpdates = await fetchTripUpdates(agencyTag);
  } catch (err) {
    console.error(
      `Failed to fetch trip updates for ${agencyTag}:`,
      (err as Error).message,
    );
    return;
  }

  // Feed unchanged since the last tick - nothing to store.
  if (tripUpdates === null) {
    return;
  }

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

  let serviceAlerts;
  try {
    serviceAlerts = await fetchServiceAlerts(agencyTag);
  } catch (err) {
    console.error(
      `Failed to fetch service alerts for ${agencyTag}:`,
      (err as Error).message,
    );
    return;
  }

  // Feed unchanged since the last tick - nothing to store.
  if (serviceAlerts === null) {
    return;
  }

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

  const tags = new Set<string>();
  if (forceTag) {
    tags.add(forceTag);
  } else {
    for (const [tag, lastActivity] of state.vehicleConsumerActivity) {
      if (now - lastActivity < GTFS_CONFIG.realtimeVehicleUpdateInterval * 2) {
        tags.add(tag);
      }
    }

    // A streaming client never polls, so its activity timestamp goes stale
    // within two intervals. An open stream is the activity.
    for (const tag of subscribedTags()) {
      tags.add(tag);
    }
  }

  for (const tag of tags) {
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
): Promise<AgencyTag> {
  const tag = resolveTag(agencyId);
  const state = getWorkerState();
  const now = Date.now();
  state.vehicleConsumerActivity.set(tag, now);
  await ensureWorkerRunning(state, tag);

  // Switching agency reaches an already running worker that has not been
  // ticking this one, so its stored snapshot is stale or gone. Wait for a
  // tick rather than leaving the caller a whole interval short of data.
  const lastTick = state.vehicleLastTick.get(tag) ?? 0;
  if (now - lastTick > GTFS_CONFIG.realtimeVehicleUpdateInterval) {
    await runVehicleTick(tag);
  }

  return tag;
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
