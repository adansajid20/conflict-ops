CREATE TABLE ach_hypotheses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  probability NUMERIC(4,3),
  probability_history JSONB DEFAULT '[]',
  evidence_ids UUID[] DEFAULT '{}',
  inconsistency_matrix JSONB,
  key_indicators JSONB DEFAULT '[]',
  last_evidence_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
