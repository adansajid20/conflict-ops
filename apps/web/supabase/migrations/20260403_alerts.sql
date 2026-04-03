CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  conditions JSONB NOT NULL DEFAULT '{}',
  -- conditions shape: { severity_min: 3, regions: ['middle_east'], event_types: ['conflict','airstrike'], keywords: ['iran','nuclear'] }
  frequency TEXT NOT NULL DEFAULT 'realtime',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS alerts_user_id_idx ON public.alerts(user_id);
CREATE INDEX IF NOT EXISTS alerts_active_idx ON public.alerts(is_active) WHERE is_active = true;

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_alerts" ON public.alerts
  FOR ALL USING (user_id = auth.uid()::text OR user_id = current_setting('request.jwt.claims', true)::json->>'sub');
