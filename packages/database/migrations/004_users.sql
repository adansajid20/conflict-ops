CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  org_id UUID REFERENCES organizations(id),
  email TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'analyst',
  preferred_theme TEXT DEFAULT 'ops',
  locale TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'UTC',
  notification_prefs JSONB DEFAULT '{"in_app":true,"email":true,"quiet_hours":{"enabled":false,"start":"23:00","end":"07:00"}}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
