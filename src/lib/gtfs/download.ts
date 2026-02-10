import {
  createWriteStream,
  existsSync,
  mkdirSync,
  statSync,
  readdirSync,
} from "fs";
import { pipeline } from "stream/promises";
import { GTFS_CONFIG } from "./config";
import path from "path";

/**
 * Download GTFS static data zip file
 */
export async function downloadGtfsStatic(): Promise<string> {
  const dataDir = GTFS_CONFIG.dataDir;

  // Ensure data directory exists
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const zipPath = path.join(dataDir, `gtfs-${timestamp}.zip`);

  console.log(`Downloading GTFS data from ${GTFS_CONFIG.staticUrl}...`);

  const url = new URL(GTFS_CONFIG.staticUrl);
  if (GTFS_CONFIG.staticApiKey) {
    url.searchParams.set("key", GTFS_CONFIG.staticApiKey);
  }

  const response = await fetch(url.toString(), {
    headers: {
      accept: "application/zip",
      "Accept-encoding": "gzip",
      "If-Modified-Since": "Mon, 13 Jul 2020 04:24:36 GMT",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download GTFS data: ${response.status} ${response.statusText}`,
    );
  }

  if (!response.body) {
    throw new Error("Response body is null");
  }

  const fileStream = createWriteStream(zipPath);

  // Convert Web ReadableStream to Node ReadableStream
  const reader = response.body.getReader();
  const nodeStream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
      } else {
        controller.enqueue(value);
      }
    },
  });

  // Use pipeline for proper stream handling
  const { Readable } = await import("stream");
  await pipeline(
    Readable.fromWeb(nodeStream as import("stream/web").ReadableStream),
    fileStream,
  );

  console.log(`GTFS data downloaded to ${zipPath}`);
  return zipPath;
}

/**
 * Get the latest GTFS zip file path (if exists)
 */
export function getLatestGtfsZip(): string | null {
  const dataDir = GTFS_CONFIG.dataDir;

  if (!existsSync(dataDir)) {
    return null;
  }

  const files = readdirSync(dataDir)
    .filter((f: string) => f.startsWith("gtfs-") && f.endsWith(".zip"))
    .map((f: string) => ({
      name: f,
      path: path.join(dataDir, f),
      mtime: statSync(path.join(dataDir, f)).mtime,
    }))
    .sort(
      (a: { mtime: Date }, b: { mtime: Date }) =>
        b.mtime.getTime() - a.mtime.getTime(),
    );

  return files.length > 0 ? files[0].path : null;
}
