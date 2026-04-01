DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'orgs'
  ) THEN
    ALTER TABLE orgs ADD COLUMN IF NOT EXISTS data_retention_days INTEGER DEFAULT 365;
    ALTER TABLE orgs ADD COLUMN IF NOT EXISTS ip_allowlist TEXT[] DEFAULT '{}'::text[];
    ALTER TABLE orgs ADD COLUMN IF NOT EXISTS overage_policy TEXT DEFAULT 'notify';

    UPDATE orgs SET data_retention_days = COALESCE(data_retention_days, 365);
    UPDATE orgs SET ip_allowlist = COALESCE(ip_allowlist, '{}'::text[]);
    UPDATE orgs SET overage_policy = COALESCE(overage_policy, 'notify');

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'orgs_data_retention_days_check'
    ) THEN
      ALTER TABLE orgs
        ADD CONSTRAINT orgs_data_retention_days_check
        CHECK (data_retention_days IN (30, 90, 180, 365, 730));
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'orgs_overage_policy_check'
    ) THEN
      ALTER TABLE orgs
        ADD CONSTRAINT orgs_overage_policy_check
        CHECK (overage_policy IN ('allow', 'cap', 'notify'));
    END IF;
  END IF;
END
$$;