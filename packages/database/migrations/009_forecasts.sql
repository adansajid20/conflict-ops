-- RULE: score MUST be NULL if event_count < 3. NEVER fabricate a forecast score.
CREATE TABLE forecasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  region TEXT NOT NULL,
  country_code TEXT,
  forecast_type TEXT NOT NULL,
  horizon_days INTEGER NOT NULL,
  score NUMERIC(4,3),
  confidence TEXT,
  event_count INTEGER NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  model_version TEXT DEFAULT 'v1',
  model_registry_id UUID,
  factors JSONB,
  input_event_ids UUID[],
  feature_snapshot JSONB,
  evidence_batch_id UUID,
  benchmark_views NUMERIC(4,3),
  benchmark_cast NUMERIC(4,3),
  CONSTRAINT min_event_count CHECK (event_count >= 0)
);
