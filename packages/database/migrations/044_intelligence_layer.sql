CREATE TABLE IF NOT EXISTS event_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_title TEXT NOT NULL,
  canonical_summary TEXT,
  event_ids UUID[] DEFAULT '{}',
  source_count INTEGER DEFAULT 1,
  location TEXT,
  country_code TEXT,
  severity INTEGER,
  event_type TEXT,
  entities JSONB DEFAULT '{}',
  significance_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  latest_event_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='cluster_id') THEN
    ALTER TABLE events ADD COLUMN cluster_id UUID REFERENCES event_clusters(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='intelligence_summary') THEN
    ALTER TABLE events ADD COLUMN intelligence_summary TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='entities') THEN
    ALTER TABLE events ADD COLUMN entities JSONB DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='analyzed_at') THEN
    ALTER TABLE events ADD COLUMN analyzed_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='escalation_indicator') THEN
    ALTER TABLE events ADD COLUMN escalation_indicator BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='is_humanitarian_report') THEN
    ALTER TABLE events ADD COLUMN is_humanitarian_report BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_events_embedding ON events USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE OR REPLACE FUNCTION find_similar_events(
  query_embedding vector(1536),
  similarity_threshold float,
  time_window_hours int
) RETURNS TABLE(id uuid, cluster_id uuid, similarity float) AS $$
  SELECT e.id, e.cluster_id, 1 - (e.embedding <=> query_embedding) AS similarity
  FROM events e
  WHERE e.embedding IS NOT NULL
    AND e.ingested_at > NOW() - (time_window_hours || ' hours')::interval
    AND 1 - (e.embedding <=> query_embedding) > similarity_threshold
  ORDER BY similarity DESC
  LIMIT 5;
$$ LANGUAGE sql STABLE;

CREATE TABLE IF NOT EXISTS forecast_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conflict_zone TEXT,
  country_code CHAR(2),
  signal_type TEXT CHECK (signal_type IN ('ESCALATION_TREND', 'DEESCALATION', 'NEW_FRONT', 'CEASEFIRE_RISK')),
  confidence FLOAT,
  basis TEXT,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS country_risk_scores (
  country_code CHAR(2) PRIMARY KEY,
  risk_score INTEGER CHECK (risk_score BETWEEN 0 AND 100),
  trend TEXT CHECK (trend IN ('rising', 'stable', 'falling')),
  event_count_7d INTEGER DEFAULT 0,
  severity_avg FLOAT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION get_conflict_trends(days int DEFAULT 7)
RETURNS TABLE(zone text, country_code text, event_count bigint, prior_count bigint, change_pct float) AS $$
  SELECT
    COALESCE(region, country_code, 'Unknown') as zone,
    country_code,
    COUNT(*) FILTER (WHERE ingested_at > NOW() - (days || ' days')::interval) as event_count,
    COUNT(*) FILTER (WHERE ingested_at BETWEEN NOW() - (days*2 || ' days')::interval AND NOW() - (days || ' days')::interval) as prior_count,
    CASE
      WHEN COUNT(*) FILTER (WHERE ingested_at BETWEEN NOW() - (days*2 || ' days')::interval AND NOW() - (days || ' days')::interval) = 0 THEN 100.0
      ELSE (COUNT(*) FILTER (WHERE ingested_at > NOW() - (days || ' days')::interval)::float /
            COUNT(*) FILTER (WHERE ingested_at BETWEEN NOW() - (days*2 || ' days')::interval AND NOW() - (days || ' days')::interval)::float - 1) * 100
    END as change_pct
  FROM events
  WHERE ingested_at > NOW() - (days*2 || ' days')::interval
    AND (region IS NOT NULL OR country_code IS NOT NULL)
  GROUP BY COALESCE(region, country_code, 'Unknown'), country_code
  HAVING COUNT(*) FILTER (WHERE ingested_at > NOW() - (days || ' days')::interval) >= 3
  ORDER BY change_pct DESC;
$$ LANGUAGE sql STABLE;
