CREATE TABLE escalation_ladders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id UUID REFERENCES missions(id),
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  rungs JSONB NOT NULL,
  current_rung INTEGER DEFAULT 1,
  rung_history JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
