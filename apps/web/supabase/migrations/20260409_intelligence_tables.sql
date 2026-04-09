-- ═══════════════════════════════════════════════════════════════
-- composite_threat_scores: Unified threat assessment per country
-- Combines all signal types into a single 0-100 score
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.composite_threat_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  country_name TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('minimal', 'low', 'medium', 'high', 'critical')),
  trend TEXT NOT NULL DEFAULT 'stable' CHECK (trend IN ('improving', 'stable', 'deteriorating')),
  signal_breakdown JSONB NOT NULL DEFAULT '{}',
  weighted_contributions JSONB NOT NULL DEFAULT '{}',
  key_drivers TEXT[] DEFAULT '{}',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS composite_scores_country_idx ON public.composite_threat_scores(country_code);
CREATE INDEX IF NOT EXISTS composite_scores_calculated_idx ON public.composite_threat_scores(calculated_at DESC);
CREATE INDEX IF NOT EXISTS composite_scores_severity_idx ON public.composite_threat_scores(severity);

ALTER TABLE public.composite_threat_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_read_composite_scores" ON public.composite_threat_scores FOR SELECT USING (true);


-- ═══════════════════════════════════════════════════════════════
-- sanctions_entities: OFAC SDN, UN consolidated, etc.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.sanctions_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_source TEXT NOT NULL DEFAULT 'OFAC_SDN' CHECK (list_source IN ('OFAC_SDN', 'UN_CONSOLIDATED', 'EU_CONSOLIDATED')),
  entity_name TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'individual' CHECK (entity_type IN ('individual', 'entity', 'vessel', 'organization')),
  country TEXT,
  program TEXT,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(list_source, entity_name)
);

CREATE INDEX IF NOT EXISTS sanctions_entities_list_source_idx ON public.sanctions_entities(list_source);
CREATE INDEX IF NOT EXISTS sanctions_entities_name_idx ON public.sanctions_entities(entity_name);
CREATE INDEX IF NOT EXISTS sanctions_entities_country_idx ON public.sanctions_entities(country);

ALTER TABLE public.sanctions_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_read_sanctions" ON public.sanctions_entities FOR SELECT USING (true);


-- ═══════════════════════════════════════════════════════════════
-- sanctions_matches: Cross-references between sanctions and actors
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.sanctions_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sanctions_entity_id UUID NOT NULL REFERENCES public.sanctions_entities(id) ON DELETE CASCADE,
  matched_entity_type TEXT NOT NULL CHECK (matched_entity_type IN ('actor', 'entity', 'organization')),
  matched_entity_id TEXT NOT NULL,
  match_confidence FLOAT NOT NULL DEFAULT 0.5 CHECK (match_confidence >= 0 AND match_confidence <= 1),
  match_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sanctions_entity_id, matched_entity_id)
);

CREATE INDEX IF NOT EXISTS sanctions_matches_entity_idx ON public.sanctions_matches(sanctions_entity_id);
CREATE INDEX IF NOT EXISTS sanctions_matches_matched_idx ON public.sanctions_matches(matched_entity_id);

ALTER TABLE public.sanctions_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_read_sanctions_matches" ON public.sanctions_matches FOR SELECT USING (true);


-- ═══════════════════════════════════════════════════════════════
-- commodity_prices: Historical commodity price tracking
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.commodity_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  price FLOAT NOT NULL,
  change_24h FLOAT,
  change_pct_24h FLOAT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS commodity_prices_symbol_idx ON public.commodity_prices(symbol);
CREATE INDEX IF NOT EXISTS commodity_prices_recorded_idx ON public.commodity_prices(recorded_at DESC);

ALTER TABLE public.commodity_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_read_commodity_prices" ON public.commodity_prices FOR SELECT USING (true);


-- ═══════════════════════════════════════════════════════════════
-- vessel_tracks: Maritime vessel positions and status
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.vessel_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mmsi BIGINT UNIQUE NOT NULL,
  imo INTEGER,
  name TEXT,
  ship_type INTEGER,
  ship_type_label TEXT,
  flag_country TEXT,
  longitude FLOAT NOT NULL,
  latitude FLOAT NOT NULL,
  speed FLOAT DEFAULT 0,
  course FLOAT,
  heading INTEGER,
  destination TEXT,
  is_dark BOOLEAN DEFAULT FALSE,
  dark_since TIMESTAMPTZ,
  zone_name TEXT,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vessel_tracks_mmsi_idx ON public.vessel_tracks(mmsi);
CREATE INDEX IF NOT EXISTS vessel_tracks_zone_idx ON public.vessel_tracks(zone_name);
CREATE INDEX IF NOT EXISTS vessel_tracks_dark_idx ON public.vessel_tracks(is_dark) WHERE is_dark = true;
CREATE INDEX IF NOT EXISTS vessel_tracks_last_seen_idx ON public.vessel_tracks(last_seen DESC);

ALTER TABLE public.vessel_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_read_vessel_tracks" ON public.vessel_tracks FOR SELECT USING (true);


-- ═══════════════════════════════════════════════════════════════
-- maritime_tracks: Alternative vessel tracking table (from AIS)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.maritime_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mmsi BIGINT UNIQUE NOT NULL,
  source_id TEXT,
  ship_name TEXT,
  ship_type INTEGER,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  speed FLOAT DEFAULT 0,
  course FLOAT,
  heading INTEGER,
  nav_status INTEGER,
  flag TEXT,
  imo INTEGER,
  callsign TEXT,
  zone_name TEXT,
  location GEOMETRY(Point, 4326),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS maritime_tracks_mmsi_idx ON public.maritime_tracks(mmsi);
CREATE INDEX IF NOT EXISTS maritime_tracks_zone_idx ON public.maritime_tracks(zone_name);
CREATE INDEX IF NOT EXISTS maritime_tracks_location_idx ON public.maritime_tracks USING GIST(location);
CREATE INDEX IF NOT EXISTS maritime_tracks_last_seen_idx ON public.maritime_tracks(last_seen DESC);

ALTER TABLE public.maritime_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_read_maritime_tracks" ON public.maritime_tracks FOR SELECT USING (true);


-- ═══════════════════════════════════════════════════════════════
-- internet_outages: Internet disruption tracking
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.internet_outages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  reason TEXT,
  affected_users_estimate INTEGER,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS internet_outages_country_idx ON public.internet_outages(country);
CREATE INDEX IF NOT EXISTS internet_outages_recorded_idx ON public.internet_outages(recorded_at DESC);
CREATE INDEX IF NOT EXISTS internet_outages_resolved_idx ON public.internet_outages(resolved_at) WHERE resolved_at IS NULL;

ALTER TABLE public.internet_outages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_read_internet_outages" ON public.internet_outages FOR SELECT USING (true);


-- ═══════════════════════════════════════════════════════════════
-- market_correlations: Links between commodity/market moves and events
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.market_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity_symbol TEXT NOT NULL,
  price_change_pct FLOAT NOT NULL,
  correlation_strength FLOAT DEFAULT 0.5 CHECK (correlation_strength >= 0 AND correlation_strength <= 1),
  ai_explanation TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS market_corr_symbol_idx ON public.market_correlations(commodity_symbol);
CREATE INDEX IF NOT EXISTS market_corr_detected_idx ON public.market_correlations(detected_at DESC);

ALTER TABLE public.market_correlations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_read_market_correlations" ON public.market_correlations FOR SELECT USING (true);
