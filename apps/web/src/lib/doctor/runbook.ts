export type RunbookEntry = {
  pattern: string
  symptoms: string[]
  diagnosis: string
  recommended_action: string
  auto_healable: boolean
}

export const RUNBOOK: RunbookEntry[] = [
  {
    pattern: 'API latency regression',
    symptoms: ['p95 latency rising above 2s', 'admin dashboard feels slow', 'spiky response times'],
    diagnosis: 'Review api_logs percentiles, recent deployments, and slow Supabase queries.',
    recommended_action: 'Reduce expensive joins, inspect recent releases, and fall back to cached snapshots if needed.',
    auto_healable: false,
  },
  {
    pattern: 'Database pool saturation',
    symptoms: ['SELECT 1 probe is slow or failing', 'route errors across dashboard APIs', 'timeouts from Supabase'],
    diagnosis: 'Database connectivity is degraded or exhausted.',
    recommended_action: 'Activate safe mode, reduce traffic, and inspect Supabase connection health.',
    auto_healable: true,
  },
  {
    pattern: 'Redis cache collapse',
    symptoms: ['cache hit rate below 20%', 'redis stats missing', 'repeated cold loads'],
    diagnosis: 'Cache keys are stale, evicted, or never populated.',
    recommended_action: 'Flush unhealthy cache patterns, rebuild critical snapshots, and verify Redis credentials.',
    auto_healable: true,
  },
  {
    pattern: 'Ingest source stalled',
    symptoms: ['source not seen for >30m', 'system_flags stale', 'coverage banner degrading'],
    diagnosis: 'An ingest source stopped producing fresh events.',
    recommended_action: 'Check provider status, credentials, and source-specific logs.',
    auto_healable: false,
  },
  {
    pattern: 'Source circuit open',
    symptoms: ['source absent for >2h', 'repeat failures for a single feed', 'doctor opened circuit breaker'],
    diagnosis: 'Persistent provider failure likely needs operator attention.',
    recommended_action: 'Check API key rotation, provider quotas, and reopen the circuit after verification.',
    auto_healable: true,
  },
  {
    pattern: 'Source zero-event hour',
    symptoms: ['events count is zero for a source in the last hour', 'coverage drops in one region'],
    diagnosis: 'Feed may be idle, filtered too aggressively, or upstream is empty.',
    recommended_action: 'Validate source parser output and compare against raw provider payloads.',
    auto_healable: false,
  },
  {
    pattern: 'Inngest queue backlog',
    symptoms: ['queue depth elevated', 'scheduled jobs delayed', 'doctor alerts firing repeatedly'],
    diagnosis: 'Background work is accumulating faster than it clears.',
    recommended_action: 'Inspect Inngest throughput, concurrency, and stuck function runs.',
    auto_healable: false,
  },
  {
    pattern: 'AI spend spike',
    symptoms: ['ai_spend_today above $5', 'heavy lane costs climbing', 'budget guardrails tripped'],
    diagnosis: 'Heavy lane is over-consuming model budget.',
    recommended_action: 'Verify heavy lane batch size, model selection, and duplicate processing.',
    auto_healable: true,
  },
  {
    pattern: 'Heavy lane paused',
    symptoms: ['heavy_lane_paused flag set', 'AI enrichment backlog grows', 'spend alert acknowledged'],
    diagnosis: 'Cost-protection pause is active.',
    recommended_action: 'Resume only after spend reset or heavy lane settings are corrected.',
    auto_healable: true,
  },
  {
    pattern: 'Safe mode active',
    symptoms: ['X-Safe-Mode header present', 'dashboard serving cached snapshots', 'live writes suppressed'],
    diagnosis: 'Operational degradation triggered platform protection mode.',
    recommended_action: 'Stabilize the failing dependency, then disable safe mode once cached endpoints are healthy.',
    auto_healable: true,
  },
  {
    pattern: 'Cached snapshot missing during safe mode',
    symptoms: ['safe mode enabled', 'route returns stub payload', 'users see limited data'],
    diagnosis: 'No recent snapshot exists for one or more critical endpoints.',
    recommended_action: 'Warm cache snapshots before maintenance windows and after deploys.',
    auto_healable: false,
  },
  {
    pattern: 'Doctor snapshot expired',
    symptoms: ['doctor:last_run missing', 'dashboard last updated badge stale', 'run-now required'],
    diagnosis: 'Scheduled doctor execution is not persisting status.',
    recommended_action: 'Inspect Inngest schedule, Redis TTL behavior, and function errors.',
    auto_healable: false,
  },
  {
    pattern: 'Audit log write degraded',
    symptoms: ['auto-heal action missing from logs', 'admin can trigger controls but history is empty'],
    diagnosis: 'Audit pipeline is partially failing even if control action succeeded.',
    recommended_action: 'Verify audit_log table health and service-role write access.',
    auto_healable: false,
  },
  {
    pattern: 'Provider auth drift',
    symptoms: ['single source repeatedly stale', 'HTTP 401/403 in source logs', 'circuit opens after retries'],
    diagnosis: 'Credentials likely expired or provider policy changed.',
    recommended_action: 'Rotate source credentials and validate permission scopes.',
    auto_healable: false,
  },
  {
    pattern: 'Cross-system partial outage',
    symptoms: ['multiple warns across db/cache/queue', 'recommendations stack up', 'operator confidence drops'],
    diagnosis: 'Platform is degraded across multiple dependencies.',
    recommended_action: 'Keep safe mode on, prioritize dependency recovery, and avoid feature changes until stable.',
    auto_healable: false,
  },
]
