CREATE TABLE flight_tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  icao24 TEXT NOT NULL,
  callsign TEXT,
  origin_country TEXT,
  location GEOGRAPHY(POINT, 4326),
  altitude_m INTEGER,
  velocity_ms NUMERIC(6,2),
  heading NUMERIC(5,1),
  squawk TEXT,
  is_military BOOLEAN DEFAULT false,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_flight_location ON flight_tracks USING GIST(location);
