CREATE TABLE thermal_detections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location GEOGRAPHY(POINT, 4326),
  brightness NUMERIC(7,2),
  frp NUMERIC(7,2),
  confidence TEXT,
  instrument TEXT,
  country_code TEXT,
  detected_at TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  flagged_conflict_zone BOOLEAN DEFAULT false
);
CREATE INDEX idx_thermal_location ON thermal_detections USING GIST(location);
CREATE INDEX idx_thermal_detected ON thermal_detections(detected_at DESC);
