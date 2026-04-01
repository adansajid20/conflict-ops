ALTER TABLE IF EXISTS ach_hypotheses
  ADD COLUMN IF NOT EXISTS probability_history JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS key_indicators JSONB DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS events
  ADD COLUMN IF NOT EXISTS disinfo_checked_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS narratives
  ADD COLUMN IF NOT EXISTS is_disinfo BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS disinfo_indicators JSONB DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS evidence
  ADD COLUMN IF NOT EXISTS hash_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS chain_of_custody JSONB DEFAULT '[]'::jsonb;
