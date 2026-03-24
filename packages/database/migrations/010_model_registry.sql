CREATE TABLE model_registry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_name TEXT NOT NULL,
  version TEXT NOT NULL,
  parameters JSONB NOT NULL,
  feature_set TEXT[] NOT NULL,
  evaluation_metrics JSONB,
  training_window_start DATE,
  training_window_end DATE,
  deployed_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  is_champion BOOLEAN DEFAULT false,
  is_challenger BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
