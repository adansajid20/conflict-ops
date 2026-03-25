-- Migration 033: API keys and webhook configuration

-- API keys (for public REST API access — Business/Enterprise)
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_hash TEXT UNIQUE;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS last_used TIMESTAMPTZ;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS api_keys_hash_idx ON api_keys(key_hash) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS api_keys_org_idx ON api_keys(org_id);

-- Webhook endpoints
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS event_types TEXT[] DEFAULT '{alert.created}';
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS secret TEXT;
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0;
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS last_triggered TIMESTAMPTZ;
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
