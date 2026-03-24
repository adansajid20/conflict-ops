CREATE TABLE raw_ingest_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL,
  fetch_url TEXT,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  payload_hash TEXT NOT NULL,
  payload_size_bytes INTEGER,
  record_count INTEGER,
  model_version TEXT,
  heavy_lane_processed BOOLEAN DEFAULT false,
  heavy_lane_at TIMESTAMPTZ
);
