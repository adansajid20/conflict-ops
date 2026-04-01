-- Migration 033: Onboarding, usage, and org fields

-- Onboarding complete flag on users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ;

-- Org fields for trial + type
ALTER TABLE orgs
  ADD COLUMN IF NOT EXISTS org_type TEXT,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Mission regions + interests
ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS regions TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS interest_types TEXT[] DEFAULT '{}';

-- Update existing users as onboarded (don't force existing users through wizard)
UPDATE users SET onboarding_complete = TRUE WHERE created_at < NOW() - INTERVAL '1 minute';
