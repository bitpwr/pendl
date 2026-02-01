-- Enable PostGIS extension
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
    stop_name TEXT NOT NULL,
    stop_lat DOUBLE PRECISION NOT NULL,
    stop_lon DOUBLE PRECISION NOT NULL,
    location_type INTEGER DEFAULT 0,
    parent_station TEXT,
    platform_code TEXT,
    search_vector TSVECTOR,
    geom GEOMETRY(Point, 4326) GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint(stop_lon, stop_lat), 4326)
    ) STORED
);

CREATE INDEX idx_stops_geom ON stops USING GIST(geom);
CREATE INDEX idx_stops_name ON stops USING GIN(to_tsvector('simple', stop_name));
CREATE INDEX idx_stops_search ON stops USING GIN(search_vector);
CREATE INDEX idx_stops_parent ON stops(parent_station);

-- Routes
CREATE TABLE routes (
    route_id TEXT PRIMARY KEY,
    agency_id TEXT REFERENCES agencies(agency_id) ON DELETE CASCADE,
    route_short_name TEXT,
    route_long_name TEXT,
    route_desc TEXT,
    route_type INTEGER NOT NULL
);

CREATE INDEX idx_routes_agency ON routes(agency_id);

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

CREATE INDEX idx_calendar_dates ON calendar(start_date, end_date);

-- Calendar exceptions
CREATE TABLE calendar_dates (
    service_id TEXT NOT NULL,
    date DATE NOT NULL,
    exception_type INTEGER NOT NULL,
    PRIMARY KEY (service_id, date)
);

CREATE INDEX idx_calendar_dates_date ON calendar_dates(date);

-- Trips
CREATE TABLE trips (
    trip_id TEXT PRIMARY KEY,
    route_id TEXT REFERENCES routes(route_id) ON DELETE CASCADE NOT NULL,
    service_id TEXT NOT NULL,
    trip_headsign TEXT,
    trip_short_name TEXT,
    direction_id INTEGER,
    block_id TEXT,
    shape_id TEXT,
    wheelchair_accessible INTEGER,
    bikes_allowed INTEGER
);

CREATE INDEX idx_trips_route ON trips(route_id);
CREATE INDEX idx_trips_service ON trips(service_id);
CREATE INDEX idx_trips_shape ON trips(shape_id);

-- Stop times (largest table - optimize carefully)
CREATE TABLE stop_times (
    trip_id TEXT REFERENCES trips(trip_id) ON DELETE CASCADE NOT NULL,
    arrival_time INTERVAL NOT NULL,
    departure_time INTERVAL NOT NULL,
    stop_id TEXT REFERENCES stops(stop_id) ON DELETE CASCADE NOT NULL,
    stop_sequence INTEGER NOT NULL,
    stop_headsign TEXT,
    pickup_type INTEGER DEFAULT 0,
    drop_off_type INTEGER DEFAULT 0,
    timepoint INTEGER DEFAULT 1,
    PRIMARY KEY (trip_id, stop_sequence)
);

-- Critical indexes for departure queries
CREATE INDEX idx_stop_times_stop ON stop_times(stop_id);
CREATE INDEX idx_stop_times_stop_departure ON stop_times(stop_id, departure_time);
CREATE INDEX idx_stop_times_trip ON stop_times(trip_id);

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
CREATE UNIQUE INDEX idx_shape_lines_id ON shape_lines(shape_id);

-- View for routes serving each stop (useful for search results)
CREATE VIEW stop_routes AS
SELECT DISTINCT
    st.stop_id,
    r.route_id,
    r.route_short_name,
    r.route_long_name,
    r.route_type
FROM stop_times st
JOIN trips t ON st.trip_id = t.trip_id
JOIN routes r ON t.route_id = r.route_id;

-- Materialized view for route types per stop (for quick lookups)
CREATE MATERIALIZED VIEW stop_route_types AS
SELECT
    s.stop_id,
    COALESCE(
        ARRAY_AGG(DISTINCT r.route_type ORDER BY r.route_type) FILTER (WHERE r.route_type IS NOT NULL),
        ARRAY[]::integer[]
    ) AS route_types
FROM stops s
LEFT JOIN stop_times st ON st.stop_id = s.stop_id
LEFT JOIN trips t ON t.trip_id = st.trip_id
LEFT JOIN routes r ON r.route_id = t.route_id
WHERE s.location_type = 1
GROUP BY s.stop_id;

CREATE UNIQUE INDEX idx_stop_route_types_id ON stop_route_types(stop_id);

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_gtfs_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY shape_lines;
    REFRESH MATERIALIZED VIEW CONCURRENTLY stop_route_types;
END;
$$ LANGUAGE plpgsql;
