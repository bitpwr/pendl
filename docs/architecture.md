# Pendl - Transit Timetable & Vehicle Tracking Application

## Overview

Pendl is a real-time transit information application that displays departure times and vehicle positions for local commuters. It combines static GTFS schedule data with GTFS-realtime updates to provide accurate, up-to-the-second transit information.

---

## Configuration

### Target Agency

- **Primary Agency**: SL (Storstockholms Lokaltrafik)
- **Region**: Stockholm, Sweden

### Agency Filter

```typescript
// src/lib/config/agencies.ts

// List of agency IDs to include in data import
// Add more agency IDs as needed
export const INCLUDED_AGENCY_IDS = [
  "505000000000000001",
  // Add more agency IDs here
] as const;

export type AgencyId = (typeof INCLUDED_AGENCY_IDS)[number];
```

### Localization

- **UI Language**: Swedish (Svenska)
- **Code Language**: English
- **Time Format**: 24-hour only (HH:mm)
- **Timezone**: Europe/Stockholm

### User Features

- **Authentication**: None (public app)
- **Favorites**: Stored in browser localStorage

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                                │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     Next.js Frontend (App Router)                    │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐ │    │
│  │  │ Stop Search  │  │  Departures  │  │    Map (Vehicle Positions) │ │    │
│  │  │  Component   │  │    Board     │  │         Leaflet/OSM        │ │    │
│  │  └──────────────┘  └──────────────┘  └────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Next.js API Routes                                 │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────────┐ │
│  │ /api/areas     │  │ /api/departures│  │ /api/vehicles                  │ │
│  │ (search/nearby)│  │ (realtime)     │  │ (positions for trips at stop)  │ │
│  └────────────────┘  └────────────────┘  └────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
┌──────────────────────────────┐      ┌──────────────────────────────────────┐
│        PostgreSQL/PostGIS    │      │              Redis                    │
│  ┌────────────────────────┐  │      │  ┌────────────────────────────────┐  │
│  │ Static GTFS Data       │  │      │  │ Realtime Data                  │  │
│  │ • stops (with geom)    │  │      │  │ • trip_updates:{trip_id}       │  │
│  │ • routes               │  │      │  │ • vehicle_positions:{trip_id}  │  │
│  │ • trips                │  │      │  │ • stop_departures:{stop_id}    │  │
│  │ • stop_times           │  │      │  │ • alerts:{route_id}            │  │
│  │ • calendar/dates       │  │      │  └────────────────────────────────┘  │
│  │ • shapes (with geom)   │  │      └──────────────────────────────────────┘
│  └────────────────────────┘  │                        ▲
└──────────────────────────────┘                        │
              ▲                                         │
              │                                         │
┌─────────────┴────────────────┐      ┌────────────────┴─────────────────────┐
│     GTFS Static Worker       │      │       GTFS Realtime Worker           │
│  (Runs weekly via cron)      │      │    (Runs every 10 seconds)           │
│  • Downloads GTFS .zip       │      │  • Fetches TripUpdates               │
│  • Parses CSV files          │      │  • Fetches VehiclePositions          │
│  • Filters by agency_id      │      │  • Fetches ServiceAlerts             │
│  • Upserts to PostgreSQL     │      │  • Processes & stores in Redis       │
└──────────────────────────────┘      └──────────────────────────────────────┘
```

---

## Technology Stack

### Backend

- **Runtime**: Node.js 22+ with TypeScript
- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL 16 with PostGIS extension
- **Cache**: Redis 7+
- **GTFS Parsing**: `protobufjs` for GTFS-realtime protobuf + custom CSV parser for static
- **Scheduler**: Node-cron or BullMQ for worker scheduling

### Frontend

- **Framework**: Next.js 16 with React 19
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui
- **Maps**: Leaflet with react-leaflet wrapper (OpenStreetMap tiles)
- **State Management**: React hooks + API polling
- **Real-time Updates**: Polling
- **Favorites Storage**: localStorage (no backend required)

### Infrastructure

- **Containerization**: Docker & Docker Compose
- **Deployment**: Self-hosted Docker on private server
- **Process Management**: Docker services

---

## Data Model

### PostgreSQL Schema (Static GTFS)

```sql
-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Agencies (filtered to specific agency_id)
CREATE TABLE agencies (
    agency_id TEXT PRIMARY KEY,
    agency_name TEXT NOT NULL,
    agency_url TEXT,
    agency_timezone TEXT NOT NULL,
    agency_lang TEXT,
    agency_phone TEXT
);

-- Stops with geographic location
CREATE TABLE stops (
    stop_id TEXT PRIMARY KEY,
    stop_code TEXT,
    stop_name TEXT NOT NULL,
    stop_desc TEXT,
    stop_lat DOUBLE PRECISION NOT NULL,
    stop_lon DOUBLE PRECISION NOT NULL,
    location_type INTEGER DEFAULT 0,
    parent_station TEXT,
    platform_code TEXT,
    geom GEOMETRY(Point, 4326) GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint(stop_lon, stop_lat), 4326)
    ) STORED
);

CREATE INDEX idx_stops_geom ON stops USING GIST(geom);
CREATE INDEX idx_stops_name ON stops USING GIN(to_tsvector('simple', stop_name));

-- Routes
CREATE TABLE routes (
    route_id TEXT PRIMARY KEY,
    agency_id TEXT REFERENCES agencies(agency_id),
    route_short_name TEXT,
    route_long_name TEXT,
    route_type INTEGER NOT NULL
);

-- Calendar (service patterns)
CREATE TABLE calendar (
    service_id TEXT PRIMARY KEY,
    monday BOOLEAN NOT NULL,
    tuesday BOOLEAN NOT NULL,
    wednesday BOOLEAN NOT NULL,
    thursday BOOLEAN NOT NULL,
    friday BOOLEAN NOT NULL,
    saturday BOOLEAN NOT NULL,
    sunday BOOLEAN NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL
);

-- Calendar exceptions
CREATE TABLE calendar_dates (
    service_id TEXT REFERENCES calendar(service_id),
    date DATE NOT NULL,
    exception_type INTEGER NOT NULL,
    PRIMARY KEY (service_id, date)
);

-- Trips
CREATE TABLE trips (
    trip_id TEXT PRIMARY KEY,
    route_id TEXT REFERENCES routes(route_id) NOT NULL,
    service_id TEXT NOT NULL,
    direction_id INTEGER,
    shape_id TEXT
);

CREATE INDEX idx_trips_route ON trips(route_id);
CREATE INDEX idx_trips_service ON trips(service_id);

-- Stop times (largest table - optimize carefully)
CREATE TABLE stop_times (
    trip_id TEXT REFERENCES trips(trip_id) NOT NULL,
    arrival_time INTERVAL NOT NULL,
    departure_time INTERVAL NOT NULL,
    stop_id TEXT REFERENCES stops(stop_id) NOT NULL,
    stop_sequence INTEGER NOT NULL,
    stop_headsign TEXT,
    pickup_type INTEGER DEFAULT 0,
    drop_off_type INTEGER DEFAULT 0,
    timepoint INTEGER DEFAULT 1,
    PRIMARY KEY (trip_id, stop_sequence)
);

-- Critical indexes for departure queries
CREATE INDEX idx_stop_times_stop ON stop_times(stop_id);
CREATE INDEX idx_stop_times_departure ON stop_times(stop_id, departure_time);

-- Shapes (route geometry)
CREATE TABLE shapes (
    shape_id TEXT NOT NULL,
    shape_pt_lat DOUBLE PRECISION NOT NULL,
    shape_pt_lon DOUBLE PRECISION NOT NULL,
    shape_pt_sequence INTEGER NOT NULL,
    shape_dist_traveled DOUBLE PRECISION,
    PRIMARY KEY (shape_id, shape_pt_sequence)
);

-- Materialized view for shape lines (for map display)
CREATE MATERIALIZED VIEW shape_lines AS
SELECT
    shape_id,
    ST_MakeLine(
        ST_SetSRID(ST_MakePoint(shape_pt_lon, shape_pt_lat), 4326)
        ORDER BY shape_pt_sequence
    ) AS geom
FROM shapes
GROUP BY shape_id;

CREATE INDEX idx_shape_lines_geom ON shape_lines USING GIST(geom);
```

### Redis Data Structures

Redis is used for fast access to real-time data. Data expires automatically to prevent stale information.

```typescript
// Key patterns and data structures

// 1. Trip Updates - delays and schedule changes per trip
// Key: trip_update:{trip_id}
// TTL: 120 seconds (2 minutes)
interface TripUpdate {
  tripId: string;
  routeId: string;
  vehicleId?: string;
  timestamp: number;
  stopTimeUpdates: Array<{
    stopId: string;
    stopSequence: number;
    arrival?: {
      delay: number; // seconds
      time?: number; // unix timestamp
    };
    departure?: {
      delay: number;
      time?: number;
    };
    scheduleRelationship: "SCHEDULED" | "SKIPPED" | "NO_DATA";
  }>;
}

// 2. Vehicle Positions - current location of vehicles
// Key: vehicle:{vehicle_id}
// TTL: 60 seconds
interface VehiclePosition {
  vehicleId: string;
  tripId: string;
  routeId: string;
  latitude: number;
  longitude: number;
  bearing?: number;
  speed?: number;
  currentStopSequence?: number;
  currentStatus: "INCOMING_AT" | "STOPPED_AT" | "IN_TRANSIT_TO";
  timestamp: number;
}

// 3. Stop Departures Index - quick lookup of trips at a stop
// Key: stop_trips:{stop_id}
// TTL: 120 seconds
// Value: SET of trip_ids currently relevant for this stop
// This allows O(1) lookup of which trips to fetch updates for

// 4. Vehicles by Trip Index - for map display
// Key: trip_vehicles:{trip_id}
// TTL: 60 seconds
// Value: vehicle_id

// 5. Service Alerts
// Key: alert:{alert_id}
// TTL: matches alert active_period or 1 hour default
interface ServiceAlert {
  alertId: string;
  headerText: string;
  descriptionText: string;
  cause: string;
  effect: string;
  activePeriods: Array<{ start: number; end?: number }>;
  informedEntities: Array<{
    agencyId?: string;
    routeId?: string;
    stopId?: string;
    tripId?: string;
  }>;
}

// 6. Route Alerts Index
// Key: route_alerts:{route_id}
// Value: SET of alert_ids affecting this route
```

---

## Combining Static and Realtime Data

The key insight is that **static data provides the schedule, realtime data provides the adjustments**.

### Departure Board Query Flow

```
1. User requests departures for stop_id = "CENTRAL_STATION"

2. Query PostgreSQL for scheduled departures (next 2 hours):

   SELECT
     st.trip_id,
     st.departure_time,
     st.stop_sequence,
    COALESCE(st.stop_headsign, r.route_long_name) AS display_headsign,
     r.route_id,
     r.route_short_name,
     r.route_type
   FROM stop_times st
   JOIN trips t ON st.trip_id = t.trip_id
   JOIN routes r ON t.route_id = r.route_id
   WHERE st.stop_id = 'CENTRAL_STATION'
     AND t.service_id IN (active_service_ids_for_today)
     AND st.departure_time BETWEEN current_time AND current_time + '2 hours'
   ORDER BY st.departure_time
   LIMIT 50;

3. For each trip_id, check Redis for realtime updates:

   MGET trip_update:trip_1 trip_update:trip_2 trip_update:trip_3 ...

4. Merge the data:

   scheduledDeparture + delaySeconds = predictedDeparture
  routeColor = routeTypeColor(routeType)

   For each departure:
   - If realtime exists: use predicted time, mark as "realtime"
   - If no realtime: use scheduled time, mark as "scheduled"
   - If trip cancelled: mark as "cancelled"

5. Return combined response to frontend
```

### Service Day Calculation

GTFS times can exceed 24:00:00 for trips that run past midnight. The backend must handle this:

```typescript
function getActiveServiceIds(
  date: Date,
  calendar: Calendar[],
  calendarDates: CalendarDate[],
): string[] {
  const dayOfWeek = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ][date.getDay()];

  // Get regular services running on this day of week
  const regularServices = calendar.filter(
    (c) => c[dayOfWeek] && date >= c.start_date && date <= c.end_date,
  );

  // Add exceptions (exception_type = 1)
  const addedServices = calendarDates.filter(
    (cd) => cd.date === date && cd.exception_type === 1,
  );

  // Remove exceptions (exception_type = 2)
  const removedServices = calendarDates.filter(
    (cd) => cd.date === date && cd.exception_type === 2,
  );

  return [
    ...new Set([
      ...regularServices.map((s) => s.service_id),
      ...addedServices.map((s) => s.service_id),
    ]),
  ].filter((id) => !removedServices.some((r) => r.service_id === id));
}

function parseGtfsTime(timeStr: string): {
  hours: number;
  minutes: number;
  seconds: number;
  nextDay: boolean;
} {
  const [h, m, s] = timeStr.split(":").map(Number);
  return {
    hours: h % 24,
    minutes: m,
    seconds: s,
    nextDay: h >= 24,
  };
}
```

---

## Worker Implementations

### GTFS Static Worker

Runs weekly (e.g., Sunday 3:00 AM) to fetch and update static schedule data.

```typescript
// scripts/import-gtfs.ts

interface GTFSStaticWorkerConfig {
  gtfsUrl: string; // URL to download GTFS .zip
  agencyId: string; // Filter to this agency only
  downloadDir: string; // Temp directory for processing
  pgConnectionString: string;
}

async function runStaticWorker(config: GTFSStaticWorkerConfig): Promise<void> {
  console.log(`[${new Date().toISOString()}] Starting GTFS static import...`);

  // 1. Download GTFS zip
  const zipPath = await downloadGtfsZip(config.gtfsUrl, config.downloadDir);

  // 2. Extract to temp directory
  const extractPath = await extractZip(zipPath);

  // 3. Parse CSV files
  const gtfsData = await parseGtfsFiles(extractPath, config.agencyId);

  // 4. Validate data integrity
  validateGtfsData(gtfsData);

  // 5. Begin database transaction
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 6. Truncate existing tables (or use temp tables + swap)
    await client.query(
      "TRUNCATE agencies, routes, stops, calendar, calendar_dates, trips, stop_times, shapes CASCADE",
    );

    // 7. Bulk insert using COPY for performance
    await copyAgencies(client, gtfsData.agencies);
    await copyRoutes(client, gtfsData.routes);
    await copyStops(client, gtfsData.stops);
    await copyCalendar(client, gtfsData.calendar);
    await copyCalendarDates(client, gtfsData.calendarDates);
    await copyTrips(client, gtfsData.trips);
    await copyStopTimes(client, gtfsData.stopTimes); // Largest - use streaming
    await copyShapes(client, gtfsData.shapes);

    // 8. Refresh materialized views
    await client.query("REFRESH MATERIALIZED VIEW shape_lines");

    // 9. Update statistics
    await client.query("ANALYZE");

    await client.query("COMMIT");
    console.log(`[${new Date().toISOString()}] GTFS static import complete`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    // Cleanup temp files
    await fs.rm(config.downloadDir, { recursive: true, force: true });
  }
}
```

## API Design

### API Routes

```
/api/areas
  GET /api/areas/search?q=central     - Text search for station areas
  GET /api/areas/nearby?lat=&lon=&r=  - Geo search for nearby areas
  GET /api/areas/[areaId]             - Area details and grouped departures

/api/departures
  GET /api/departures/[stopId]        - Get realtime departures
    Query params:
      - limit: number (default 20, max 50)
      - timespan: number (minutes, default 120)

/api/vehicles
  GET /api/vehicles                    - Get active vehicle positions

/api/trips
  GET /api/trips/[tripId]             - Get trip details with all stops and shape
```

### Response Types

```typescript
// /types/api.ts

interface DepartureResponse {
  stopId: string;
  stopName: string;
  departures: Departure[];
  generatedAt: string;
}

interface Departure {
  tripId: string;
  routeId: string;
  routeName: string;
  routeType: RouteType;
  headsign: string;
  scheduledDeparture: string; // ISO datetime
  realtimeDeparture?: string; // ISO datetime (if realtime available)
  delaySeconds?: number;
  isCancelled?: boolean;
  platform?: string;
  vehicleId?: string;
  alerts?: AlertSummary[];
}

interface VehicleResponse {
  vehicles: Vehicle[];
  generatedAt: string;
}

interface Vehicle {
  vehicleId: string;
  tripId: string;
  routeId: string;
  routeName: string;
  routeType: RouteType;
  headsign: string;
  latitude: number;
  longitude: number;
  bearing?: number;
  speed?: number;
  currentStatus: string;
  nextStop?: {
    stopId: string;
    stopName: string;
    arrivalTime?: string;
  };
  occupancyStatus?: string;
}

interface StopSearchResult {
  stopId: string;
  stopName: string;
  stopCode?: string;
  latitude: number;
  longitude: number;
  platformCode?: string;
  distance?: number; // For nearby search
  routes?: RouteSummary[]; // Routes serving this stop
}
```

---

## Project Structure

```
pendl/
├── .env.development              # Development environment variables
├── .env.example                  # Example env file
├── docker-compose.dev.yml        # Local PostgreSQL + Redis
├── docker-compose.prod.yml       # Production stack
├── package.json
├── tsconfig.json
├── postcss.config.mjs
├── next.config.ts
├── components.json               # shadcn/ui config
│
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            # Root layout
│   │   ├── page.tsx              # Home page
│   │   ├── area/[areaId]/page.tsx
│   │   ├── favorites/page.tsx
│   │   ├── map/page.tsx
│   │   ├── trip/
│   │   │   └── [tripId]/
│   │   │       └── page.tsx      # Trip details page
│   │   └── api/
│   │       ├── stops/
│   │       │   ├── search/route.ts
│   │       │   ├── nearby/route.ts
│   │       │   └── batch/route.ts
│   │       ├── areas/
│   │       │   ├── search/route.ts
│   │       │   ├── nearby/route.ts
│   │       │   └── [areaId]/route.ts
│   │       ├── departures/
│   │       │   └── [stopId]/route.ts
│   │       ├── vehicles/route.ts
│   │       ├── trips/
│   │       │   └── [tripId]/
│   │       │       └── route.ts
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   └── header.tsx
│   │   ├── search/
│   │   │   ├── stop-search.tsx
│   │   │   ├── search-results.tsx
│   │   │   └── area-search-results.tsx
│   │   ├── favorites/
│   │   │   └── favorites-list.tsx
│   │   ├── departures/
│   │   │   ├── departure-board.tsx
│   │   │   ├── departure-row.tsx
│   │   │   ├── departure-time.tsx
│   │   │   ├── route-badge.tsx
│   │   │   └── area-departure-board.tsx
│   │   ├── map/
│   │   │   ├── vehicle-map.tsx
│   │   │   └── vehicle-arrow-icon.ts
│   │   ├── trip/
│   │   │   ├── trip-map.tsx
│   │   │   └── trip-stop-list.tsx
│   │   └── ui/
│   │       └── ...
│   │
│   ├── lib/
│   │   ├── config/
│   │   │   └── agencies.ts       # INCLUDED_AGENCY_IDS constant
│   │   ├── db/
│   │   │   ├── index.ts          # Database client (pg Pool)
│   │   │   ├── queries/
│   │   │   │   └── ...
│   │   ├── redis/
│   │   │   ├── index.ts          # Redis client
│   │   │   ├── realtime.ts       # Realtime data access
│   │   ├── gtfs/
│   │   │   ├── service-day.ts    # Service day calculations
│   │   │   ├── time-utils.ts     # GTFS time parsing
│   │   │   ├── importer.ts
│   │   │   └── realtime-proto.ts
│   │   └── utils.ts
│   │
│   ├── hooks/
│   │   └── use-favorites.ts      # localStorage favorites management
│   │
│   └── types/
│       ├── gtfs.ts               # GTFS types
│       ├── api.ts                # API response types
│       └── realtime.ts           # Realtime data types
│
├── scripts/
│   ├── init-db.sql
│   ├── import-gtfs.ts
│   ├── import-gtfs-streaming.ts
│
└── public/
    └── ...
```

---

## Frontend Architecture

### Favorites with localStorage

```typescript
// src/hooks/use-favorites.ts

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "pendl-favorites";

interface FavoriteStop {
  stopId: string;
  stopName: string;
  addedAt: number;
}

function getSnapshot(): FavoriteStop[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener("favorites-changed", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("favorites-changed", callback);
  };
}

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, getSnapshot, () => []);

  const addFavorite = useCallback((stopId: string, stopName: string) => {
    const current = getSnapshot();
    if (current.some((f) => f.stopId === stopId)) return;

    const updated = [...current, { stopId, stopName, addedAt: Date.now() }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("favorites-changed"));
  }, []);

  const removeFavorite = useCallback((stopId: string) => {
    const current = getSnapshot();
    const updated = current.filter((f) => f.stopId !== stopId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("favorites-changed"));
  }, []);

  const isFavorite = useCallback(
    (stopId: string) => {
      return favorites.some((f) => f.stopId === stopId);
    },
    [favorites],
  );

  return { favorites, addFavorite, removeFavorite, isFavorite };
}
```

### State Management Strategy

```typescript
// Polling strategy using React hooks
function useDepartures(stopId: string) {
  const [data, setData] = useState<DepartureResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch(`/api/departures/${stopId}`);
      if (!cancelled) setData(await res.json());
    }

    load();
    const timer = setInterval(load, 10_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [stopId]);

  return data;
}
```

---

## Performance Considerations

### Database Optimization

1. **Indexes**: Critical for stop_times queries which are the hottest path
2. **Partitioning**: Consider partitioning stop_times by route_id for very large datasets
3. **Connection pooling**: Use pg-pool with 10-20 connections
4. **Query caching**: Use Redis for frequently accessed stop/route metadata

### Redis Optimization

1. **Pipeline commands**: Batch Redis operations
2. **Appropriate TTLs**: Expire data before it becomes stale
3. **Key design**: Use consistent prefixes for easy debugging and cleanup
4. **Memory limits**: Set maxmemory policy to `allkeys-lru`

### Frontend Optimization

1. **Virtual scrolling**: For long departure lists
2. **Optimistic updates**: Show loading states immediately
3. **Request deduplication**: React Query handles this automatically
4. **Map clustering**: For many vehicle markers
5. **Route geometry caching**: Cache GeoJSON in service worker

---

## Environment Variables

```bash
# .env.development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/pendl?schema=public

# Redis
REDIS_URL=redis://localhost:6379

# GTFS Configuration (SL - Storstockholms Lokaltrafik)
# Get your API key from Trafiklab.se
GTFS_STATIC_URL=https://opendata.samtrafiken.se/gtfs/sl/sl.zip
GTFS_REALTIME_TRIP_UPDATES_URL=https://opendata.samtrafiken.se/gtfs-rt/sl/TripUpdates.pb
GTFS_REALTIME_VEHICLE_POSITIONS_URL=https://opendata.samtrafiken.se/gtfs-rt/sl/VehiclePositions.pb
GTFS_REALTIME_ALERTS_URL=https://opendata.samtrafiken.se/gtfs-rt/sl/ServiceAlerts.pb
GTFS_REALTIME_KEY=your_trafiklab_realtime_key
GTFS_STATIC_KEY=your_trafiklab_static_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Map (Leaflet uses OpenStreetMap - no API key required)
# Optional: Custom tile server URL
# NEXT_PUBLIC_TILE_SERVER_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

---

## Docker Compose Setup (Self-Hosted)

```yaml
# docker-compose.prod.yml (excerpt)

services:
  pendl:
    image: bitpwr/pendl:latest
    ports:
      - "${APP_PORT:-3000}:3000"
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgis/postgis:16-3.4
    volumes:
      - pendl_db:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - pendl_redis:/data

  gtfs-import:
    image: bitpwr/pendl:latest
    command: ["tsx", "scripts/import-gtfs-streaming.ts"]
    profiles:
      - import

volumes:
  pendl_db:
  pendl_redis:
```

---

## Current Priorities

1. Keep API documentation in sync with implemented routes under `src/app/api`
2. Improve test coverage for API routes and GTFS utility functions
3. Harden realtime fallback logic when Redis data is missing
4. Continue performance tuning for stop departure queries and map rendering
