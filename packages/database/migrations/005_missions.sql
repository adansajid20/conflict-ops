CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  regions TEXT[] DEFAULT '{}',
  actor_ids UUID[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  pir_ids UUID[] DEFAULT '{}',
  is_shared BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
