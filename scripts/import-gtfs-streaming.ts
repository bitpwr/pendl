#!/usr/bin/env npx tsx
/**
 * Memory-efficient GTFS Static Data Import Worker
 *
 * This version processes GTFS files one at a time in streaming mode
 * to avoid loading all data into memory at once.
 *
 * Usage:
 *   node --max-old-space-size=4096 --env-file=.env ./node_modules/.bin/tsx scripts/import-gtfs-streaming.ts
 *
 */

import { downloadGtfsStatic, getLatestGtfsZip } from "@/lib/gtfs/download";
import { parseGtfsFile } from "@/lib/gtfs/parser";
import { isIncludedAgency } from "@/lib/config/agencies";
import { statSync } from "fs";
import { closePool, getPool } from "@/lib/db";
import type { PoolClient } from "pg";

async function main() {
  const args = process.argv.slice(2);
  const forceDownload = args.includes("--force") || args.includes("-f");
  const useExisting = args.includes("--use-existing");

  const startTime = Date.now();
  console.log("=== GTFS Static Import Worker (Streaming Mode) ===");
  console.log(`Time: ${new Date().toISOString()}`);
  console.log("Memory limit: " + (process.env.NODE_OPTIONS || "default"));
  console.log("");

  try {
    let zipPath: string | null = null;

    if (useExisting) {
      zipPath = getLatestGtfsZip();
      if (!zipPath) {
        console.log("No existing GTFS zip found, downloading...");
        zipPath = await downloadGtfsStatic();
      } else {
        console.log(`Using existing GTFS zip: ${zipPath}`);
      }
    } else if (forceDownload) {
      console.log("Force download requested");
      zipPath = await downloadGtfsStatic();
    } else {
      const existing = getLatestGtfsZip();
      if (existing) {
        const stat = statSync(existing);
        const ageMs = Date.now() - stat.mtime.getTime();
        const ageHours = ageMs / (1000 * 60 * 60);

        if (ageHours < 24 * 5) {
          console.log(
            `Using recent GTFS zip (${ageHours.toFixed(1)}h old): ${existing}`,
          );
          zipPath = existing;
        } else {
          console.log(
            `Existing GTFS zip is ${ageHours.toFixed(1)}h old, downloading fresh...`,
          );
          zipPath = await downloadGtfsStatic();
        }
      } else {
        console.log("No existing GTFS zip found, downloading...");
        zipPath = await downloadGtfsStatic();
      }
    }

    console.log("");
    console.log("Importing from: " + zipPath);
    console.log("");

    await importGtfsStreaming(zipPath);
    const elapsedMs = Date.now() - startTime;
    const elapsedMin = (elapsedMs / 1000 / 60).toFixed(1);

    console.log("");
    console.log(`=== Import complete, took ${elapsedMin} minutes ===`);
  } catch (error) {
    console.error("Import failed:", error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

/**
 * Stream GTFS data directly to database without loading everything into memory
 */
async function importGtfsStreaming(zipPath: string) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    console.log("Clearing existing data...");
    await client.query(
      "TRUNCATE agencies, stops, routes, trips, stop_times, calendar, calendar_dates, shapes, areas, stop_areas CASCADE",
    );

    // Phase 1: Parse agencies first to build filter
    console.log("\n=== Phase 1: Agencies ===");
    const agencies = await parseGtfsFile(zipPath, "agency.txt", {
      filter: (row) => isIncludedAgency(row.agency_id),
    });
    const agencyIds = new Set(agencies.used.map((a) => a.agency_id));
    console.log(
      `Found ${agencies.used.length} agencies to import out of ${agencies.total}`,
    );

    await importAgencies(client, agencies.used);

    // Phase 2: Routes (filtered by agency)
    console.log("\n=== Phase 2: Routes ===");
    const routes = await parseGtfsFile(zipPath, "routes.txt", {
      filter: (row) => agencyIds.has(row.agency_id),
    });
    const routeIds = new Set(routes.used.map((r) => r.route_id));
    console.log(
      `Found ${routes.used.length} routes to import out of ${routes.total}`,
    );

    await importRoutes(client, routes.used);

    // Phase 3: Trips (filtered by route)
    console.log("\n=== Phase 3: Trips ===");
    const trips = await parseGtfsFile(zipPath, "trips.txt", {
      filter: (row) => routeIds.has(row.route_id),
    });
    const tripIds = new Set(trips.used.map((t) => t.trip_id));
    const serviceIds = new Set(trips.used.map((t) => t.service_id));
    const shapeIds = new Set(trips.used.map((t) => t.shape_id).filter(Boolean));
    console.log(
      `Found ${trips.used.length} trips to import out of ${trips.total}`,
    );

    await importTrips(client, trips.used);

    // Clear trips from memory - we only need the IDs now
    trips.used.length = 0;

    // Phase 4: Calendar (filtered by service)
    console.log("\n=== Phase 4: Calendar ===");
    const calendar = await parseGtfsFile(zipPath, "calendar.txt", {
      filter: (row) => serviceIds.has(row.service_id),
    });
    console.log(
      `Found ${calendar.used.length} calendar entries to import out of ${calendar.total}`,
    );

    await importCalendar(client, calendar.used);

    // Phase 5: Calendar Dates
    console.log("\n=== Phase 5: Calendar Dates ===");
    const calendarDates = await parseGtfsFile(zipPath, "calendar_dates.txt", {
      filter: (row) => serviceIds.has(row.service_id),
    });
    console.log(
      `Found ${calendarDates.used.length} calendar date exceptions to import out of ${calendarDates.total}`,
    );

    await importCalendarDates(client, calendarDates.used);

    // Phase 6: Parse Stop Times to collect stop IDs (don't import yet)
    console.log("\n=== Phase 6: Parse Stop Times ===");
    const stopIds = new Set<string>();
    const stopTimeResult = await parseGtfsFile(zipPath, "stop_times.txt", {
      filter: (row) => tripIds.has(row.trip_id),
    });

    // Collect stop IDs (needed to filter stops)
    for (const st of stopTimeResult.used) {
      stopIds.add(st.stop_id);
    }

    console.log(
      `Found ${stopTimeResult.used.length} stop times (will import after stops), total in file: ${stopTimeResult.total}`,
    );

    // Phase 7: Stops (filtered by usage) - MUST be imported before stop_times
    console.log("\n=== Phase 7: Stops ===");
    const stops = await parseGtfsFile(zipPath, "stops.txt", {
      filter: (row) =>
        stopIds.has(row.stop_id) || stopIds.has(row.parent_station),
    });
    // const parentStations = new Set(
    //   stops.used.map((s) => s.parent_station).filter(Boolean),
    // );
    console.log(
      `Found ${stops.used.length} stops to import out of ${stops.total}`,
    );

    await importStops(client, stops.used);

    // Phase 6b: Now import Stop Times (after stops exist)
    console.log("\n=== Phase 6b: Import Stop Times ===");
    await importStopTimesBatched(client, stopTimeResult.used);

    // Clear stop times from memory
    stopTimeResult.used.length = 0;

    // Phase 8: Shapes (filtered by usage)
    console.log("\n=== Phase 8: Shapes ===");
    const shapes = await parseGtfsFile(zipPath, "shapes.txt", {
      filter: (row) => shapeIds.has(row.shape_id),
    });
    console.log(
      `Found ${shapes.used.length} shape points to import out of ${shapes.total}`,
    );

    await importShapesBatched(client, shapes.used);

    // Clear shapes from memory
    shapes.used.length = 0;

    // Phase 9: Stop Areas - parse first to determine which areas are needed
    console.log("\n=== Phase 9: Stop Areas ===");
    const stopAreas = await parseGtfsFile(zipPath, "stop_areas.txt");

    // Find which area_ids are actually used (have child stops in imported data)
    const parentToStopsForFilter = new Map<string, string[]>();
    for (const stop of stops.used) {
      if (stop.parent_station) {
        const children = parentToStopsForFilter.get(stop.parent_station) || [];
        children.push(stop.stop_id);
        parentToStopsForFilter.set(stop.parent_station, children);
      }
    }
    const usedAreaIds = new Set(
      stopAreas.used
        .filter((sa) => parentToStopsForFilter.has(sa.stop_id))
        .map((sa) => sa.area_id),
    );
    console.log(
      `Found ${stopAreas.used.length} stop-area mappings out of ${stopAreas.total}, referencing ${usedAreaIds.size} areas`,
    );

    // Phase 10: Areas - filtered to only those referenced by used stop_areas
    console.log("\n=== Phase 10: Areas ===");
    const areas = await parseGtfsFile(zipPath, "areas.txt", {
      filter: (row) => usedAreaIds.has(row.area_id),
    });
    console.log(
      `Found ${areas.used.length} areas to import out of ${areas.total}`,
    );

    await importAreas(client, areas.used);
    await importStopAreas(client, stopAreas.used, stops.used);

    console.log("\n=== Finalizing ===");
    console.log("Updating search vectors...");
    await client.query(`
      UPDATE stops SET search_vector =
        setweight(to_tsvector('swedish', COALESCE(stop_name, '')), 'A') ||
        setweight(to_tsvector('swedish', COALESCE(platform_code, '')), 'B')
    `);

    await client.query(`
      UPDATE areas SET search_vector =
        setweight(to_tsvector('swedish', COALESCE(area_name, '')), 'A')
    `);

    await client.query("COMMIT");
    console.log("Transaction committed.");

    console.log("\nRefreshing materialized views...");
    await client.query("REFRESH MATERIALIZED VIEW stop_route_types");
    await client.query("REFRESH MATERIALIZED VIEW shape_lines");
    await client.query("REFRESH MATERIALIZED VIEW area_route_types");
    await client.query("REFRESH MATERIALIZED VIEW area_locations");
    await client.query("REFRESH MATERIALIZED VIEW area_agencies");

    console.log("Import completed successfully!");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Import functions (same as importer.ts but standalone)

async function importAgencies(
  client: PoolClient,
  agencies: Record<string, string>[],
): Promise<void> {
  for (const a of agencies) {
    await client.query(
      `INSERT INTO agencies (agency_id, agency_name, agency_url, agency_timezone, agency_lang, agency_phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (agency_id) DO NOTHING`,
      [
        a.agency_id,
        a.agency_name,
        a.agency_url,
        a.agency_timezone || "Europe/Stockholm",
        a.agency_lang || "sv",
        a.agency_phone || null,
      ],
    );
  }
  console.log(`  Imported ${agencies.length} agencies`);
}

async function importStops(
  client: PoolClient,
  stops: Record<string, string>[],
): Promise<void> {
  const batchSize = 1000;
  for (let i = 0; i < stops.length; i += batchSize) {
    const batch = stops.slice(i, i + batchSize);
    const values: unknown[] = [];
    const placeholders: string[] = [];

    batch.forEach((s, idx) => {
      const offset = idx * 7;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`,
      );
      values.push(
        s.stop_id,
        s.stop_name,
        parseFloat(s.stop_lat) || null,
        parseFloat(s.stop_lon) || null,
        parseInt(s.location_type) || 0,
        s.parent_station || null,
        s.platform_code || null,
      );
    });

    await client.query(
      `INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, location_type, parent_station, platform_code)
       VALUES ${placeholders.join(", ")}
       ON CONFLICT (stop_id) DO NOTHING`,
      values,
    );
  }
  console.log(`  Imported ${stops.length} stops`);
}

async function importRoutes(
  client: PoolClient,
  routes: Record<string, string>[],
): Promise<void> {
  for (const r of routes) {
    await client.query(
      `INSERT INTO routes (route_id, agency_id, route_short_name, route_long_name, route_type)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (route_id) DO NOTHING`,
      [
        r.route_id,
        r.agency_id,
        r.route_short_name || null,
        r.route_long_name || null,
        parseInt(r.route_type) || 3,
      ],
    );
  }
  console.log(`  Imported ${routes.length} routes`);
}

async function importCalendar(
  client: PoolClient,
  calendar: Record<string, string>[],
): Promise<void> {
  for (const c of calendar) {
    await client.query(
      `INSERT INTO calendar (service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (service_id) DO NOTHING`,
      [
        c.service_id,
        c.monday === "1",
        c.tuesday === "1",
        c.wednesday === "1",
        c.thursday === "1",
        c.friday === "1",
        c.saturday === "1",
        c.sunday === "1",
        c.start_date,
        c.end_date,
      ],
    );
  }
  console.log(`  Imported ${calendar.length} calendar entries`);
}

async function importCalendarDates(
  client: PoolClient,
  calendarDates: Record<string, string>[],
): Promise<void> {
  for (const cd of calendarDates) {
    await client.query(
      `INSERT INTO calendar_dates (service_id, date, exception_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (service_id, date) DO NOTHING`,
      [cd.service_id, cd.date, parseInt(cd.exception_type)],
    );
  }
  console.log(`  Imported ${calendarDates.length} calendar date exceptions`);
}

async function importTrips(
  client: PoolClient,
  trips: Record<string, string>[],
): Promise<void> {
  const batchSize = 1000;
  for (let i = 0; i < trips.length; i += batchSize) {
    const batch = trips.slice(i, i + batchSize);
    const values: unknown[] = [];
    const placeholders: string[] = [];

    batch.forEach((t, idx) => {
      const offset = idx * 5;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`,
      );
      values.push(
        t.trip_id,
        t.route_id,
        t.service_id,
        parseInt(t.direction_id) || 0,
        t.shape_id || null,
      );
    });

    await client.query(
      `INSERT INTO trips (trip_id, route_id, service_id, direction_id, shape_id)
       VALUES ${placeholders.join(", ")}
       ON CONFLICT (trip_id) DO NOTHING`,
      values,
    );
  }
  console.log(`  Imported ${trips.length} trips`);
}

async function importStopTimesBatched(
  client: PoolClient,
  stopTimes: Record<string, string>[],
): Promise<void> {
  const batchSize = 5000;
  for (let i = 0; i < stopTimes.length; i += batchSize) {
    const batch = stopTimes.slice(i, i + batchSize);
    const values: unknown[] = [];
    const placeholders: string[] = [];

    batch.forEach((st, idx) => {
      const offset = idx * 6;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`,
      );
      values.push(
        st.trip_id,
        st.stop_id,
        st.arrival_time,
        st.departure_time,
        parseInt(st.stop_sequence),
        st.stop_headsign || null,
      );
    });

    await client.query(
      `INSERT INTO stop_times (trip_id, stop_id, arrival_time, departure_time, stop_sequence, stop_headsign)
       VALUES ${placeholders.join(", ")}
       ON CONFLICT (trip_id, stop_sequence) DO NOTHING`,
      values,
    );

    if ((i + batchSize) % 50000 === 0) {
      const memUsage = process.memoryUsage();
      console.log(
        `  Progress: ${i + batchSize}/${stopTimes.length} | Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      );
    }
  }
  console.log(`  Imported ${stopTimes.length} stop times`);
}

async function importShapesBatched(
  client: PoolClient,
  shapes: Record<string, string>[],
): Promise<void> {
  const batchSize = 5000;
  for (let i = 0; i < shapes.length; i += batchSize) {
    const batch = shapes.slice(i, i + batchSize);
    const values: unknown[] = [];
    const placeholders: string[] = [];

    batch.forEach((s, idx) => {
      const offset = idx * 5;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`,
      );
      values.push(
        s.shape_id,
        parseFloat(s.shape_pt_lat),
        parseFloat(s.shape_pt_lon),
        parseInt(s.shape_pt_sequence),
        parseFloat(s.shape_dist_traveled) || null,
      );
    });

    await client.query(
      `INSERT INTO shapes (shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence, shape_dist_traveled)
       VALUES ${placeholders.join(", ")}
       ON CONFLICT (shape_id, shape_pt_sequence) DO NOTHING`,
      values,
    );

    if ((i + batchSize) % 50000 === 0) {
      const memUsage = process.memoryUsage();
      console.log(
        `  Progress: ${i + batchSize}/${shapes.length} | Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      );
    }
  }
  console.log(`  Imported ${shapes.length} shape points`);
}

async function importAreas(
  client: PoolClient,
  areas: Record<string, string>[],
): Promise<void> {
  const batchSize = 1000;
  for (let i = 0; i < areas.length; i += batchSize) {
    const batch = areas.slice(i, i + batchSize);
    const values: unknown[] = [];
    const placeholders: string[] = [];

    batch.forEach((a, idx) => {
      const offset = idx * 2;
      placeholders.push(`($${offset + 1}, $${offset + 2})`);
      values.push(a.area_id, a.area_name);
    });

    await client.query(
      `INSERT INTO areas (area_id, area_name)
       VALUES ${placeholders.join(", ")}
       ON CONFLICT (area_id) DO NOTHING`,
      values,
    );
  }
  console.log(`  Imported ${areas.length} areas`);
}

async function importStopAreas(
  client: PoolClient,
  stopAreas: Record<string, string>[],
  stops: Record<string, string>[],
): Promise<void> {
  const parentToStops = new Map<string, string[]>();
  for (const stop of stops) {
    if (stop.parent_station) {
      const children = parentToStops.get(stop.parent_station) || [];
      children.push(stop.stop_id);
      parentToStops.set(stop.parent_station, children);
    }
  }

  const expandedStopAreas: { areaId: string; stopId: string }[] = [];
  for (const sa of stopAreas) {
    const childStops = parentToStops.get(sa.stop_id);
    if (childStops) {
      for (const stopId of childStops) {
        expandedStopAreas.push({ areaId: sa.area_id, stopId });
      }
    }
  }

  const batchSize = 1000;
  for (let i = 0; i < expandedStopAreas.length; i += batchSize) {
    const batch = expandedStopAreas.slice(i, i + batchSize);
    const values: unknown[] = [];
    const placeholders: string[] = [];

    batch.forEach((sa, idx) => {
      const offset = idx * 2;
      placeholders.push(`($${offset + 1}, $${offset + 2})`);
      values.push(sa.areaId, sa.stopId);
    });

    if (placeholders.length > 0) {
      await client.query(
        `INSERT INTO stop_areas (area_id, stop_id)
         VALUES ${placeholders.join(", ")}
         ON CONFLICT (area_id, stop_id) DO NOTHING`,
        values,
      );
    }
  }
  console.log(
    `  Imported ${expandedStopAreas.length} stop-area mappings (from ${stopAreas.length} GTFS entries)`,
  );
}

main();
