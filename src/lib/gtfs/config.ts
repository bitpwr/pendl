// SL (Storstockholms Lokaltrafik) GTFS Feed Configuration
// Data from Trafiklab: https://www.trafiklab.se/api/gtfs-regional/sl

export const GTFS_CONFIG = {
  // GTFS Static data URL - requires API key from Trafiklab
  staticUrl: process.env.GTFS_STATIC_URL || "",

  // GTFS Realtime endpoints - requires API key from Trafiklab
  realtimeUrls: {
    tripUpdates: process.env.GTFS_REALTIME_TRIP_UPDATES_URL || "",
    vehiclePositions: process.env.GTFS_REALTIME_VEHICLE_POSITIONS_URL || "",
    serviceAlerts: process.env.GTFS_REALTIME_ALERTS_URL || "",
  },

  // API keys (get from Trafiklab)
  staticApiKey: process.env.GTFS_STATIC_KEY || "",
  realtimeApiKey: process.env.GTFS_REALTIME_KEY || "",

  // Update intervals
  staticUpdateInterval: 7 * 24 * 60 * 60 * 1000, // 7 days
  realtimeVehicleUpdateInterval:
    Number(process.env.GTFS_VEHICLE_UPDATE_INTERVAL) || 10 * 1000, // 10 seconds (default)
  realtimeTripUpdateInterval:
    Number(process.env.GTFS_TRIP_UPDATE_INTERVAL) || 30 * 1000, // 30 seconds (default)

  // Data directory for downloaded files
  dataDir: process.env.GTFS_DATA_DIR || "./data/gtfs",
} as const;

// File names in GTFS zip
export const GTFS_FILES = [
  "agency.txt",
  "stops.txt",
  "routes.txt",
  "trips.txt",
  "stop_times.txt",
  "calendar.txt",
  "calendar_dates.txt",
  "shapes.txt",
  "transfers.txt",
  "feed_info.txt",
  "areas.txt",
  "stop_areas.txt",
] as const;

export type GtfsFileName = (typeof GTFS_FILES)[number];
