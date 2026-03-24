CREATE TABLE mobility_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country_code TEXT NOT NULL,
  region TEXT,
  category TEXT,
  change_pct NUMERIC(6,2),
  source TEXT DEFAULT 'google_mobility',
  snapshot_date DATE NOT NULL,
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  anomaly_z_score NUMERIC(5,3),
  UNIQUE(country_code, region, category, snapshot_date)
);
