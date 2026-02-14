## [0.3.0] - 2026-02-14

### ✨ Features

- add night throttling of realtime data (`||8236184`)
- indicate if realtime data is not available (`||073a298`)

### 📦 Build System

- exclude scrips in dockerignore (`||15e03b2`)
- add scripts to build docker and run services (`||86c4359`)
- verify docker builds when making a release (`||a1d4eb4`)
- update copilot-instructions (`||8b64fa9`)

### 📝 Other Changes

- doc: update README and architecture (`||8c2e692`)

## [0.2.0] - 2026-02-14

### ✨ Features

- enable show and fly to users position (`||b943074`)
- show destination on trip page (`||dbc5ea8`)
- trip map shows icon and less padding (`||dbea6d4`)
- main map shows icons and can select different type (`||29e5938`)

### 🐛 Bug Fixes

- handle departures after 24:00 (`||b5e0d85`)
- show max 6 departures per stop (`||0f68f95`)
- correct lint errors (`||8824d1b`)
- hide "show on map" for now (`||d812898`)
- current stop and times corrected for trip page (`||394e973`)

### 🧹 Maintenance

- remove next.js icons (`||eb09e91`)

### 📝 Other Changes

- doc: chores called maintenance in changelog (`||6485ca3`)

## [0.1.2] - 2026-02-13

### 🐛 Bug Fixes

- remove unused fields in database (`||f2ff1a6`)
- add memory efficient import script (`||08e630b`)
- adjust docker compose for production (`||e0ec9d5`)

### 🔧 CI/CD

- changelog groups commits by type (`||1aef464`)

## [0.1.1] - 2026-02-11

- ci: add job to push docker and make GitHub release (46aa4e7)
- ci: add release scripts (0dbe671)
- ci: add docker compose for production (ad6d1c1)
- build: add Dockerfile to build pendl (bc94a0c)
- fix: show total counts at gtfs import (8d0e3b9)
- ci: add build and test job (d7a61b7)
- fix: correct lint errors (22e9dc9)
- fix: use router.back() instead of window.history (f595f9c)
- feat: search query persistence using URL query parameters (c5a0185)
- fix: show RouteBadge on search results (af0021b)
- fix: trip map indicates next stop (1b0b3b4)
- fix: decreased padding for favorites and search results (63cdd5a)
- fix: nicer popup in trip map (6e1df1b)
- fix: back buttons uses history (9c6e00a)
- fix: define route colors in one place (ac14b51)
- feat: added trip page with map (5b2e284)
- fix: improved departure row and fix map path (c960235)
- feat: fix RouteType to show correct types (b1f8bf5)
- feat: use areas for search instead of stops (c92d31e)
- feat: import area and stop_areas into db (637dd32)
- fix: use api for stops and departures (68e4d15)
- fix: realtime key and download intervals (65f2b5c)
- doc: add copilot-instructions and update gitignore (711a1c8)
- fix: remove db fields not in gtfs files (d6f37e1)
- fix: adjust env and fix static download (52f6e62)
- fix: format all with prettier and update README (41f494d)
- feat: add Leaflet map for vehicle positions (3a5a16c)
- feat: add GTFS realtime worker (1af8c00)
- feat: add GTFS static data import worker (d6161a8)
- feat: add API routes for stops and departures (b2fbb27)
- feat: add Redis client for realtime data (8ba24fe)
- feat: add PostgreSQL database client and queries (4d7cbac)
- feat: add basic UI layout and components (57eae2a)
- feat: add Docker Compose and database schema (1f3ff05)
- feat: add project structure, types, and GTFS utilities (5c60ab8)
- feat: add shadcn/ui with essential components (fb421d2)
- feat: initialize Next.js 16 project with TypeScript, Tailwind, and Vitest (d3cfc08)

