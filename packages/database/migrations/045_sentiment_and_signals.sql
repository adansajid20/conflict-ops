-- Create correlation_signals table if it doesn't exist
CREATE TABLE IF NOT EXISTS correlation_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code CHAR(2),
  region TEXT,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN (
    'rhetoric_escalation',
    'escalation_language',
    'tone_shift_signal',
    'precursor_event',
    'cyclical_anomaly',
    'long_term_trend'
  )),
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  description TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  UNIQUE(country_code, pattern_type, detected_at)
);

CREATE INDEX IF NOT EXISTS idx_correlation_signals_country ON correlation_signals(country_code, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_correlation_signals_region ON correlation_signals(region, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_correlation_signals_pattern ON correlation_signals(pattern_type, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_correlation_signals_detected_at ON correlation_signals(detected_at DESC);

-- Add strategic context tracking table
CREATE TABLE IF NOT EXISTS strategic_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code CHAR(2) NOT NULL UNIQUE,
  phase TEXT CHECK (phase IN ('escalation', 'peak', 'de-escalation', 'dormant')),
  long_term_trend JSONB,
  cyclical_context JSONB,
  active_precursors JSONB DEFAULT '[]',
  strategic_risk_level INTEGER CHECK (strategic_risk_level >= 0 AND strategic_risk_level <= 100),
  forecast_note TEXT,
  assessed_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strategic_assessments_country ON strategic_assessments(country_code);
CREATE INDEX IF NOT EXISTS idx_strategic_assessments_phase ON strategic_assessments(phase);
CREATE INDEX IF NOT EXISTS idx_strategic_assessments_risk ON strategic_assessments(strategic_risk_level DESC);
CREATE INDEX IF NOT EXISTS idx_strategic_assessments_updated ON strategic_assessments(updated_at DESC);

-- Create RPC function to get top active countries
CREATE OR REPLACE FUNCTION get_top_active_countries(days int DEFAULT 30, limit_count int DEFAULT 30)
RETURNS TABLE(country_code text, event_count bigint) AS $$
  SELECT
    country_code,
    COUNT(*) as event_count
  FROM events
  WHERE country_code IS NOT NULL
    AND ingested_at > NOW() - (days || ' days')::interval
  GROUP BY country_code
  HAVING COUNT(*) >= 3
  ORDER BY event_count DESC
  LIMIT limit_count;
$$ LANGUAGE sql STABLE;
