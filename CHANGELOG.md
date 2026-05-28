## [0.11.2] - 2026-05-28

### ✨ Features

- vehicle arrow size depends on zoom level (`e5fe5f2`)

### ⚡ Performance

- pause area updates after 30 minutes (`6301f68`)

### 💎 Styling

- select traffic area instead of agency (`20ee77f`)
- use correct SL colors for vehicle types (`68d024d`)

### 🧹 Maintenance

- make gtfs importing more memory efficient (`1c1444f`)
- delete old static files after import (`344078b`)
- rename properties in vehicle object (`97c7d4f`)

## [0.11.1] - 2026-04-20

### ⚡ Performance

- rename lat and long for vehicle positions (`c045ee0`)
- remove duplicate data in area departures route (`17f62e7`)
- give trip realtime a dedicated route (`e6b2949`)
- give trip shape a dedicated route (`7e31c6a`)

### 💎 Styling

- show delay in area and trip pages in the same way (`8603b37`)

### 🧹 Maintenance

- remove vehicle from TripStopList (`ee2b2fe`)
- add proper open graph metadata (`88db747`)

## [0.11.0] - 2026-04-15

### ✨ Features

- make stops collapsible in area page (`6b31d1c`)
- add selection of routes in area page (`23aa565`)

### 💎 Styling

- make missing realtime less prominent (`96b4832`)

### 🧹 Maintenance

- remove refresh buttons not needed (`7e4eab8`)

## [0.10.0] - 2026-04-13

### ✨ Features

- include stop times in trip map popup (`15bc994`)
- larger touch area for stops on trip map (`4eb0c64`)
- only show available vehicle types for selection on map page (`76dece0`)

### ♻️ Refactoring

- move common time functions to time-utils (`b4a1b77`)
- combine sql queries for all vehicles (`0b259b9`)
- do not import more areas than needed (`1f1f310`)

### 🧹 Maintenance

- include route info for trip vehicles (`4e541a9`)
- after complete import, print total time it took (`3969e3a`)
- reset page telemetry for every agency (`5f64877`)

## [0.9.0] - 2026-04-11

### ✨ Features

- add option to show a map for an area (`89d431f`)
- add a button to clear the search field (`9ed2db9`)

### 💎 Styling

- better alignment in page titles (`29c870e`)
- break words for long stop names (`c410266`)

## [0.8.0] - 2026-04-09

### ✨ Features

- add support for UL agency (`8832276`)
- map flies to selected agency (`307e6e4`)

### 🐛 Bug Fixes

- boat speed is shown in knots (`196998f`)

### ⚡ Performance

- do not add vehicles without trip (`3f31255`)
- improve area search (`6ab27af`)

### 💎 Styling

- improve page titles (`4adafc3`)
- show agency for each favorites (`2b9e1c8`)
- nicer and more efficient vehicle icons (`71ef794`)

### 🧹 Maintenance

- include agency in page load telemetry (`7dce6c6`)
- use different redis ttl for different data (`c586bcc`)
- remove unused getScheduledDepartures() (`6b2d5b1`)
- show more search results (`9026c31`)

## [0.7.4] - 2026-03-19

### 🐛 Bug Fixes

- removed next.js favicon that blocked favicon in public folder (`388a8bd`)

### ♻️ Refactoring

- better use of singletons for redis and postgres (`4b7df68`)
- prepare for several agencies by generating realtime urls (`0154c7c`)

### 💎 Styling

- add a clean footer (`664780b`)

### 🧹 Maintenance

- remove obsolete realtime-worker.ts script (`7806415`)

## [0.7.3] - 2026-03-12

### 🐛 Bug Fixes

- include public folder in production for favicon and manifest (`6f5afaf`)
- ensure reinstall in production if dependencies have changed (`2326420`)
- do not block area page during realtime trip update (`322c521`)

### 💎 Styling

- add link to stop on popup in trip map (`1681dc8`)

## [0.7.2] - 2026-03-11

### 🐛 Bug Fixes

- do not include end stops when showing departures (`a6095bb`)
- show departures for the next 60 minutes (`3159a05`)

### ⚡ Performance

- do not update vehicles on map while interacting (`3010c6a`)
- remove shadow from vehicle markers (`9dff002`)
- use simple marker when many vehicles are shown on map (`34f7feb`)
- only use simple marker on mobile devices (`9c6ee07`)
- preload leaflet in the map for better performance (`813d7a6`)
- use simple marker based on number of vehicles actually shown (`cd1f55b`)

## [0.7.1] - 2026-03-02

### 💎 Styling

- group departures by type on area page (`8b5f61b`)
- show relevant page titles (`d41e1c7`)

### 🧹 Maintenance

- remove influx logging (`3f3a437`)
- page load metrics are reset and more efficient (`5de9d39`)
- rename call-sql.sh script (`c231910`)

## [0.7.0] - 2026-03-01

### ✨ Features

- add support for influx metrics (`5a84d7d`)
- improve departure times in area page (`287e0eb`)
- make the app a PWA and add icons (`fa3e5ea`)

### 📦 Build System

- fix permission problem with postgres-init container (`29c8c97`)

### 🧹 Maintenance

- ensure changelog does not get || by commits (`1fb9307`)

## [0.6.0] - 2026-02-25

### ✨ Features

- log requested areas, trips and map (`dda8507`)
- show transport name in vehicle popup on map (`adb8826`)
- link to areas instead of stops on trip page (`ef83ab7`)

### 📦 Build System

- disable next.js telemetry (`f24f7de`)
- postgres uses init-db.sql from pendl docker image (`7045b57`)

### 💎 Styling

- reduce padding in RouteBadge and header (`2ea17bd`)
- improve readability and visual hierarchy (`a4e3bef`)
- add support for dark mode (`8d349fa`)

### 🧹 Maintenance

- adjust remaining time presentation when less than 2 minutes (`8f7f28b`)
- remove all stop related pages and apis (`ff4bfa1`)
- simplify docker compose scripts and add sql helper (`1fabef3`)
- rename favoriter folder to favorites (`8268012`)
- clean up database and improve headsign (`9db4cd2`)

## [0.5.0] - 2026-02-23

### ✨ Features

- add a 404 page (`fd9a752`)
- separate trip and vehicle api for efficiency (`a5be45c`)
- more details in departure time (`ad600fe`)
- show speed in vehicle popup (`a127cd8`)
- include departures 15 minutes after scheduled time to account for delays (`9b8f211`)
- show vehicle type in map header (`c5a1303`)
- index vehicle by trip for more efficient lookup (`7e7937b`)

### 🧹 Maintenance

- fix typescript warning (`1ec2ebb`)
- remove timestamp from logs (`ad5df59`)
- rearrange title on map page and remove refresh button (`904ee38`)
- hide show on map on stop page (`3af3ed3`)
- separate route type colors from text colors (`688de57`)

## [0.4.0] - 2026-02-19

### ✨ Features

- show trip for selected vehicle on map (`7c49c7a`)
- trip and vehicle colors based on route name (`fc0ee8d`)
- only update required realtime data when needed (`b914eed`)
- get realtime from backend instead of service (`429259d`)

### 🧹 Maintenance

- use common route type names in map (`d019691`)
- use separate intervals for all realtime data (`c0f1ed2`)
- remove night throttling realtime download (`bdc34a1`)

## [0.3.0] - 2026-02-14

### ✨ Features

- add night throttling of realtime data (`8236184`)
- indicate if realtime data is not available (`073a298`)

### 📦 Build System

- exclude scrips in dockerignore (`15e03b2`)
- add scripts to build docker and run services (`86c4359`)
- verify docker builds when making a release (`a1d4eb4`)
- update copilot-instructions (`8b64fa9`)

### 📝 Other Changes

- doc: update README and architecture (`8c2e692`)

## [0.2.0] - 2026-02-14

### ✨ Features

- enable show and fly to users position (`b943074`)
- show destination on trip page (`dbc5ea8`)
- trip map shows icon and less padding (`dbea6d4`)
- main map shows icons and can select different type (`29e5938`)

### 🐛 Bug Fixes

- handle departures after 24:00 (`b5e0d85`)
- show max 6 departures per stop (`0f68f95`)
- correct lint errors (`8824d1b`)
- hide "show on map" for now (`d812898`)
- current stop and times corrected for trip page (`394e973`)

### 🧹 Maintenance

- remove next.js icons (`eb09e91`)

### 📝 Other Changes

- doc: chores called maintenance in changelog (`6485ca3`)

## [0.1.2] - 2026-02-13

### 🐛 Bug Fixes

- remove unused fields in database (`f2ff1a6`)
- add memory efficient import script (`08e630b`)
- adjust docker compose for production (`e0ec9d5`)

### 🔧 CI/CD

- changelog groups commits by type (`1aef464`)

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

