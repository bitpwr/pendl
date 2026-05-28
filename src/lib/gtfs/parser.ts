import { parse } from "csv-parse";
import * as unzipper from "unzipper";
import type { GtfsFileName } from "./config";

export interface ParseOptions {
  /** Filter rows during parsing */
  filter?: (row: Record<string, string>) => boolean;
  /** Transform row values */
  transform?: (row: Record<string, string>) => Record<string, string>;
  /** Limit number of rows (for testing) */
  limit?: number;
  /**
   * Called for each row passing the filter. When provided, rows are NOT
   * accumulated in `used` (which will be empty). Supports async — the parser
   * pauses until the returned promise resolves, providing backpressure.
   */
  onRow?: (row: Record<string, string>) => void | Promise<void>;
}

/**
 * Parse a CSV file from a GTFS zip.
 * Uses random-access open (reads central directory) to seek directly to the
 * target file, avoiding sequential decompression of the entire archive.
 * Returns both the used rows and the total count of rows in the file (before filtering).
 */
export async function parseGtfsFile<T extends Record<string, string>>(
  zipPath: string,
  fileName: GtfsFileName,
  options: ParseOptions = {},
): Promise<{ used: T[]; total: number }> {
  const { filter, transform, limit, onRow } = options;
  const results: T[] = [];

  // Open the zip by reading its central directory, then seek to the target file.
  const directory = await unzipper.Open.file(zipPath);
  const entry = directory.files.find((f) => f.path === fileName);
  if (!entry) {
    return { used: [], total: 0 };
  }

  return new Promise((resolve, reject) => {
    const fileStream = entry.stream();
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    fileStream.pipe(parser);

    let count = 0;
    parser.on("data", (row: Record<string, string>) => {
      count += 1;
      if (limit && results.length >= limit) {
        return;
      }

      let processedRow = row;
      if (transform) {
        processedRow = transform(row);
      }

      if (!filter || filter(processedRow)) {
        if (onRow) {
          const result = onRow(processedRow);
          if (result instanceof Promise) {
            parser.pause();
            result.then(() => parser.resume()).catch(reject);
          }
        } else {
          results.push(processedRow as T);
        }
      }
    });

    parser.on("end", () => {
      resolve({ used: results, total: count });
    });

    parser.on("error", reject);
    fileStream.on("error", reject);
  });
}

/**
 * Parse all GTFS files from a zip
 */
export async function parseGtfsZip(
  zipPath: string,
  options: {
    agencyFilter?: (agencyId: string) => boolean;
    limit?: number;
  } = {},
): Promise<{
  agencies: Record<string, string>[];
  stops: Record<string, string>[];
  routes: Record<string, string>[];
  trips: Record<string, string>[];
  stopTimes: Record<string, string>[];
  calendar: Record<string, string>[];
  calendarDates: Record<string, string>[];
  shapes: Record<string, string>[];
  areas: Record<string, string>[];
  stopAreas: Record<string, string>[];
}> {
  const { agencyFilter, limit } = options;

  console.log("Parsing agencies...");
  const agencies = await parseGtfsFile(zipPath, "agency.txt", {
    filter: agencyFilter ? (row) => agencyFilter(row.agency_id) : undefined,
    limit,
  });
  const agencyIds = new Set(agencies.used.map((a) => a.agency_id));
  console.log(`Found ${agencies.used.length} (${agencies.total}) agencies`);

  console.log("Parsing routes...");
  const routes = await parseGtfsFile(zipPath, "routes.txt", {
    filter: agencyFilter ? (row) => agencyIds.has(row.agency_id) : undefined,
    limit,
  });
  const routeIds = new Set(routes.used.map((r) => r.route_id));
  console.log(`Found ${routes.used.length} (${routes.total}) routes`);
  console.log("Parsing trips...");
  const trips = await parseGtfsFile(zipPath, "trips.txt", {
    filter: agencyFilter ? (row) => routeIds.has(row.route_id) : undefined,
    limit,
  });
  const tripIds = new Set(trips.used.map((t) => t.trip_id));
  const serviceIds = new Set(trips.used.map((t) => t.service_id));
  const shapeIds = new Set(trips.used.map((t) => t.shape_id).filter(Boolean));
  console.log(`Found ${trips.used.length} (${trips.total}) trips`);

  console.log("Parsing stop_times...");
  const stopTimes = await parseGtfsFile(zipPath, "stop_times.txt", {
    filter: agencyFilter ? (row) => tripIds.has(row.trip_id) : undefined,
    limit,
  });
  const stopIds = new Set(stopTimes.used.map((st) => st.stop_id));
  console.log(`Found ${stopTimes.used.length} (${stopTimes.total}) stop times`);
  console.log("Parsing stops...");
  const stops = await parseGtfsFile(zipPath, "stops.txt", {
    filter: agencyFilter
      ? (row) => stopIds.has(row.stop_id) || stopIds.has(row.parent_station)
      : undefined,
    limit,
  });
  // Collect parent_station values - stop_areas.txt uses these
  const parsedParentStations = new Set(
    stops.used.map((s) => s.parent_station).filter(Boolean),
  );
  console.log(`Found ${stops.used.length} (${stops.total}) stops`);

  console.log("Parsing calendar...");
  const calendar = await parseGtfsFile(zipPath, "calendar.txt", {
    filter: agencyFilter ? (row) => serviceIds.has(row.service_id) : undefined,
    limit,
  });
  console.log(
    `Found ${calendar.used.length} (${calendar.total}) calendar entries`,
  );

  console.log("Parsing calendar_dates...");
  const calendarDates = await parseGtfsFile(zipPath, "calendar_dates.txt", {
    filter: agencyFilter ? (row) => serviceIds.has(row.service_id) : undefined,
    limit,
  });
  console.log(
    `Found ${calendarDates.used.length} (${calendarDates.total}) calendar date exceptions`,
  );

  console.log("Parsing shapes...");
  const shapes = await parseGtfsFile(zipPath, "shapes.txt", {
    filter: agencyFilter ? (row) => shapeIds.has(row.shape_id) : undefined,
  });
  console.log(`Found ${shapes.used.length} (${shapes.total}) shape points`);

  // Parse stop_areas first to find which areas contain our stops
  // stop_areas.txt maps area_id to parent_station IDs (not individual platform stop_ids)
  console.log("Parsing stop_areas...");
  const allStopAreas = await parseGtfsFile(zipPath, "stop_areas.txt", {});
  // Filter to only include stop_areas that reference parent stations we have
  const stopAreas = agencyFilter
    ? allStopAreas.used.filter((row) => parsedParentStations.has(row.stop_id))
    : allStopAreas.used;
  const areaIds = new Set(stopAreas.map((sa) => sa.area_id));
  console.log(`Found ${stopAreas.length} stop-area mappings`);

  console.log("Parsing areas...");
  const areas = await parseGtfsFile(zipPath, "areas.txt", {
    filter: agencyFilter ? (row) => areaIds.has(row.area_id) : undefined,
  });
  console.log(`Found ${areas.used.length} (${areas.total}) areas`);
  return {
    agencies: agencies.used,
    stops: stops.used,
    routes: routes.used,
    trips: trips.used,
    stopTimes: stopTimes.used,
    calendar: calendar.used,
    calendarDates: calendarDates.used,
    shapes: shapes.used,
    areas: areas.used,
    stopAreas: stopAreas,
  };
}
