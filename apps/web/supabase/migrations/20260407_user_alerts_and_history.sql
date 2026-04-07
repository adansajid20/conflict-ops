-- ═══════════════════════════════════════════════════════════════
-- user_alerts: Personal alert rules created by users
-- These are evaluated by the evaluate-alerts cron against events
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.user_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  alert_type TEXT NOT NULL DEFAULT 'custom',
  config JSONB NOT NULL DEFAULT '{}',
  channels TEXT[] NOT NULL DEFAULT ARRAY['in_app'],
  cooldown_minutes INTEGER NOT NULL DEFAULT 30,
  active BOOLEAN NOT NULL DEFAULT true,
  last_triggered TIMESTAMPTZ,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_alerts_user_id_idx ON public.user_alerts(user_id);
CREATE INDEX IF NOT EXISTS user_alerts_active_idx ON public.user_alerts(active) WHERE active = true;

ALTER TABLE public.user_alerts ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; for client access, match on user_id
CREATE POLICY "users_own_user_alerts" ON public.user_alerts
  FOR ALL USING (true);


-- ═══════════════════════════════════════════════════════════════
-- alert_history: Triggered alert notifications
-- Written by evaluate-alerts cron when a rule matches an event
-- Read by the Alerts page to show the notification feed
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  rule_id UUID REFERENCES public.user_alerts(id) ON DELETE SET NULL,
  event_id TEXT,
  title TEXT NOT NULL,
  body TEXT,
  severity INTEGER DEFAULT 1,
  channel TEXT DEFAULT 'in_app',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS alert_history_user_id_idx ON public.alert_history(user_id);
CREATE INDEX IF NOT EXISTS alert_history_created_at_idx ON public.alert_history(created_at DESC);
CREATE INDEX IF NOT EXISTS alert_history_unread_idx ON public.alert_history(user_id, read) WHERE read = false;

ALTER TABLE public.alert_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_alert_history" ON public.alert_history
  FOR ALL USING (true);
