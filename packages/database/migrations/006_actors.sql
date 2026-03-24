CREATE TABLE actors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  type TEXT,
  country_code TEXT,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  canonical_id UUID REFERENCES actors(id),
  disambiguation_confidence NUMERIC(4,3),
  is_canonical BOOLEAN DEFAULT true,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
