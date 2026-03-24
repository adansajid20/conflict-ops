CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  mission_id UUID REFERENCES missions(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  severity INTEGER CHECK (severity BETWEEN 1 AND 5),
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  read BOOLEAN DEFAULT false,
  metadata JSONB
);
CREATE INDEX idx_alerts_org_read ON alerts(org_id, read, delivered_at DESC);
