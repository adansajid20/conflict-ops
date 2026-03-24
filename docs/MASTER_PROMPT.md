# CONFLICT OPS — MASTER BUILD PROMPT
# Version: 1.0 — Final
# Last updated: 2026-03-24
# Lead: Mike (OpenClaw agent, workspace-mike)
# Status: Ready to build — Phase 1 next

---

## PRODUCT VISION

Build **CONFLICT OPS** — a self-serve geopolitical intelligence platform.
Positioning: "Palantir for the 99%."

Target users: analysts, journalists, hedge funds, shipping companies, NGOs, corporate security teams.
Price range: $9–$299/month self-serve. $2,000+/month enterprise.
Competitive gap: nothing self-serve and full-featured exists between GDELT (free, raw) and Dataminr ($10k/month, sales-led).

---

## TECH STACK

```
Frontend:     Next.js 14 (App Router, TypeScript strict mode — NO any, NO non-null assertions)
Database:     Supabase (PostgreSQL + PostGIS + pgvector)
Auth:         Clerk (org mode, RBAC, SAML for enterprise)
Cache/Queue:  Upstash Redis + Upstash QStash
Map:          MapLibre GL JS (base) + Mapbox GL JS (satellite/geocoding only)
Graph:        React Flow (corkboard / link analysis)
Charts:       Recharts
Payments:     Stripe (webhooks only — NEVER poll)
Email:        Resend
Background:   Inngest (event-driven workflows)
AI:           OpenAI text-embedding-3-small + GPT-4o (heavy) + GPT-4o-mini (light)
Storage:      Supabase Storage (evidence archives)
Monitoring:   Sentry + PostHog + Betterstack (status page)
Analytics:    Vercel Analytics (p50/p95 per route)
Deployment:   Vercel Pro + Supabase Cloud
Monorepo:     Turborepo
```

---

## REPOSITORY STRUCTURE

```
/projects/conflict-ops/
├── apps/
│   └── web/                    # Next.js 14 app
├── packages/
│   ├── database/               # Supabase migrations + generated types
│   ├── ingest/                 # Data ingestion workers (Inngest functions)
│   └── shared/                 # Shared types, utils, constants
├── tests/
│   └── security/               # Tenant isolation test suite (run after every phase)
├── docs/
│   ├── MASTER_PROMPT.md        # This file
│   ├── PHASE_CHECKLIST.md      # DoD per phase
│   └── RUNBOOKS.md             # Doctor self-healing runbooks
├── .env.example
├── turbo.json
├── package.json
└── README.md
```

---

## .env.example

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
# IMPORTANT: Configure Clerk JWT template to include:
# { "org_id": "{{org.id}}", "user_id": "{{user.id}}", "role": "{{org.membership.role}}" }
# This is required for Supabase RLS to work correctly.

# OpenAI
OPENAI_API_KEY=

# Mapbox (for satellite/geocoding only — base map uses MapLibre)
NEXT_PUBLIC_MAPBOX_TOKEN=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PRICE_INDIVIDUAL=
STRIPE_PRICE_PRO=
STRIPE_PRICE_BUSINESS=
STRIPE_PRICE_ENTERPRISE=

# Upstash Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Upstash QStash
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=

# Inngest
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# Resend
RESEND_API_KEY=

# Sentry
SENTRY_DSN=

# Data Sources
ACLED_API_KEY=
ACLED_EMAIL=
AISSTREAM_API_KEY=
CLOUDFLARE_RADAR_TOKEN=
NASA_FIRMS_MAP_KEY=
HDX_APP_IDENTIFIER=conflictops

# App
NEXT_PUBLIC_APP_URL=https://conflictops.com
```

---

## EXECUTION RULES (never violate — hardcoded into every agent task)

1. TypeScript strict mode — no `any`, no non-null assertions without explicit null check
2. All API routes return `{ success: boolean, data?: T, error?: string }` — never throw unhandled
3. Plan enforcement server-side only — never trust client-sent plan tier
4. Stripe webhooks = sole subscription source of truth — never poll, never infer from client
5. Forecast score = NULL if event_count < 3 in 30d window — return `{ forecast: null, badge: "No forecast — insufficient data" }` — never fabricate a score
6. Evidence chain of custody — every mutation to evidence appends to chain_of_custody JSONB
7. Audit log — every resource create/update/delete writes to audit_log (Business+ plans)
8. API rate limiting — Upstash Redis sliding window, enforce per org per day from plans table
9. Build one phase at a time — never scaffold future phases, never add placeholder TODOs
10. Webhook delivery — HMAC-SHA256 sign every payload with org's webhook secret
11. Embed on ingest — every event and evidence gets embedded on creation, never on read
12. No hardcoded secrets — all credentials via env vars only
13. Doctor governance — Doctor MAY auto-pause jobs, open circuit breakers, enable safe mode, flush cache, kill stuck processes. Doctor MUST NEVER auto-edit code, run migrations, change business rules, modify billing, or delete user data.
14. Map bundle — MapLibre GL via dynamic import with ssr:false only. Never SSR the map.
15. GDELT filter — only ingest events matching pre-defined country list. Never ingest all GDELT.
16. OpenAI budget — heavy lane max 50 GPT-4o calls per run. Use GPT-4o-mini for low-priority extraction.
17. pgvector index — use hnsw for < 10,000 events, switch to ivfflat at > 10,000.
18. Stripe webhook race condition — webhook handler must upsert org if not yet created.

---

## DATABASE SCHEMA (run migrations in order)

### 001_extensions.sql
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 002_plans.sql
```sql
CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_monthly_cents INTEGER NOT NULL,
  max_missions INTEGER NOT NULL,
  max_members INTEGER NOT NULL,
  history_days INTEGER NOT NULL,
  api_access BOOLEAN DEFAULT false,
  webhooks BOOLEAN DEFAULT false,
  scenarios BOOLEAN DEFAULT false,
  ach_matrix BOOLEAN DEFAULT false,
  sat_suite BOOLEAN DEFAULT false,
  org_mode BOOLEAN DEFAULT false,
  audit_logs BOOLEAN DEFAULT false,
  sso_saml BOOLEAN DEFAULT false,
  custom_sources BOOLEAN DEFAULT false,
  white_label BOOLEAN DEFAULT false,
  scheduled_briefs BOOLEAN DEFAULT false,
  satellite_imagery BOOLEAN DEFAULT false,
  verification_queue BOOLEAN DEFAULT false,
  two_person_rule BOOLEAN DEFAULT false,
  domain_packs TEXT[] DEFAULT '{}',
  max_api_calls_per_day INTEGER DEFAULT 0,
  data_retention_days INTEGER DEFAULT 365,
  usage_based_billing BOOLEAN DEFAULT false
);

INSERT INTO plans VALUES
  ('individual','Individual',900,3,1,7,false,false,false,false,false,false,false,false,false,false,false,false,false,false,'{}',0,7,false),
  ('pro','Pro',2900,25,1,180,false,false,true,true,true,false,false,false,false,false,true,false,false,false,'{}',0,180,false),
  ('business','Business',29900,-1,50,365,true,true,true,true,true,true,true,false,false,false,true,true,true,true,ARRAY['maritime','aviation','chokepoint'],10000,365,true),
  ('enterprise','Enterprise',200000,-1,-1,-1,true,true,true,true,true,true,true,true,true,true,true,true,true,true,ARRAY['maritime','aviation','chokepoint','insurance','esgsec'],-1,-1,true);
```

### 003_organizations.sql
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_org_id TEXT UNIQUE,
  name TEXT NOT NULL,
  plan_id TEXT REFERENCES plans(id) DEFAULT 'individual',
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  subscription_status TEXT DEFAULT 'trialing',
  trial_ends_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '14 days',
  current_period_end TIMESTAMPTZ,
  data_retention_days INTEGER DEFAULT 365,
  theme TEXT DEFAULT 'ops',
  ui_mode TEXT DEFAULT 'ops',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 004_users.sql
```sql
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
```

### 005_missions.sql
```sql
CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  regions TEXT[] DEFAULT '{}',
  actor_ids UUID[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  pir_ids UUID[] DEFAULT '{}',
  is_shared BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 006_actors.sql
```sql
CREATE TABLE actors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  type TEXT,
  country_code TEXT,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  canonical_id UUID REFERENCES actors(id),
  disambiguation_confidence NUMERIC(4,3),
  is_canonical BOOLEAN DEFAULT true,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 007_events.sql
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL,
  source_id TEXT,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  description_original TEXT,
  description_translated TEXT,
  description_lang TEXT,
  translation_confidence NUMERIC(4,3),
  language_detector_version TEXT,
  region TEXT,
  country_code TEXT,
  location GEOGRAPHY(POINT, 4326),
  actor_ids UUID[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  severity INTEGER CHECK (severity BETWEEN 1 AND 5),
  status TEXT DEFAULT 'pending',
  occurred_at TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  heavy_lane_processed BOOLEAN DEFAULT false,
  heavy_lane_at TIMESTAMPTZ,
  embedding VECTOR(1536),
  sentiment_score NUMERIC(4,3),
  data_quality_score NUMERIC(4,3),
  provenance_raw JSONB,
  provenance_inferred JSONB,
  raw JSONB,
  UNIQUE(source, source_id)
);

CREATE INDEX idx_events_location ON events USING GIST(location);
CREATE INDEX idx_events_occurred_at ON events(occurred_at DESC);
CREATE INDEX idx_events_embedding ON events USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_events_country ON events(country_code);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_heavy_lane ON events(heavy_lane_processed, ingested_at) WHERE heavy_lane_processed = false;
```

### 008_raw_ingest_log.sql
```sql
CREATE TABLE raw_ingest_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL,
  fetch_url TEXT,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  payload_hash TEXT NOT NULL,
  payload_size_bytes INTEGER,
  record_count INTEGER,
  model_version TEXT,
  heavy_lane_processed BOOLEAN DEFAULT false,
  heavy_lane_at TIMESTAMPTZ
);
```

### 009_forecasts.sql
```sql
CREATE TABLE forecasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  region TEXT NOT NULL,
  country_code TEXT,
  forecast_type TEXT NOT NULL,
  horizon_days INTEGER NOT NULL,
  score NUMERIC(4,3),
  confidence TEXT,
  event_count INTEGER NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  model_version TEXT DEFAULT 'v1',
  model_registry_id UUID,
  factors JSONB,
  input_event_ids UUID[],
  feature_snapshot JSONB,
  evidence_batch_id UUID,
  benchmark_views NUMERIC(4,3),
  benchmark_cast NUMERIC(4,3),
  CONSTRAINT min_event_count CHECK (event_count >= 0)
);
-- RULE: score MUST be NULL if event_count < 3. Never fabricate.
```

### 010_model_registry.sql
```sql
CREATE TABLE model_registry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_name TEXT NOT NULL,
  version TEXT NOT NULL,
  parameters JSONB NOT NULL,
  feature_set TEXT[] NOT NULL,
  evaluation_metrics JSONB,
  training_window_start DATE,
  training_window_end DATE,
  deployed_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  is_champion BOOLEAN DEFAULT false,
  is_challenger BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 011_scenarios.sql
```sql
CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  baseline JSONB NOT NULL,
  results JSONB,
  iterations INTEGER DEFAULT 1000,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 012_ach_hypotheses.sql
```sql
CREATE TABLE ach_hypotheses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  probability NUMERIC(4,3),
  probability_history JSONB DEFAULT '[]',
  evidence_ids UUID[] DEFAULT '{}',
  inconsistency_matrix JSONB,
  key_indicators JSONB DEFAULT '[]',
  last_evidence_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 013_evidence.sql
```sql
CREATE TABLE evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id),
  mission_id UUID REFERENCES missions(id),
  title TEXT NOT NULL,
  url TEXT,
  archived_url TEXT,
  perceptual_hash TEXT,
  video_frame_hashes TEXT[],
  hash_sha256 TEXT,
  first_seen_url TEXT,
  first_seen_at TIMESTAMPTZ,
  content_text TEXT,
  source_type TEXT,
  credibility INTEGER CHECK (credibility BETWEEN 1 AND 5),
  verification_status TEXT DEFAULT 'unverified',
  tags TEXT[] DEFAULT '{}',
  geolocation GEOGRAPHY(POINT, 4326),
  geo_verification_status TEXT DEFAULT 'unverified',
  geo_verification_notes TEXT,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  chain_of_custody JSONB DEFAULT '[]'
);
```

### 014_verification_queue.sql
```sql
CREATE TABLE verification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id),
  status TEXT DEFAULT 'pending',
  first_reviewer_id UUID REFERENCES users(id),
  first_reviewed_at TIMESTAMPTZ,
  first_decision TEXT,
  second_reviewer_id UUID REFERENCES users(id),
  second_reviewed_at TIMESTAMPTZ,
  second_decision TEXT,
  final_status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 015_pir.sql
```sql
CREATE TABLE pir (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id),
  question TEXT NOT NULL,
  priority INTEGER DEFAULT 1,
  status TEXT DEFAULT 'open',
  answer TEXT,
  answered_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 016_escalation_ladders.sql
```sql
CREATE TABLE escalation_ladders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id UUID REFERENCES missions(id),
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  rungs JSONB NOT NULL,
  current_rung INTEGER DEFAULT 1,
  rung_history JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 017_alerts.sql
```sql
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  mission_id UUID REFERENCES missions(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  severity INTEGER CHECK (severity BETWEEN 1 AND 5),
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  read BOOLEAN DEFAULT false,
  metadata JSONB
);
```

### 018_webhooks.sql
```sql
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  secret TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 019_audit_log.sql
```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_log_org ON audit_log(org_id, created_at DESC);
```

### 020_maritime_tracks.sql
```sql
CREATE TABLE maritime_tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mmsi TEXT NOT NULL,
  vessel_name TEXT,
  vessel_type TEXT,
  flag TEXT,
  location GEOGRAPHY(POINT, 4326),
  speed_knots NUMERIC(5,2),
  heading INTEGER,
  destination TEXT,
  chokepoint TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_maritime_location ON maritime_tracks USING GIST(location);
CREATE INDEX idx_maritime_recorded ON maritime_tracks(recorded_at DESC);
```

### 021_flight_tracks.sql
```sql
CREATE TABLE flight_tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  icao24 TEXT NOT NULL,
  callsign TEXT,
  origin_country TEXT,
  location GEOGRAPHY(POINT, 4326),
  altitude_m INTEGER,
  velocity_ms NUMERIC(6,2),
  heading NUMERIC(5,1),
  squawk TEXT,
  is_military BOOLEAN DEFAULT false,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 022_thermal_detections.sql
```sql
CREATE TABLE thermal_detections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location GEOGRAPHY(POINT, 4326),
  brightness NUMERIC(7,2),
  frp NUMERIC(7,2),
  confidence TEXT,
  instrument TEXT,
  country_code TEXT,
  detected_at TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  flagged_conflict_zone BOOLEAN DEFAULT false
);
CREATE INDEX idx_thermal_location ON thermal_detections USING GIST(location);
```

### 023_internet_outages.sql
```sql
CREATE TABLE internet_outages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country_code TEXT NOT NULL,
  asn TEXT,
  provider TEXT,
  outage_type TEXT,
  severity NUMERIC(4,3),
  source TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  correlated_event_ids UUID[] DEFAULT '{}'
);
```

### 024_mobility_snapshots.sql
```sql
CREATE TABLE mobility_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country_code TEXT NOT NULL,
  region TEXT,
  category TEXT,
  change_pct NUMERIC(6,2),
  source TEXT DEFAULT 'google_mobility',
  snapshot_date DATE NOT NULL,
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  anomaly_z_score NUMERIC(5,3),
  UNIQUE(country_code, region, category, snapshot_date)
);
```

### 025_narratives.sql
```sql
CREATE TABLE narratives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id),
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  velocity_score NUMERIC(5,3),
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  embedding VECTOR(1536),
  is_disinfo BOOLEAN DEFAULT false,
  disinfo_indicators JSONB
);
```

### 026_api_keys.sql
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  key_prefix TEXT NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  rotated_from UUID REFERENCES api_keys(id),
  auto_rotate_days INTEGER,
  rotation_reminder_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);
```

### 027_scheduled_briefs.sql
```sql
CREATE TABLE scheduled_briefs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  mission_id UUID REFERENCES missions(id),
  cron_expr TEXT NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  format TEXT DEFAULT 'email',
  recipients JSONB,
  active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 028_source_quality_metrics.sql
```sql
CREATE TABLE source_quality_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  total_fetched INTEGER DEFAULT 0,
  duplicate_rate_pct NUMERIC(5,2),
  language_mismatch_rate_pct NUMERIC(5,2),
  malformed_rate_pct NUMERIC(5,2),
  median_confirm_hours NUMERIC(6,2),
  quality_score NUMERIC(4,3),
  computed_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 029_system_health.sql
```sql
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
```

---

## ML / SCORING SPECS

### Forecasting (rule-based)
```
score = (
  0.30 * event_frequency_norm +
  0.25 * severity_weighted_mean +
  0.20 * actor_count_norm +
  0.15 * displacement_norm +
  0.10 * media_volume_norm
) clamped to [0.0, 1.0]

RULE: score = NULL if event_count < 3 in rolling 30d window. NEVER FAKE A SCORE.
Confidence: high if event_count >= 15 | medium if >= 7 | low if >= 3
Recompute: every 6 hours per active region
```

### Event Clustering
```
Cosine similarity >= 0.82 (pgvector hnsw)
Jaccard tag overlap >= 0.30
Time window: 72 hours
```

### Anomaly Detection
```
Z-score on 20-day rolling window
|z| > 2.0 = anomaly flag
Applied to: event frequency, severity, mobility, outage severity
```

### Monte Carlo
```
Iterations: 1000
Distribution: uniform ±20% on each assumption
Output: P10/P50/P90 + histogram
```

---

## UI/UX DESIGN SYSTEM

### Two themes (toggle in user settings)

**Ops Mode** (default for Individual/Pro):
- Background: #080A0E | Surface: #0D1117 | Surface-2: #161B22
- Primary: #00FF88 (terminal green) | Accent: #0EA5E9 | Text: #F0F6FC
- Classification banner: "CONFLICT OPS // UNCLASSIFIED // OPERATOR USE ONLY"
- All 20 animations active
- Monospace data labels, ALL CAPS headers

**Professional Mode** (default for Business/Enterprise):
- Background: #0D1B2A | Surface: #112236 | Accent: #3B82F6
- Animations reduced to subtle transitions only
- Clean sans-serif labels, standard case
- No scanlines, no glitch effects

### 20 Animations (Ops Mode full, Professional Mode reduced)
1. Typewriter brief generation (40ms/char, blinking cursor)
2. Radar sweep on map (4s rotation, semi-transparent green arc)
3. Event pulse rings on new high-severity events
4. Live feed slide-in (200ms ease-out, border flash on entry)
5. Scanline overlay scroll (0.3% opacity, 8s loop) — toggle off option
6. Glitch flash on severity-5 alerts (150ms chromatic aberration)
7. Number counter roll-up on stats (600ms ease-out cubic)
8. Network graph node pulse (scale 1.0→1.05→1.0, 2s loop)
9. VERIFIED/DISPUTED stamp animation (rotation bounce + ink-spread)
10. Data stream indicator during active ingest
11. Forecast gauge fill (0 to score, 800ms ease-in-out, color transition)
12. Redacted mode wipe (text → blocks, left-to-right, 300ms staggered)
13. Escalation ladder climb (mechanical slide up + click)
14. Heatmap breathe (opacity 0.6→0.85→0.6, 3s loop)
15. Timeline scrubber playback (100ms fade per event appear/disappear)
16. Loading states: "DECRYPTING..." / "ANALYZING..." / "ESTABLISHING SECURE CHANNEL..."
17. Connection status dot pulse (green/amber/red)
18. Map fly-to on region select (Mapbox/MapLibre flyTo, 1.5s ease)
19. Alert notification spring drop (overshoot settle, 250ms)
20. Argument map edge draw animation (SVG stroke-dashoffset, 300ms)

---

## PHASE 1 — FOUNDATION

**Day 1:**
1. Init Turborepo monorepo at `/projects/conflict-ops/`
2. Create Next.js 14 app (TypeScript strict, Tailwind CSS, App Router)
3. Install and configure Clerk (org mode enabled)
4. Configure Clerk JWT template: include `org_id`, `user_id`, `role`
5. Run Supabase migrations 001–006
6. Verify: sign up → org created → dashboard renders

**Day 2:**
7. Stripe: create 4 products + prices (Individual/Pro/Business/Enterprise)
8. Stripe webhook endpoint at `/api/webhooks/stripe`
9. Handle: `customer.subscription.created/updated/deleted`, `invoice.payment_failed`
10. `getPlanLimits(orgId)` server function — reads from DB, never client
11. Dashboard shell: sidebar nav, empty states
12. Seed 5 sample events

**Day 3 (DoD):**
13. Tenant isolation test suite passes 100%
14. Zero TypeScript errors (`tsc --noEmit`)
15. Zero console errors in production build
16. Stripe checkout → webhook → plan update works end to end
17. `getPlanLimits()` returns correct values for all 4 plans
18. Migrations 001–006 run clean

---

## PHASE 2 — LIVE INTELLIGENCE FEED

**Data Ingest (Inngest scheduled jobs):**
- ACLED: every 15 min, last 48h, deduplicate on (source, source_id)
- GDELT: every 15 min, filter by country list (50 high-conflict countries only)
- RSS/Atom: Reuters, AP, BBC, Al Jazeera, AFP — every 15 min

**Fast Lane (every 5 min, cheap):**
- Raw ingest → basic dedup → store raw event → immediate alert if severity keywords
- Log to raw_ingest_log (hash, size, count, model_version)
- Cost: ~$0.001/run

**Heavy Lane (every 30 min, bounded):**
- Max 50 events per run (hard limit)
- GPT-4o extraction: `{ title, event_type, severity, location, actor_names[], occurred_at, summary_150_chars }`
- GPT-4o-mini for events from low-quality sources
- text-embedding-3-small for all events
- pgvector cluster check (cosine >= 0.82, 72h window)
- Anomaly Z-score update (20-day rolling)
- Forecast recompute for affected regions

**Provenance fields:**
- `provenance_raw`: what the source actually said (verbatim key fields)
- `provenance_inferred`: what the model extracted/inferred
- Both shown in event detail modal

**UI:**
- MapLibre GL map with event clusters
- Feed panel: chronological, filter by region/type/severity
- Alert bell with unread count
- Event detail modal: title, description, actors, provenance split, forecast badge
- Source health panel in admin

**DoD:**
- Events ingesting from ACLED + GDELT every 15 min
- No duplicate events in feed
- Map loads < 3s on 4G throttled
- Forecast badge shows "No forecast — insufficient data" correctly
- p95 API latency < 800ms
- Dashboard LCP < 2.5s
- Zero uncaught errors in ingest pipeline

---

## PHASE 3 — ANALYSIS WORKBENCH

Build (all Pro+ gated server-side):
- Mission create/edit/delete (enforce max_missions from getPlanLimits)
- Monte Carlo scenario engine (1000 iterations, uniform ±20%, P10/P50/P90)
- ACH matrix (hypotheses, evidence rating, inconsistency score, rank by least-inconsistent)
- 5 SAT techniques: KAC, Red Team, Devil's Advocacy, Argument Mapping (React Flow), QOIC
- Corkboard / link analysis (React Flow, 5 node types, 4 edge types, export PNG/JSON)
- PIR tracker (create/rank/close requirements, link to evidence)
- Case timeline playback (time scrubber, all mission layers sync)
- Hypothesis "what changed?" diffs (auto-detect new evidence, show probability shift)

---

## PHASE 4 — DOMAIN SIGNAL PACKS

- AIS via AISStream.io WebSocket (8 chokepoints monitored)
- ADS-B via OpenSky Network REST (military flag, conflict zone filter)
- NASA FIRMS (VIIRS + MODIS, 3h latency, conflict zone cross-reference via PostGIS)
- Cloudflare Radar (internet outage detection, every 30 min)
- Google Mobility Reports (weekly CSV, Z-score anomaly)
- Sentinel-2 via Copernicus (Business+ only, change detection overlay)
- Chokepoint Pack dashboard (8 chokepoints, live vessel count, risk score, traffic chart)
- Telegram public channel monitoring (keyword-based, legal via Bot API)

---

## PHASE 5 — COLLABORATION & ORG MODE

- Member invite via Resend email
- RBAC: owner/admin/analyst/viewer (server-side enforcement on every route)
- Shared missions (Business+)
- Webhook delivery: HMAC-SHA256, retry 3x (1m/5m/15m), delivery log
- API: scoped keys, rate limiting via Upstash, OpenAPI spec at /api/v1/docs
- Scheduled briefs: cron + AI summary (GPT-4o, max 300 words)
- Audit log: all tracked actions, CSV export
- Verification queue (Business+): pending → first review → (two-person rule) → verified/disputed
- Analyst comments + @mentions on events/hypotheses/evidence
- Guest sharing links (expiry, password-protect option)
- Customer discovery gate: 10 discovery calls with one vertical required before Phase 6 starts

---

## PHASE 6 — ADVANCED INTELLIGENCE MODULES

- Hypothesis Tracker 2.0 (probability history chart, key indicators, health badge)
- Counter-Disinfo Shield (pHash images + video keyframes, narrative velocity, disinfo source registry)
- Evidence Integrity (SHA-256 hash, chain of custody, tamper detection, PDF export)
- Data Contracts (per-source SLA monitoring, source health dashboard)
- Economic Warfare Monitor (FRED + UN Comtrade + World Bank, sanctions auto-link)
- Translation Pipeline (6 languages, confidence score, language detector version, UI filter)

---

## PHASE 7 — ENTERPRISE & ECOSYSTEM

- Prediction market integration (Metaculus + Polymarket APIs)
- Forecast calibration dashboard (Brier score vs VIEWS/CAST/Metaculus)
- Escalation Ladder (10 rungs, auto-advance on indicator match, manual override)
- Geolocation verification toolbox (shadow analysis, terrain match, satellite side-by-side, SunCalc)
- Travel Risk / Duty of Care (country risk profiles, traveler registry, ISO 31030 pre-travel report)
- SRCC insurance data pack (Enterprise: structured event export, Lloyd's-friendly format)
- SEC/ESG compliance report generator (GPT-4o, XBRL-ready JSON, Word/PDF export)
- White-label / custom domain + branding
- SSO/SAML via Clerk Enterprise Connections

---

## PHASE 8 — LAUNCH, DISTRIBUTION & AI CO-PILOT

- AI Intel Analyst Co-pilot (GPT-4o tool-calling on mission DB, no hallucination rule)
- Intelligence Report Builder (drag-drop blocks, 5 templates, PDF/Word/HTML export)
- Custom Alert Rules Engine (visual builder, condition logic, 5 rules Pro / unlimited Business+)
- Integration ecosystem (Slack, Teams, PagerDuty, Jira, Zapier webhooks)
- PWA (service worker, push notifications, evidence capture from camera)
- Signal Correlation Engine (auto-discover cross-signal lead indicators)
- Launch: waitlist, Product Hunt, Twitter build threads, LinkedIn B2B outbound

---

## PHASE 9 — TRUST, COMPLIANCE & SCALE

- Trust Center at /security (subprocessors, encryption statement, status page link, SOC 2 roadmap note)
- Status page via Betterstack (conflictops.statuspage.io)
- Data retention controls (per org, configurable 30/90/365 days, auto-purge job)
- Multi-tenant isolation test suite (automated, runs on every deploy in CI)
- Key rotation (API keys + webhooks, 24h grace, emergency revoke)
- GDPR: cookie consent, data export, account delete, DPA template
- Usage-based billing (Stripe metered billing for API calls, webhook deliveries, exports)
- Overage controls (hard stop Business, soft overage billing Enterprise)
- Locale packs (UI: English first, French/Arabic/Spanish post-launch)
- Methods & Limitations page (/methods — public, linked from footer)
- IP allowlisting (Enterprise: restrict access to IP ranges)

---

## PHASE 10 — DOCTOR + SELF-HEALING

- Doctor health check job (every 2 min via Inngest)
- Checks: API latency p50/p95, DB pool, cache hit rate, job health, source health, queue depth, AI spend
- Self-healing decision tree: auto-pause jobs, open circuit breakers, safe mode, flush cache, kill stuck processes
- Safe mode: every API route checks flag → serves last cached snapshot → never blank dashboard
- /admin/doctor UI: green/yellow/red dashboard, auto-actions log, recommendations, manual controls
- Runbook table (pre-seeded 15 common failure patterns)
- Governance rule: Doctor CANNOT auto-edit code, run migrations, change business rules, modify billing

---

## PRICING

| Plan | Price | Key gates |
|---|---|---|
| Individual | $9/month | 3 missions, 7-day history, map + feed only |
| Pro | $29/month | 25 missions, 180-day history + workbench (scenarios, ACH, SAT, PIR) |
| Business | $299/month | Unlimited + org mode, webhooks, API, audit log, domain packs, verification queue |
| Enterprise | $2,000+/custom | Everything + SSO/SAML, white-label, SRCC, SEC/ESG, SLA, custom sources |

Step-up principle: Individual/Pro = interface power. Business/Enterprise = organizational power.

---

## LAUNCH QUALITY BAR (Phase 1–4 must pass before public launch)

- [ ] Dashboard LCP < 2.5s
- [ ] p95 API latency < 800ms on feed/dashboard/map endpoints
- [ ] Map initial load < 3s on 4G throttled
- [ ] Zero blank states — every empty view has a meaningful fallback
- [ ] Alert deduplication working
- [ ] Ingestion health panel shows last_success_at + backoff per source
- [ ] Safe mode activates correctly (smoke test)
- [ ] 500+ real events in DB at launch
- [ ] Forecast badge shows "No forecast" correctly when event_count < 3
- [ ] At least 3 sources ingesting on schedule with no manual intervention
- [ ] Stripe checkout → webhook → plan update end to end
- [ ] Plan limits enforced server-side (exceed mission limit → 403)
- [ ] Tenant isolation test suite passes 100%

---

## LICENSING RISKS

- ACLED: commercial SaaS license required (~$500-2,000/year). Email before launch.
- Market/financial data: never ingest without licensed provider. Default to manual import.
- Mapbox: use MapLibre GL (free) as base. Mapbox only for satellite/geocoding.
- Google Mobility: public data, free for commercial use with attribution.
- NASA FIRMS: free, registration required.
- ReliefWeb: open, requires `appname` param.
- HDX HAPI: open, requires `app_identifier`.

---

## COMPETITIVE MOAT

No competitor has: ACH matrix + Monte Carlo + SAT suite + AIS + FIRMS + prediction market overlay at self-serve pricing.
Dataminr: $10k/month, no self-serve.
Recorded Future: $25k+/year, no self-serve.
Stratfor: criticized for "hollow predictions", no real-time data.
Feedly TI: $18-200/month, just an RSS reader.
WorldMonitorX: open-source, no SaaS, no business.

---

*End of master prompt. Phase 1 is next.*
