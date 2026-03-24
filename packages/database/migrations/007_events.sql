CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL,
  source_id TEXT,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  description_original TEXT,
  description_translated TEXT,
  description_lang TEXT,
  translation_confidence NUMERIC(4,3),
  language_detector_version TEXT,
  region TEXT,
  country_code TEXT,
  location GEOGRAPHY(POINT, 4326),
  actor_ids UUID[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  severity INTEGER CHECK (severity BETWEEN 1 AND 5),
  status TEXT DEFAULT 'pending',
  occurred_at TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  heavy_lane_processed BOOLEAN DEFAULT false,
  heavy_lane_at TIMESTAMPTZ,
  embedding VECTOR(1536),
  sentiment_score NUMERIC(4,3),
  data_quality_score NUMERIC(4,3),
  provenance_raw JSONB,
  provenance_inferred JSONB,
  raw JSONB,
  UNIQUE(source, source_id)
);

CREATE INDEX idx_events_location ON events USING GIST(location);
CREATE INDEX idx_events_occurred_at ON events(occurred_at DESC);
CREATE INDEX idx_events_embedding ON events USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_events_country ON events(country_code);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_heavy_lane ON events(heavy_lane_processed, ingested_at) WHERE heavy_lane_processed = false;
