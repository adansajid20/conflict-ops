CREATE TABLE source_quality_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  total_fetched INTEGER DEFAULT 0,
  duplicate_rate_pct NUMERIC(5,2),
  language_mismatch_rate_pct NUMERIC(5,2),
  malformed_rate_pct NUMERIC(5,2),
  median_confirm_hours NUMERIC(6,2),
  quality_score NUMERIC(4,3),
  computed_at TIMESTAMPTZ DEFAULT NOW()
);
