-- Migration 035: Intelligence fields for events table
-- Phase 1 of ConflictRadar intelligence refactor
-- All columns added with IF NOT EXISTS guard via DO block for idempotency

DO $$
BEGIN
  -- summary_short: AI-generated 1-sentence summary
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='summary_short') THEN
    ALTER TABLE events ADD COLUMN summary_short TEXT;
  END IF;

  -- summary_full: AI-generated full summary paragraph
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='summary_full') THEN
    ALTER TABLE events ADD COLUMN summary_full TEXT;
  END IF;

  -- key_actors: extracted entity/actor names
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='key_actors') THEN
    ALTER TABLE events ADD COLUMN key_actors TEXT[] DEFAULT '{}';
  END IF;

  -- source_outlets: list of outlets that reported this event
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='source_outlets') THEN
    ALTER TABLE events ADD COLUMN source_outlets TEXT[] DEFAULT '{}';
  END IF;

  -- corroboration_count: how many independent sources confirm this
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='corroboration_count') THEN
    ALTER TABLE events ADD COLUMN corroboration_count INTEGER DEFAULT 1;
  END IF;

  -- outlet_name: resolved display name of the publishing outlet
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='outlet_name') THEN
    ALTER TABLE events ADD COLUMN outlet_name TEXT;
  END IF;

  -- location_confidence: how confident we are in the event's geo location
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='location_confidence') THEN
    ALTER TABLE events ADD COLUMN location_confidence TEXT DEFAULT 'unknown'
      CHECK (location_confidence IN ('exact', 'approximate', 'unknown'));
  END IF;

  -- significance_score: 1-100 relative importance score (higher = more significant)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='significance_score') THEN
    ALTER TABLE events ADD COLUMN significance_score INTEGER;
  END IF;

  -- summarized_at: when AI summarization was last run
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='summarized_at') THEN
    ALTER TABLE events ADD COLUMN summarized_at TIMESTAMPTZ;
  END IF;

  -- language: ISO 639-1 language code of the source content
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='language') THEN
    ALTER TABLE events ADD COLUMN language TEXT DEFAULT 'en';
  END IF;
END
$$;

-- Backfill location_confidence safely based on existing data
-- 'exact': authoritative geo sources with precise point data
UPDATE events
SET location_confidence = 'exact'
WHERE location_confidence = 'unknown'
  AND source IN ('usgs', 'gdacs', 'nasa_eonet', 'nasa-eonet')
  AND location IS NOT NULL;

-- 'approximate': has country_code but not from exact-geo sources
UPDATE events
SET location_confidence = 'approximate'
WHERE location_confidence = 'unknown'
  AND country_code IS NOT NULL
  AND country_code != ''
  AND source NOT IN ('usgs', 'gdacs', 'nasa_eonet', 'nasa-eonet');

-- Create index for location_confidence queries
CREATE INDEX IF NOT EXISTS idx_events_location_confidence ON events(location_confidence);
CREATE INDEX IF NOT EXISTS idx_events_significance ON events(significance_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_events_language ON events(language);
