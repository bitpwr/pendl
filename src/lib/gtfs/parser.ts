import { createReadStream } from "fs";
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
}

/**
 * Parse a CSV file from a GTFS zip
 */
export async function parseGtfsFile<T extends Record<string, string>>(
  zipPath: string,
  fileName: GtfsFileName,
  options: ParseOptions = {},
): Promise<T[]> {
  const { filter, transform, limit } = options;
  const results: T[] = [];

  return new Promise((resolve, reject) => {
    const zipStream = createReadStream(zipPath).pipe(unzipper.Parse());

    zipStream.on("entry", async (entry) => {
      if (entry.path === fileName) {
        const parser = parse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
        });

        entry.pipe(parser);

        parser.on("data", (row: Record<string, string>) => {
          if (limit && results.length >= limit) {
            return;
          }

          let processedRow = row;
          if (transform) {
            processedRow = transform(row);
          }

          if (!filter || filter(processedRow)) {
            results.push(processedRow as T);
          }
        });

        parser.on("end", () => {
          resolve(results);
        });

        parser.on("error", reject);
      } else {
        entry.autodrain();
      }
    });

    zipStream.on("error", reject);
    zipStream.on("close", () => {
      // File not found in zip
      if (results.length === 0) {
        resolve([]);
      }
    });
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
  const agencyIds = new Set(agencies.map((a) => a.agency_id));
  console.log(`Found ${agencies.length} agencies`);

  console.log("Parsing routes...");
  const routes = await parseGtfsFile(zipPath, "routes.txt", {
    filter: agencyFilter ? (row) => agencyIds.has(row.agency_id) : undefined,
    limit,
  });
  const routeIds = new Set(routes.map((r) => r.route_id));
  console.log(`Found ${routes.length} routes`);

  console.log("Parsing trips...");
  const trips = await parseGtfsFile(zipPath, "trips.txt", {
    filter: agencyFilter ? (row) => routeIds.has(row.route_id) : undefined,
    limit,
  });
  const tripIds = new Set(trips.map((t) => t.trip_id));
  const serviceIds = new Set(trips.map((t) => t.service_id));
  const shapeIds = new Set(trips.map((t) => t.shape_id).filter(Boolean));
  console.log(`Found ${trips.length} trips`);

  console.log("Parsing stop_times...");
  const stopTimes = await parseGtfsFile(zipPath, "stop_times.txt", {
    filter: agencyFilter ? (row) => tripIds.has(row.trip_id) : undefined,
    limit,
  });
  const stopIds = new Set(stopTimes.map((st) => st.stop_id));
  console.log(`Found ${stopTimes.length} stop times`);

  console.log("Parsing stops...");
  const stops = await parseGtfsFile(zipPath, "stops.txt", {
    filter: agencyFilter
      ? (row) => stopIds.has(row.stop_id) || stopIds.has(row.parent_station)
      : undefined,
    limit,
  });
  // Get all stop IDs from the parsed stops for filtering stop_areas
  const parsedStopIds = new Set(stops.map((s) => s.stop_id));
  // Also collect parent_station values - stop_areas.txt uses these
  const parsedParentStations = new Set(
    stops.map((s) => s.parent_station).filter(Boolean),
  );
  console.log(`Found ${stops.length} stops`);

  console.log("Parsing calendar...");
  const calendar = await parseGtfsFile(zipPath, "calendar.txt", {
    filter: agencyFilter ? (row) => serviceIds.has(row.service_id) : undefined,
    limit,
  });
  console.log(`Found ${calendar.length} calendar entries`);

  console.log("Parsing calendar_dates...");
  const calendarDates = await parseGtfsFile(zipPath, "calendar_dates.txt", {
    filter: agencyFilter ? (row) => serviceIds.has(row.service_id) : undefined,
    limit,
  });
  console.log(`Found ${calendarDates.length} calendar date exceptions`);

  console.log("Parsing shapes...");
  const shapes = await parseGtfsFile(zipPath, "shapes.txt", {
    filter: agencyFilter ? (row) => shapeIds.has(row.shape_id) : undefined,
  });
  console.log(`Found ${shapes.length} shape points`);

  // Parse stop_areas first to find which areas contain our stops
  // stop_areas.txt maps area_id to parent_station IDs (not individual platform stop_ids)
  console.log("Parsing stop_areas...");
  const allStopAreas = await parseGtfsFile(zipPath, "stop_areas.txt", {});
  // Filter to only include stop_areas that reference parent stations we have
  const stopAreas = agencyFilter
    ? allStopAreas.filter((row) => parsedParentStations.has(row.stop_id))
    : allStopAreas;
  const areaIds = new Set(stopAreas.map((sa) => sa.area_id));
  console.log(`Found ${stopAreas.length} stop-area mappings`);

  console.log("Parsing areas...");
  const areas = await parseGtfsFile(zipPath, "areas.txt", {
    filter: agencyFilter ? (row) => areaIds.has(row.area_id) : undefined,
  });
  console.log(`Found ${areas.length} areas`);

  return {
    agencies,
    stops,
    routes,
    trips,
    stopTimes,
    calendar,
    calendarDates,
    shapes,
    areas,
    stopAreas,
  };
}
