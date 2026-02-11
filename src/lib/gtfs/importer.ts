import { getPool } from "@/lib/db";

interface ImportData {
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
}

/**
 * Import parsed GTFS data into PostgreSQL
 */
export async function importGtfsToDatabase(data: ImportData): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    console.log("Clearing existing data...");
    await client.query(
      "TRUNCATE agencies, stops, routes, trips, stop_times, calendar, calendar_dates, shapes, areas, stop_areas CASCADE",
    );

    console.log("Importing agencies...");
    await importAgencies(client, data.agencies);

    console.log("Importing stops...");
    await importStops(client, data.stops);

    console.log("Importing routes...");
    await importRoutes(client, data.routes);

    console.log("Importing calendar...");
    await importCalendar(client, data.calendar);

    console.log("Importing calendar_dates...");
    await importCalendarDates(client, data.calendarDates);

    console.log("Importing trips...");
    await importTrips(client, data.trips);

    console.log("Importing stop_times...");
    await importStopTimes(client, data.stopTimes);

    console.log("Importing shapes...");
    await importShapes(client, data.shapes);

    console.log("Importing areas...");
    await importAreas(client, data.areas);

    console.log("Importing stop_areas...");
    await importStopAreas(client, data.stopAreas, data.stops);

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

    console.log("Refreshing materialized views...");
    await client.query("REFRESH MATERIALIZED VIEW stop_route_types");
    await client.query("REFRESH MATERIALIZED VIEW shape_lines");
    await client.query("REFRESH MATERIALIZED VIEW area_route_types");
    await client.query("REFRESH MATERIALIZED VIEW area_locations");

    console.log("Import completed successfully!");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function importAgencies(
  client: import("pg").PoolClient,
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
  client: import("pg").PoolClient,
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
  client: import("pg").PoolClient,
  routes: Record<string, string>[],
): Promise<void> {
  for (const r of routes) {
    await client.query(
      `INSERT INTO routes (route_id, agency_id, route_short_name, route_long_name, route_desc, route_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (route_id) DO NOTHING`,
      [
        r.route_id,
        r.agency_id,
        r.route_short_name || null,
        r.route_long_name || null,
        r.route_desc || null,
        parseInt(r.route_type) || 3,
      ],
    );
  }
  console.log(`  Imported ${routes.length} routes`);
}

async function importCalendar(
  client: import("pg").PoolClient,
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
  client: import("pg").PoolClient,
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
  client: import("pg").PoolClient,
  trips: Record<string, string>[],
): Promise<void> {
  const batchSize = 1000;
  for (let i = 0; i < trips.length; i += batchSize) {
    const batch = trips.slice(i, i + batchSize);
    const values: unknown[] = [];
    const placeholders: string[] = [];

    batch.forEach((t, idx) => {
      const offset = idx * 8;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`,
      );
      values.push(
        t.trip_id,
        t.route_id,
        t.service_id,
        t.trip_headsign || null,
        t.trip_short_name || null,
        parseInt(t.direction_id) || 0,
        t.block_id || null,
        t.shape_id || null,
      );
    });

    await client.query(
      `INSERT INTO trips (trip_id, route_id, service_id, trip_headsign, trip_short_name, direction_id, block_id, shape_id)
       VALUES ${placeholders.join(", ")}
       ON CONFLICT (trip_id) DO NOTHING`,
      values,
    );
  }
  console.log(`  Imported ${trips.length} trips`);
}

async function importStopTimes(
  client: import("pg").PoolClient,
  stopTimes: Record<string, string>[],
): Promise<void> {
  const batchSize = 5000;
  for (let i = 0; i < stopTimes.length; i += batchSize) {
    const batch = stopTimes.slice(i, i + batchSize);
    const values: unknown[] = [];
    const placeholders: string[] = [];

    batch.forEach((st, idx) => {
      const offset = idx * 8;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`,
      );
      values.push(
        st.trip_id,
        st.stop_id,
        st.arrival_time,
        st.departure_time,
        parseInt(st.stop_sequence),
        st.stop_headsign || null,
        parseInt(st.pickup_type) || 0,
        parseInt(st.drop_off_type) || 0,
      );
    });

    await client.query(
      `INSERT INTO stop_times (trip_id, stop_id, arrival_time, departure_time, stop_sequence, stop_headsign, pickup_type, drop_off_type)
       VALUES ${placeholders.join(", ")}
       ON CONFLICT (trip_id, stop_sequence) DO NOTHING`,
      values,
    );

    if (i % 100000 === 0 && i > 0) {
      console.log(`  Imported ${i} / ${stopTimes.length} stop times...`);
    }
  }
  console.log(`  Imported ${stopTimes.length} stop times`);
}

async function importShapes(
  client: import("pg").PoolClient,
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

    if (i % 100000 === 0 && i > 0) {
      console.log(`  Imported ${i} / ${shapes.length} shape points...`);
    }
  }
  console.log(`  Imported ${shapes.length} shape points`);
}

async function importAreas(
  client: import("pg").PoolClient,
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
  client: import("pg").PoolClient,
  stopAreas: Record<string, string>[],
  stops: Record<string, string>[],
): Promise<void> {
  // Build a map from parent_station to list of child stop_ids
  const parentToStops = new Map<string, string[]>();
  for (const stop of stops) {
    if (stop.parent_station) {
      const children = parentToStops.get(stop.parent_station) || [];
      children.push(stop.stop_id);
      parentToStops.set(stop.parent_station, children);
    }
  }

  // Expand stop_areas: GTFS stop_areas.stop_id is actually a parent_station
  // We need to insert entries for each actual child stop
  const expandedStopAreas: { areaId: string; stopId: string }[] = [];
  for (const sa of stopAreas) {
    const childStops = parentToStops.get(sa.stop_id);
    if (childStops) {
      for (const stopId of childStops) {
        expandedStopAreas.push({ areaId: sa.area_id, stopId });
      }
    }
  }

  // Insert expanded stop_areas
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
