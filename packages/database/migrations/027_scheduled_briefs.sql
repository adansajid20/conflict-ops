CREATE TABLE scheduled_briefs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  mission_id UUID REFERENCES missions(id),
  cron_expr TEXT NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  format TEXT DEFAULT 'email',
  recipients JSONB,
  active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
