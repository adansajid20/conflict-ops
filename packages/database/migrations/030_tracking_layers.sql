-- Migration 030: Tracking layer tables (AIS vessels, ADS-B flights, FIRMS thermal)

CREATE TABLE IF NOT EXISTS maritime_tracks (
  mmsi             BIGINT PRIMARY KEY,
  source_id        TEXT NOT NULL,
  ship_name        TEXT,
  ship_type        INTEGER,
  latitude         DOUBLE PRECISION,
  longitude        DOUBLE PRECISION,
  speed            DOUBLE PRECISION,
  course           DOUBLE PRECISION,
  heading          DOUBLE PRECISION,
  nav_status       INTEGER,
  flag             TEXT,
  imo              BIGINT,
  callsign         TEXT,
  zone_name        TEXT,
  location         GEOGRAPHY(POINT, 4326),
  last_seen        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS maritime_tracks_last_seen_idx ON maritime_tracks(last_seen DESC);
CREATE INDEX IF NOT EXISTS maritime_tracks_location_idx ON maritime_tracks USING GIST(location);
CREATE INDEX IF NOT EXISTS maritime_tracks_ship_type_idx ON maritime_tracks(ship_type);

CREATE TABLE IF NOT EXISTS flight_tracks (
  icao24           TEXT PRIMARY KEY,
  callsign         TEXT,
  origin_country   TEXT,
  latitude         DOUBLE PRECISION,
  longitude        DOUBLE PRECISION,
  altitude         DOUBLE PRECISION,
  velocity         DOUBLE PRECISION,
  heading          DOUBLE PRECISION,
  squawk           TEXT,
  is_military      BOOLEAN DEFAULT FALSE,
  is_isr           BOOLEAN DEFAULT FALSE,
  location         GEOGRAPHY(POINT, 4326),
  last_seen        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS flight_tracks_last_seen_idx ON flight_tracks(last_seen DESC);
CREATE INDEX IF NOT EXISTS flight_tracks_location_idx ON flight_tracks USING GIST(location);
CREATE INDEX IF NOT EXISTS flight_tracks_military_idx ON flight_tracks(is_military) WHERE is_military = TRUE;
CREATE INDEX IF NOT EXISTS flight_tracks_squawk_idx ON flight_tracks(squawk) WHERE squawk IN ('7700','7600','7500');
