# Pendl

Your personal pendl guide

## Pages

- / - Home with search and favorites
- /favoriter - Favorites list
- /area/[areaId] - Departure board
- /map - Vehicle map

## Scripts

- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run test:run` - Run tests
- `npm run gtfs:import` - Import GTFS static data (4GB heap limit)
- `npm run gtfs:import:streaming` - Memory-efficient streaming import (recommended for large datasets)
- `npm run gtfs:realtime` - Start realtime worker

**Note**: If you get "JavaScript heap out of memory" errors during import, use the streaming version or see [docs/GTFS_IMPORT_MEMORY.md](docs/GTFS_IMPORT_MEMORY.md) for solutions.

To get started with real data:

- Get API keys from Trafiklab
- Set environment variables for GTFS URLs
- Run `docker compose up -d` to start database
- Run `npm run gtfs:import` to import data
- Run `npm run gtfs:realtime` in background
- Run `npm run dev` to start the app

## Production

Get these files and rename them

- docker-compose.prod.yml -> docker-compose.yml
- init-db.sql -> move to scri
- .env.production -> .env

Either export the port from the pendl-app service or add a docker network to you forwarding proxy.

Create folder `gtfsdata` and make it writeable by all (or use a docker volume)

Run

```sh
docker compose up -d
```

With a cronjob once a week

```sh
docker compose run --rm gtfs-import
```
