import { inngest } from './client'
import { ingestACLED } from '@/lib/ingest/acled'
import { ingestGDELT } from '@/lib/ingest/gdelt'
import { runHeavyLane } from '@/lib/ingest/heavy-lane'
import { computeEscalationLevel } from '@/lib/alerts/escalation'
import { HIGH_CONFLICT_COUNTRIES } from '@/lib/ingest/acled'
import { ingestAISVessels, detectDarkVessels } from '@/lib/ingest/tracking/ais'
import { ingestFIRMS } from '@/lib/ingest/tracking/firms'
import { ingestADSB } from '@/lib/ingest/tracking/adsb'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/client'

// ============================================
// FAST LANE — every 15 minutes
// Cheap: raw ingest + dedup only
// No LLM calls
// ============================================

export const fastLaneIngest = inngest.createFunction(
  {
    id: 'fast-lane-ingest',
    name: 'Fast Lane: Raw Ingest',
    concurrency: { limit: 1 }, // never overlap
  },
  { cron: '*/15 * * * *' },
  async ({ step }) => {
    // Check system flags — if paused, skip
    const { isSafeMode } = await import('@/lib/cache/redis')
    const safeMode = await step.run('check-safe-mode', async () => isSafeMode())

    if (safeMode) {
      return { skipped: true, reason: 'safe-mode-active' }
    }

    const [acledResult, gdeltResult] = await Promise.allSettled([
      step.run('ingest-acled', () => ingestACLED(48)),
      step.run('ingest-gdelt', () => ingestGDELT()),
    ])

    return {
      acled: acledResult.status === 'fulfilled' ? acledResult.value : { error: String(acledResult.reason) },
      gdelt: gdeltResult.status === 'fulfilled' ? gdeltResult.value : { error: String(gdeltResult.reason) },
      timestamp: new Date().toISOString(),
    }
  }
)

// ============================================
// HEAVY LANE — every 30 minutes
// Expensive: GPT-4o extraction + embeddings
// Hard budget: max 50 calls per run
// ============================================

export const heavyLaneProcess = inngest.createFunction(
  {
    id: 'heavy-lane-process',
    name: 'Heavy Lane: AI Extraction + Embedding',
    concurrency: { limit: 1 },
    retries: 1,
  },
  { cron: '*/30 * * * *' },
  async ({ step }) => {
    const { isSafeMode } = await import('@/lib/cache/redis')
    const safeMode = await step.run('check-safe-mode', async () => isSafeMode())

    if (safeMode) {
      return { skipped: true, reason: 'safe-mode-active' }
    }

    const result = await step.run('run-heavy-lane', () => runHeavyLane())

    return {
      ...result,
      timestamp: new Date().toISOString(),
    }
  }
)

// ============================================
// FORECAST RECOMPUTE — every 6 hours
// Scoring: rule-based (no LLM)
// ============================================

export const forecastRecompute = inngest.createFunction(
  {
    id: 'forecast-recompute',
    name: 'Forecast: Recompute Regional Scores',
    concurrency: { limit: 1 },
    retries: 0,
  },
  { cron: '0 */6 * * *' },
  async ({ step }) => {
    const result = await step.run('compute-forecasts', async () => {
      const { createServiceClient } = await import('@/lib/supabase/server')
      const supabase = createServiceClient()

      // Get all countries with events in last 30 days
      const { data: countries } = await supabase
        .from('events')
        .select('country_code')
        .gte('occurred_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .not('country_code', 'is', null)

      if (!countries) return { computed: 0 }

      const uniqueCountries = [...new Set(countries.map(c => c.country_code).filter(Boolean))]
      let computed = 0

      for (const countryCode of uniqueCountries) {
        await computeCountryForecast(countryCode as string)
        computed++
      }

      return { computed, countries: uniqueCountries.length }
    })

    return { ...result, timestamp: new Date().toISOString() }
  }
)

// ============================================
// TRACKING LAYER — every 30 minutes
// AIS vessels + ADS-B flights + FIRMS thermal
// No LLM cost — rule-based signals only
// ============================================

export const trackingIngest = inngest.createFunction(
  { id: 'tracking-ingest', name: 'Tracking Layer: AIS + ADS-B + FIRMS', concurrency: { limit: 1 }, retries: 0 },
  { cron: '*/30 * * * *' },
  async ({ step }) => {
    const [aisResult, adsbResult, firmsResult, darkResult] = await Promise.allSettled([
      step.run('ingest-ais', () => ingestAISVessels()),
      step.run('ingest-adsb', () => ingestADSB()),
      step.run('ingest-firms', () => ingestFIRMS(1)),
      step.run('detect-dark-vessels', () => detectDarkVessels()),
    ])

    return {
      ais: aisResult.status === 'fulfilled' ? aisResult.value : { error: String((aisResult as PromiseRejectedResult).reason) },
      adsb: adsbResult.status === 'fulfilled' ? adsbResult.value : { error: String((adsbResult as PromiseRejectedResult).reason) },
      firms: firmsResult.status === 'fulfilled' ? firmsResult.value : { error: String((firmsResult as PromiseRejectedResult).reason) },
      dark_vessels: darkResult.status === 'fulfilled' ? darkResult.value : 0,
      timestamp: new Date().toISOString(),
    }
  }
)

// ============================================
// ESCALATION MONITOR — every 2 hours
// Rule-based only, no LLM
// ============================================

export const escalationMonitor = inngest.createFunction(
  { id: 'escalation-monitor', name: 'Escalation Ladder Monitor', concurrency: { limit: 1 }, retries: 0 },
  { cron: '0 */2 * * *' },
  async ({ step }) => {
    const results = await step.run('compute-escalations', async () => {
      const outcomes: Array<{ country: string; level: number; changed: boolean }> = []

      for (const countryCode of HIGH_CONFLICT_COUNTRIES.slice(0, 30)) {
        try {
          const result = await computeEscalationLevel(countryCode)
          outcomes.push({ country: countryCode, level: result.level, changed: result.changed })
        } catch {
          // skip failed countries
        }
      }

      return outcomes
    })

    const changed = results.filter(r => r.changed)
    return { computed: results.length, changed: changed.length, escalations: changed, timestamp: new Date().toISOString() }
  }
)

async function computeCountryForecast(countryCode: string): Promise<void> {
  const { createServiceClient } = await import('@/lib/supabase/server')
  const supabase = createServiceClient()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: events } = await supabase
    .from('events')
    .select('severity, occurred_at')
    .eq('country_code', countryCode)
    .gte('occurred_at', thirtyDaysAgo)
    .not('severity', 'is', null)

  const eventCount = events?.length ?? 0

  // RULE: score = NULL if event_count < 3. NEVER FABRICATE.
  if (eventCount < 3) {
    await supabase.from('forecasts').upsert(
      {
        region: countryCode,
        country_code: countryCode,
        forecast_type: 'escalation',
        horizon_days: 30,
        score: null,
        confidence: null,
        event_count: eventCount,
        computed_at: new Date().toISOString(),
        model_version: 'rule-based-v1',
      },
      { onConflict: 'region,forecast_type,horizon_days' }
    )
    return
  }

  // Rule-based scoring
  const severities = events!.map(e => e.severity as number)
  const avgSeverity = severities.reduce((a, b) => a + b, 0) / severities.length
  const maxSeverity = Math.max(...severities)

  // Normalize components (0-1)
  const freqNorm = Math.min(eventCount / 100, 1)
  const severityNorm = avgSeverity / 5
  const maxNorm = maxSeverity / 5

  // Weighted score
  const score = Math.min(
    0.30 * freqNorm +
    0.40 * severityNorm +
    0.30 * maxNorm,
    1.0
  )

  const confidence = eventCount >= 15 ? 'high' : eventCount >= 7 ? 'medium' : 'low'

  await supabase.from('forecasts').upsert(
    {
      region: countryCode,
      country_code: countryCode,
      forecast_type: 'escalation',
      horizon_days: 30,
      score: Math.round(score * 1000) / 1000,
      confidence,
      event_count: eventCount,
      computed_at: new Date().toISOString(),
      model_version: 'rule-based-v1',
      factors: {
        frequency_norm: freqNorm,
        severity_norm: severityNorm,
        max_severity_norm: maxNorm,
        weights: { frequency: 0.30, severity: 0.40, max_severity: 0.30 },
      },
    },
    { onConflict: 'region,forecast_type,horizon_days' }
  )
}

// ============================================
// WEEKLY BRIEF — every Monday 08:00 UTC
// ============================================

export const weeklyBrief = inngest.createFunction(
  { id: 'weekly-brief', name: 'Weekly Situation Brief Email', retries: 1 },
  { cron: '0 8 * * 1' },
  async ({ step }) => {
    await step.run('send-weekly-briefs', async () => {
      const supabase = createServiceClient()
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const weekLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

      // Get orgs on Pro+ with scheduledBriefs enabled
      const { data: orgs } = await supabase
        .from('orgs')
        .select('id, name')
        .in('plan_id', ['pro', 'business', 'enterprise'])
        .eq('subscription_status', 'active')

      if (!orgs?.length) return { sent: 0 }

      let sent = 0

      for (const org of orgs) {
        const [events, alerts, topRegion] = await Promise.allSettled([
          supabase.from('events').select('id', { count: 'exact', head: true }).gte('occurred_at', sevenDaysAgo),
          supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('org_id', org.id).gte('created_at', sevenDaysAgo),
          supabase.from('events').select('region').gte('occurred_at', sevenDaysAgo).limit(100),
        ])

        const eventCount = events.status === 'fulfilled' ? (events.value.count ?? 0) : 0
        const alertCount = alerts.status === 'fulfilled' ? (alerts.value.count ?? 0) : 0

        // Tally top region
        let topRegionName = 'Global'
        if (topRegion.status === 'fulfilled' && topRegion.value.data) {
          const counts: Record<string, number> = {}
          for (const r of topRegion.value.data) {
            if (r.region) counts[r.region] = (counts[r.region] ?? 0) + 1
          }
          const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
          if (sorted[0]) topRegionName = sorted[0][0]
        }

        // Get owner/admin emails
        const { data: members } = await supabase
          .from('users')
          .select('email')
          .eq('org_id', org.id)
          .in('role', ['owner', 'admin'])
          .not('email', 'is', null)

        for (const member of (members ?? [])) {
          if (!member.email) continue
          await sendEmail({
            to: member.email,
            template: 'weekly_brief',
            data: { week: weekLabel, events_this_week: eventCount, active_alerts: alertCount, top_region: topRegionName },
          })
          sent++
        }
      }

      return { sent }
    })
  }
)

// ============================================
// TRIAL EXPIRY NOTIFIER — daily at 10:00 UTC
// ============================================

export const trialExpiryNotifier = inngest.createFunction(
  { id: 'trial-expiry-notifier', name: 'Trial Expiry Email (3 days warning)', retries: 1 },
  { cron: '0 10 * * *' },
  async ({ step }) => {
    await step.run('check-expiring-trials', async () => {
      const supabase = createServiceClient()
      const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      const fourDaysFromNow = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)

      // Orgs whose trial ends in the next 3-4 days (send once in that window)
      const { data: expiringOrgs } = await supabase
        .from('orgs')
        .select('id, name')
        .eq('subscription_status', 'trialing')
        .gte('trial_ends_at', threeDaysFromNow.toISOString())
        .lt('trial_ends_at', fourDaysFromNow.toISOString())

      if (!expiringOrgs?.length) return { notified: 0 }

      let notified = 0

      for (const org of expiringOrgs) {
        const { data: owners } = await supabase
          .from('users')
          .select('email')
          .eq('org_id', org.id)
          .eq('role', 'owner')
          .not('email', 'is', null)

        for (const owner of (owners ?? [])) {
          if (!owner.email) continue
          await sendEmail({ to: owner.email, template: 'trial_ending', data: { org_name: org.name } })
          notified++
        }
      }

      return { notified }
    })
  }
)
