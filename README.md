# Pendl

Pendl is a transit timetable web app that uses GTFS static and realtime data. It provides departure information, stop search, and realtime updates.

## Local setup

1. Create `.env.development` from `.env.example` and fill in values.
2. Start services:

   ```sh
   ./scripts/dc-dev.sh up
   ```

3. Import static GTFS:

   ```sh
   npm run gtfs:import
   ```

4. Start app:

   ```sh
   npm run dev
   ```

Realtime polling runs inside the backend automatically when realtime API routes are requested.

## Quality checks

Before committing:

```sh
npm run lint
npm test
npm run format
```

## Production

Get these files and rename them

- `docker-compose.prod.yml` -> `docker-compose.yml`
- `init-db.sql` -> move to `scripts/init-db.sql`
- `.env.examples` -> `.env` and adjust values

Either export the port from the pendl-app service or add a docker network to you forwarding proxy.

Create folder `gtfsdata` and make it writeable by all (or use a docker volume)

Run

```sh
docker compose up -d
```

Import static data once and call from a cronjob once a week.

```sh
docker compose run --rm gtfs-import
```
