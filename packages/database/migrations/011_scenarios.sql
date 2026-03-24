CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  baseline JSONB NOT NULL,
  results JSONB,
  iterations INTEGER DEFAULT 1000,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
