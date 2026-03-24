CREATE TABLE system_health_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  overall_status TEXT NOT NULL,
  report JSONB NOT NULL,
  auto_actions_taken JSONB,
  alerts_fired JSONB
);

CREATE TABLE circuit_breakers (
  source_id TEXT PRIMARY KEY,
  status TEXT DEFAULT 'closed',
  failure_count INTEGER DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  auto_retry_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE system_flags (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  set_by TEXT,
  reason TEXT,
  set_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE job_execution_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',
  duration_ms INTEGER,
  records_processed INTEGER,
  error_message TEXT,
  metadata JSONB
);

CREATE TABLE runbooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symptom TEXT NOT NULL,
  likely_causes TEXT[] NOT NULL,
  diagnosis_steps TEXT[] NOT NULL,
  remediation_steps TEXT[] NOT NULL,
  auto_remediable BOOLEAN DEFAULT false,
  auto_action TEXT,
  severity TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
