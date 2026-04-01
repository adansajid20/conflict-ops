CREATE TABLE IF NOT EXISTS corkboard_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID,
  mission_id UUID,
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS corkboard_states_org_mission_idx ON corkboard_states(org_id, mission_id);
