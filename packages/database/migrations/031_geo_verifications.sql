-- Migration 031: Geolocation verification queue

CREATE TYPE verification_tier AS ENUM ('confirmed', 'probable', 'possible', 'unverified', 'false');

CREATE TABLE IF NOT EXISTS geo_verifications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  analyst_id       UUID REFERENCES users(id),
  source_url       TEXT NOT NULL,
  claimed_location TEXT,
  claimed_time     TIMESTAMPTZ,
  assigned_lat     DOUBLE PRECISION,
  assigned_lng     DOUBLE PRECISION,
  tier             verification_tier NOT NULL DEFAULT 'unverified',
  confidence_score INTEGER NOT NULL DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  checks           JSONB NOT NULL DEFAULT '[]',
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS geo_verifications_org_idx ON geo_verifications(org_id);
CREATE INDEX IF NOT EXISTS geo_verifications_tier_idx ON geo_verifications(tier);
CREATE INDEX IF NOT EXISTS geo_verifications_created_idx ON geo_verifications(created_at DESC);
