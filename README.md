# Pendl

## Pages

- / - Home with search and favorites
- /favoriter - Favorites list
- /area/[areaId] - Departure board
- /map - Vehicle map

## Scripts

- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run test:run` - Run tests
- `npm run gtfs:import` - Import GTFS static data
- `npx tsx --env-file=.env scripts/import-gtfs.ts`
- `npm run gtfs:realtime` - Start realtime worker
- `npx tsx --env-file=.env scripts/realtime-worker.ts`

To get started with real data:

- Get API keys from Trafiklab
- Set environment variables for GTFS URLs
- Run `docker compose up -d` to start database
- Run `npm run gtfs:import` to import data
- Run `npm run gtfs:realtime` in background
- Run `npm run dev` to start the app
