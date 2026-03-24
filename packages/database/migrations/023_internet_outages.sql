CREATE TABLE internet_outages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country_code TEXT NOT NULL,
  asn TEXT,
  provider TEXT,
  outage_type TEXT,
  severity NUMERIC(4,3),
  source TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  correlated_event_ids UUID[] DEFAULT '{}'
);
CREATE INDEX idx_outages_country ON internet_outages(country_code, started_at DESC);
