CREATE TABLE narratives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id),
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  velocity_score NUMERIC(5,3),
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  embedding VECTOR(1536),
  is_disinfo BOOLEAN DEFAULT false,
  disinfo_indicators JSONB
);
