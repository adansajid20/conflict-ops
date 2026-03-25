-- Migration 034: Row Level Security policies
-- Service role key bypasses all RLS — these protect against accidental anon key exposure

-- Enable RLS on all sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pirs ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_verifications ENABLE ROW LEVEL SECURITY;

-- Service role can do anything (bypasses RLS)
-- Anon key gets ZERO access — all API routes use service role key
-- This is defense-in-depth; actual auth is via Clerk in the API routes

-- Deny all by default for anon
CREATE POLICY "deny_anon_users" ON users FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_orgs" ON orgs FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_missions" ON missions FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_events" ON events FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_alerts" ON alerts FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_pirs" ON pirs FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_forecasts" ON forecasts FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_api_keys" ON api_keys FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_webhooks" ON webhooks FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_audit_log" ON audit_log FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_geo_verifications" ON geo_verifications FOR ALL TO anon USING (false);

-- Public read-only for non-sensitive tables (vessel/flight tracks are OK for authenticated users)
ALTER TABLE vessel_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE flight_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_anon_vessel_tracks" ON vessel_tracks FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_flight_tracks" ON flight_tracks FOR ALL TO anon USING (false);
