-- Migration 032: PIRs, escalation levels, audit log

CREATE TABLE IF NOT EXISTS pirs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  mission_id       UUID REFERENCES missions(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  conditions       JSONB NOT NULL DEFAULT '[]',
  alert_channels   TEXT[] NOT NULL DEFAULT '{in_app}',
  priority         INTEGER NOT NULL DEFAULT 2 CHECK (priority >= 1 AND priority <= 3),
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pirs_org_idx ON pirs(org_id);
CREATE INDEX IF NOT EXISTS pirs_active_idx ON pirs(active) WHERE active = TRUE;

CREATE TABLE IF NOT EXISTS escalation_levels (
  country_code     TEXT PRIMARY KEY,
  level            INTEGER NOT NULL CHECK (level >= 1 AND level <= 5),
  label            TEXT NOT NULL,
  window_days      INTEGER NOT NULL DEFAULT 7,
  event_count      INTEGER NOT NULL DEFAULT 0,
  avg_severity     DOUBLE PRECISION,
  fatality_estimate INTEGER DEFAULT 0,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  actor_id         UUID,
  actor_email      TEXT,
  action           TEXT NOT NULL,
  resource_type    TEXT NOT NULL,
  resource_id      TEXT,
  ip_address       INET,
  user_agent       TEXT,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_org_idx ON audit_log(org_id);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log(action);
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON audit_log(actor_id);

-- SSO config on orgs table
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS sso_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS sso_provider TEXT;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS sso_config JSONB;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS seats_used INTEGER DEFAULT 0;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS seats_limit INTEGER DEFAULT 5;

-- Role on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'analyst'
  CHECK (role IN ('owner', 'admin', 'analyst', 'viewer'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ;
