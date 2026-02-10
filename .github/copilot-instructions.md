# Pendl - Stockholm Transit Timetable App

## Project Overview

Pendl is a transit timetable web app for Stockholm (SL) using GTFS static and realtime data. It provides departure information, stop search, and realtime updates.

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **UI**: React 19, Tailwind CSS 4, shadcn/ui components
- **Database**: PostgreSQL 16 with PostGIS extension
- **Caching**: Redis 7 (for realtime data)
- **Testing**: Vitest
- **Code Style**: Prettier (tabWidth: 2, useTabs: false)

## Running the Project

### Prerequisites

```bash
# Start database and Redis
docker compose up -d

# Initialize database schema
psql $DATABASE_URL -f scripts/init-db.sql

# Import GTFS data (place GTFS files in data/gtfs/)
npx tsx --env-file=.env scripts/import-gtfs.ts

# Start development server
npm run dev
```

### Environment Variables

Create `.env` file:

```
DATABASE_URL=postgresql://pendl:pendl@localhost:5432/pendl
REDIS_URL=redis://localhost:6379
SL_REALTIME_API_KEY=your_api_key_here
```

Use `--env-file=.env` flag when running tsx scripts.

## Database Schema

### Important: GTFS Column Mapping

The database schema is aligned with actual SL GTFS data. These are the columns available:

**stops table (7 columns + generated)**:

- stop_id, stop_name, stop_lat, stop_lon, location_type, parent_station, platform_code
- geom (auto-generated PostGIS point)
- search_vector (TSVECTOR for full-text search)

**routes table (6 columns)**:

- route_id, agency_id, route_short_name, route_long_name, route_desc, route_type
- ⚠️ NO route_color, route_text_color, route_sort_order (not in SL data)

**Other tables**: agencies, trips, stop_times, calendar, calendar_dates, shapes

### Route Colors

Since route_color is not available in SL GTFS data, the app uses default colors based on `routeType`:

- Subway: #1F2937 (dark gray)
- Tram: #6B7280 (gray)
- Rail: #7C3AED (purple)
- Bus: #2563EB (blue)
- Ferry: #0891B2 (cyan)
- Taxi: #F59E0B (amber)

Use the `routeTypeColor(routeType: RouteType)` function from `src/types/gtfs.ts` to get consistent colors. It returns `{ bg: string, text: string }` for both background and text colors.

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

Tests are located alongside source files with `.test.ts` or `.test.tsx` extensions.

Current test coverage: 35 tests across utilities, hooks, and API routes.

## GTFS Import Notes

1. **GTFS files location**: `data/gtfs/` directory
2. **Required files**: agency.txt, stops.txt, routes.txt, trips.txt, stop_times.txt, calendar.txt, shapes.txt
3. **Optional files**: calendar_dates.txt

### Import Gotchas

- **Parent station references**: The stops table does NOT have a foreign key constraint on parent_station because GTFS data can have orphaned references
- **Materialized views**: `stop_route_types` and `shape_lines` are refreshed after import (outside transaction)
- **Search vector**: Uses Swedish language (`'swedish'`) for full-text search on stop names

## API Routes

- `GET /api/departures/[stopId]` - Get departures for a stop
- `GET /api/stops/search?q=` - Search stops by name
- `GET /api/stops/nearby?lat=&lon=` - Find nearby stops
- `GET /api/vehicles` - Get realtime vehicle positions

## Key Components

- `StopSearch` - Autocomplete search for stops
- `DepartureBoard` - List of upcoming departures
- `RouteBadge` - Display route number with type-based styling
- `DepartureTime` - Countdown/time display with realtime indicator

## File Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── stop/[stopId]/     # Stop departure page
│   └── page.tsx           # Home page with search
├── components/            # React components
│   ├── departures/        # Departure-related components
│   ├── search/            # Search components
│   └── ui/                # shadcn/ui components
├── lib/
│   ├── db/               # Database connection and queries
│   ├── gtfs/             # GTFS parsing and import
│   └── realtime/         # Realtime data fetching
├── hooks/                 # React hooks
└── types/                 # TypeScript type definitions
```

## Common Issues

1. **Import fails with foreign key error**: The parent_station FK was removed; if you see this, recreate the database
2. **Column does not exist**: Make sure init-db.sql schema matches importer.ts columns
3. **Materialized view error**: Views are refreshed outside transaction; ensure COMMIT happens first
