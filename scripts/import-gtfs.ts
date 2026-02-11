#!/usr/bin/env npx tsx
/**
 * GTFS Static Data Import Worker
 *
 * This script downloads the GTFS static data from Trafiklab,
 * parses it, and imports it into the PostgreSQL database.
 *
 * Usage:
 *   npx tsx scripts/import-gtfs.ts
 *
 * Environment variables:
 *   GTFS_STATIC_URL - URL to download GTFS zip (default: SL's feed)
 *   TRAFIKLAB_API_KEY - API key for Trafiklab (if required)
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD - Database connection
 */

import { downloadGtfsStatic, getLatestGtfsZip } from "@/lib/gtfs/download";
import { parseGtfsZip } from "@/lib/gtfs/parser";
import { importGtfsToDatabase } from "@/lib/gtfs/importer";
import { isIncludedAgency } from "@/lib/config/agencies";
import { statSync } from "fs";
import { closePool } from "@/lib/db";

async function main() {
  const args = process.argv.slice(2);
  const forceDownload = args.includes("--force") || args.includes("-f");
  const useExisting = args.includes("--use-existing");

  console.log("=== GTFS Static Import Worker ===");
  console.log(`Time: ${new Date().toISOString()}`);
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
      // Check if we need to download
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
    console.log(`Parsing GTFS data from '${zipPath}'...`);

    const data = await parseGtfsZip(zipPath, {
      agencyFilter: isIncludedAgency,
      limit: undefined,
    });

    console.log("");
    console.log("Importing to database...");
    await importGtfsToDatabase(data);

    console.log("");
    console.log("=== Import Complete ===");
    console.log(`Agencies: ${data.agencies.length}`);
    console.log(`Stops: ${data.stops.length}`);
    console.log(`Routes: ${data.routes.length}`);
    console.log(`Trips: ${data.trips.length}`);
    console.log(`Stop Times: ${data.stopTimes.length}`);
    console.log(`Calendar: ${data.calendar.length}`);
    console.log(`Calendar Dates: ${data.calendarDates.length}`);
    console.log(`Shapes: ${data.shapes.length}`);
    console.log(`Areas: ${data.areas.length}`);
    console.log(`Stop-Area Mappings: ${data.stopAreas.length}`);
  } catch (error) {
    console.error("Import failed:", error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();
