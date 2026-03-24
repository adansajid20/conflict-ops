CREATE TABLE maritime_tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mmsi TEXT NOT NULL,
  vessel_name TEXT,
  vessel_type TEXT,
  flag TEXT,
  location GEOGRAPHY(POINT, 4326),
  speed_knots NUMERIC(5,2),
  heading INTEGER,
  destination TEXT,
  chokepoint TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_maritime_location ON maritime_tracks USING GIST(location);
CREATE INDEX idx_maritime_recorded ON maritime_tracks(recorded_at DESC);
