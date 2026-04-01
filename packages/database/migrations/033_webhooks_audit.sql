-- Migration 032: Webhooks + Audit log + Enterprise org fields

-- Webhooks
CREATE TABLE IF NOT EXISTS webhooks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  url              TEXT NOT NULL,
  event_types      TEXT[] NOT NULL DEFAULT '{}',
  secret           TEXT NOT NULL,
  description      TEXT,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  failure_count    INTEGER NOT NULL DEFAULT 0,
  last_triggered   TIMESTAMPTZ,
  last_error       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS webhooks_org_idx ON webhooks(org_id);
CREATE INDEX IF NOT EXISTS webhooks_active_idx ON webhooks(active) WHERE active = TRUE;

-- Audit log
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

CREATE INDEX IF NOT EXISTS audit_log_org_idx ON audit_log(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log(action);

-- Enterprise org fields
ALTER TABLE orgs
  ADD COLUMN IF NOT EXISTS sso_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sso_provider   TEXT,
  ADD COLUMN IF NOT EXISTS sso_config     JSONB,
  ADD COLUMN IF NOT EXISTS seats_used     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seats_limit    INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS white_label    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS custom_domain  TEXT;

-- API keys table (hash stored, never plaintext)
CREATE TABLE IF NOT EXISTS api_keys (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  created_by       UUID REFERENCES users(id),
  name             TEXT NOT NULL,
  key_hash         TEXT NOT NULL UNIQUE,
  key_prefix       TEXT NOT NULL,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  last_used        TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_keys_org_idx ON api_keys(org_id);
CREATE INDEX IF NOT EXISTS api_keys_hash_idx ON api_keys(key_hash) WHERE active = TRUE;
