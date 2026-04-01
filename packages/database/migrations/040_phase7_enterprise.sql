CREATE TABLE IF NOT EXISTS prediction_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE NOT NULL,
  platform TEXT NOT NULL,
  title TEXT NOT NULL,
  probability DOUBLE PRECISION,
  resolution_date TIMESTAMPTZ,
  linked_region TEXT,
  url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS escalation_ladders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  mission_id UUID,
  current_rung INTEGER NOT NULL DEFAULT 1 CHECK (current_rung >= 1 AND current_rung <= 10),
  last_advanced_at TIMESTAMPTZ,
  auto_advance BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS travelers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  destination TEXT,
  status TEXT DEFAULT 'registered',
  checkin_token TEXT DEFAULT md5(random()::text || clock_timestamp()::text),
  last_checkin_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS travel_risk_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  traveler_id UUID,
  destination TEXT NOT NULL,
  departure_date DATE,
  report_text TEXT,
  risk_level INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS orgs ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{}'::jsonb;
