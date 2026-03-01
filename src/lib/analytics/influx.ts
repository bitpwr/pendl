import { InfluxDB, Point, WriteApi } from "@influxdata/influxdb-client";

type InfluxState = {
  writeApi: WriteApi | null;
  flushInterval: NodeJS.Timeout | null;
  warnedMissingConfig: boolean;
  summaryWindowStartMs: number;
  vehicleDownloads: number;
  tripUpdateDownloads: number;
  serviceAlertDownloads: number;
  staticDownloads: number;
};

declare global {
  var __pendlInfluxState: InfluxState | undefined;
}

const DEFAULT_SUMMARY_INTERVAL_MS = 10 * 60 * 1000;

function getSummaryIntervalMs(): number {
  const raw = process.env.INFLUXDB_INTERVAL;
  if (!raw) {
    return DEFAULT_SUMMARY_INTERVAL_MS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_SUMMARY_INTERVAL_MS;
  }

  return Math.floor(parsed);
}

function getState(): InfluxState {
  if (!globalThis.__pendlInfluxState) {
    globalThis.__pendlInfluxState = {
      writeApi: null,
      flushInterval: null,
      warnedMissingConfig: false,
      summaryWindowStartMs: Date.now(),
      vehicleDownloads: 0,
      tripUpdateDownloads: 0,
      serviceAlertDownloads: 0,
      staticDownloads: 0,
    };
  }

  return globalThis.__pendlInfluxState;
}

function ensureSummaryInterval(): void {
  const state = getState();
  if (state.flushInterval) {
    return;
  }

  const intervalMs = getSummaryIntervalMs();

  state.flushInterval = setInterval(() => {
    void flushRealtimeSummary();
  }, intervalMs);
  state.flushInterval.unref();
}

function getWriteApi(): WriteApi | null {
  const state = getState();
  if (state.writeApi) {
    return state.writeApi;
  }

  const token = process.env.INFLUXDB_TOKEN;
  const url = process.env.INFLUXDB_URL;
  const org = process.env.INFLUXDB_ORG;
  const bucket = process.env.INFLUXDB_BUCKET;

  if (!token || !url || !org || !bucket) {
    if (!state.warnedMissingConfig) {
      console.info(
        "InfluxDB analytics disabled (missing INFLUXDB_TOKEN/INFLUXDB_URL/INFLUXDB_ORG/INFLUXDB_BUCKET)",
      );
      state.warnedMissingConfig = true;
    }
    return null;
  }

  const influx = new InfluxDB({ url, token });
  state.writeApi = influx.getWriteApi(org, bucket, "ms", {
    batchSize: 1,
    flushInterval: 1_000,
    maxRetries: 1,
  });

  return state.writeApi;
}

async function writePoint(point: Point): Promise<void> {
  const writeApi = getWriteApi();
  if (!writeApi) {
    return;
  }

  try {
    writeApi.writePoint(point);
    await writeApi.flush();
  } catch (error) {
    console.error("Failed to write analytics point to InfluxDB", error);
  }
}

export async function trackPageLoad(
  page: "area" | "trip" | "map",
  value: string,
): Promise<void> {
  const point = new Point("page_loads")
    .tag("page", page)
    .stringField("value", value || "")
    .intField("count", 1)
    .timestamp(new Date());

  await writePoint(point);
}

export function trackVehicleDownload(): void {
  const state = getState();
  ensureSummaryInterval();
  state.vehicleDownloads += 1;
}

export function trackTripUpdateDownload(): void {
  const state = getState();
  ensureSummaryInterval();
  state.tripUpdateDownloads += 1;
}

export function trackServiceAlertDownload(): void {
  const state = getState();
  ensureSummaryInterval();
  state.serviceAlertDownloads += 1;
}

export function trackStaticDownload(): void {
  const state = getState();
  ensureSummaryInterval();
  state.staticDownloads += 1;
}

export async function flushRealtimeSummary(): Promise<void> {
  const state = getState();
  const now = Date.now();
  const elapsedMs = now - state.summaryWindowStartMs;

  if (elapsedMs < 60000) {
    return;
  }

  const windowSeconds = Math.max(elapsedMs / 1000, 1);

  const point = new Point("gtfs_downloads")
    .intField("vehicle", state.vehicleDownloads)
    .intField("tripupdate", state.tripUpdateDownloads)
    .intField("servicealert", state.serviceAlertDownloads)
    .intField("static", state.staticDownloads)
    .floatField("window_seconds", windowSeconds)
    .timestamp(new Date(now));

  await writePoint(point);

  state.summaryWindowStartMs = now;
  state.vehicleDownloads = 0;
  state.tripUpdateDownloads = 0;
  state.serviceAlertDownloads = 0;
  state.staticDownloads = 0;
}
