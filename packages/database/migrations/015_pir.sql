CREATE TABLE pir (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id),
  question TEXT NOT NULL,
  priority INTEGER DEFAULT 1,
  status TEXT DEFAULT 'open',
  answer TEXT,
  answered_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
