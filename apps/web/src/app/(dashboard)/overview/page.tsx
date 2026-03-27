export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { ChevronUp, TrendingUp } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase/server'
import { OverviewStatCards } from '@/components/dashboard/OverviewStatCards'

type HealthResponse = {
  enabledSources?: Array<{ name: string; ok: boolean; last_seen_at: string | null; events_24h?: number }>
  sources?: { detail?: Array<{ name: string; ok: boolean; last_seen_at: string | null; events_24h?: number }> }
}

type EventRow = {
  id: string
  source: string | null
  title: string | null
  severity: number | string | null
  occurred_at: string | null
  ingested_at?: string | null
  region?: string | null
  country_code?: string | null
  source_country?: string | null
}

type AlertRow = {
  id: string
  title: string | null
  severity: number | string | null
  created_at: string | null
  read?: boolean | null
}

const REGION_KEYWORDS: Array<{ region: string; words: string[] }> = [
  { region: 'Eastern Europe', words: ['ukraine', 'russia', 'belarus', 'crimea', 'donbas', 'poland'] },
  { region: 'Middle East', words: ['israel', 'gaza', 'iran', 'syria', 'lebanon', 'yemen', 'iraq', 'red sea'] },
  { region: 'Sub-Saharan Africa', words: ['sudan', 'sahel', 'mali', 'niger', 'burkina', 'congo', 'somalia', 'ethiopia'] },
  { region: 'Asia-Pacific', words: ['china', 'taiwan', 'korea', 'philippines', 'myanmar', 'south china sea'] },
  { region: 'Americas', words: ['haiti', 'venezuela', 'mexico', 'colombia', 'ecuador'] },
]

function hoursAgo(iso?: string | null) {
  if (!iso) return 'never'
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return '<1h ago'
  return `${hours}h ago`
}

function timeAgo(iso?: string | null) {
  if (!iso) return 'unknown'
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function severityLabel(sev: number | string | null | undefined) {
  const n = typeof sev === 'string' ? Number(sev) : sev ?? 0
  if ((n ?? 0) >= 4) return 'Critical'
  if ((n ?? 0) >= 3) return 'High'
  if ((n ?? 0) >= 2) return 'Medium'
  return 'Low'
}

function severityColor(sev: number | string | null | undefined) {
  const label = severityLabel(sev)
  if (label === 'Critical') return 'var(--sev-critical)'
  if (label === 'High') return 'var(--sev-high)'
  if (label === 'Medium') return 'var(--sev-medium)'
  return 'var(--sev-low)'
}

function sourceBadge(source?: string | null) {
  const key = (source ?? 'unknown').toLowerCase().replace('_', '-')
  const palette: Record<string, { bg: string; fg: string; label: string }> = {
    gdelt: { bg: 'rgba(37,99,235,0.14)', fg: '#60A5FA', label: 'GDELT' },
    reliefweb: { bg: 'rgba(13,148,136,0.14)', fg: '#2DD4BF', label: 'ReliefWeb' },
    gdacs: { bg: 'rgba(249,115,22,0.14)', fg: '#FB923C', label: 'GDACS' },
    unhcr: { bg: 'rgba(79,70,229,0.14)', fg: '#A5B4FC', label: 'UNHCR' },
    'nasa-eonet': { bg: 'rgba(245,158,11,0.14)', fg: '#FBBF24', label: 'NASA EONET' },
    nasa_eonet: { bg: 'rgba(245,158,11,0.14)', fg: '#FBBF24', label: 'NASA EONET' },
  }
  return palette[key] ?? { bg: 'var(--bg-surface-2)', fg: 'var(--text-secondary)', label: source ?? 'Unknown' }
}

function inferRegion(event: EventRow) {
  const hay = `${event.title ?? ''} ${event.region ?? ''} ${event.country_code ?? ''} ${event.source_country ?? ''}`.toLowerCase()
  for (const item of REGION_KEYWORDS) {
    if (item.words.some((word) => hay.includes(word))) return item.region
  }
  return event.region || 'Global / Multi-Region'
}

async function getUserOrgId(userId: string) {
  try {
    const supabase = createServiceClient()
    const { data } = await supabase.from('users').select('org_id').eq('clerk_user_id', userId).single()
    return data?.org_id as string | null
  } catch {
    return null
  }
}

async function getOverviewData() {
  const supabase = createServiceClient()
  const now = Date.now()
  const d1 = new Date(now - 86400000).toISOString()
  const d7 = new Date(now - 7 * 86400000).toISOString()

  const [events24, events7, alertsRes, latestEvents, matrixEvents] = await Promise.all([
    supabase.from('events').select('id', { count: 'exact', head: true }).gte('occurred_at', d1),
    supabase.from('events').select('id', { count: 'exact', head: 'exact' as never }).gte('occurred_at', d7),
    supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('read', false),
    supabase.from('events').select('id,source,title,severity,occurred_at,region,country_code,source_country').order('occurred_at', { ascending: false }).limit(12),
    supabase.from('events').select('id,title,severity,occurred_at,region,country_code,source_country').gte('occurred_at', d7).limit(250),
  ])

  let alertsList: { data: AlertRow[] | null; error: null } | { data: AlertRow[] | null; error: unknown }
  try {
    alertsList = await supabase.from('alerts').select('id,title,severity,created_at,read').eq('read', false).order('created_at', { ascending: false }).limit(5)
  } catch {
    alertsList = { data: null, error: null }
  }
  const healthUrl = `${process.env['NEXT_PUBLIC_APP_URL'] || 'https://conflictradar.co'}/api/health`
  const health = await fetch(healthUrl, { cache: 'no-store' }).then(async (res) => (res.ok ? (await res.json() as HealthResponse) : null)).catch(() => null)

  const recentEvents = (latestEvents.data ?? []) as EventRow[]
  const matrixRows = (matrixEvents.data ?? []) as EventRow[]
  const grouped = Object.values(matrixRows.reduce<Record<string, { region: string; count: number; maxSeverity: number; trend: number }>>((acc, event, index) => {
    const region = inferRegion(event)
    const sev = Number(event.severity ?? 1)
    const weight = index < Math.max(8, Math.floor(matrixRows.length / 3)) ? 1 : -1
    const row = acc[region] ?? { region, count: 0, maxSeverity: 0, trend: 0 }
    row.count += 1
    row.maxSeverity = Math.max(row.maxSeverity, sev)
    row.trend += weight
    acc[region] = row
    return acc
  }, {})).sort((a, b) => b.count - a.count).slice(0, 6)

  const sources = health?.enabledSources ?? health?.sources?.detail ?? []

  return {
    stats: {
      events24h: events24.count ?? 0,
      events7d: events7.count ?? 0,
      activeAlerts: alertsRes.count ?? 0,
      activeRegions: grouped.length,
    },
    matrix: grouped,
    sources,
    recentEvents,
    alerts: (alertsList.data ?? []) as AlertRow[],
  }
}

export default async function OverviewPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const [{ stats, matrix, sources, recentEvents, alerts }, orgId] = await Promise.all([
    getOverviewData(),
    getUserOrgId(userId),
  ])
  const personalMode = !orgId
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'

  const statCards = [
    { label: 'Events 24h', value: stats.events24h, icon: 'activity', color: 'var(--primary)', sparkData: [12, 15, 13, 16, 20, 18, stats.events24h] },
    { label: 'Events 7d', value: stats.events7d, icon: 'globe2', color: '#38BDF8', sparkData: [48, 52, 61, 58, 66, 70, stats.events7d] },
    { label: 'Active Alerts', value: stats.activeAlerts, icon: 'alert-triangle', color: 'var(--sev-high)', sparkData: [2, 3, 4, 2, 5, 4, stats.activeAlerts] },
    { label: 'Hot Regions', value: stats.activeRegions, icon: 'shield-alert', color: 'var(--sev-critical)', sparkData: [1, 2, 3, 3, 4, 5, stats.activeRegions] },
  ] as const

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold" style={{ color: 'var(--text-primary)' }}>Situation Overview</h1>
          <div className="mt-1 text-[12px]" style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{timestamp}</div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {sources.slice(0, 5).map((source) => (
            <div key={source.name} className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px]" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
              {source.ok ? <span className="live-dot" /> : <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--sev-critical)' }} />}
              <span style={{ color: 'var(--text-secondary)' }}>{source.name}</span>
            </div>
          ))}
        </div>
      </header>

      {personalMode && (
        <div className="rounded-xl border px-4 py-3 mb-4" style={{ borderColor: 'var(--border-emphasis)', background: 'var(--primary-dim)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--primary-text)' }}>
            You&apos;re in Personal Mode — alerts, PIRs, and team features require a workspace.
          </span>
          <a href="/settings/org" className="ml-2 text-sm underline" style={{ color: 'var(--primary)' }}>Create workspace →</a>
        </div>
      )}

      <OverviewStatCards cards={[...statCards]} />

      <div className="mt-4 grid gap-4 xl:grid-cols-[3fr_2fr]">
        <section className="rounded-lg border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Regional Threat Matrix</h2>
          </div>
          <div className="p-3">
            {matrix.length === 0 && (
              <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                Regional data populates after ingest completes — run an ingest cycle from the <a href="/admin" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Admin page</a>.
              </div>
            )}
            {matrix.map((row, index) => (
              <div key={row.region} className={`mb-2 grid grid-cols-[1.8fr_.8fr_.6fr_.6fr] items-center gap-3 rounded-md border-l-4 px-4 py-3 animate-fadeInUp stagger-${Math.min(index + 1, 6)}`} style={{ borderLeftColor: severityColor(row.maxSeverity), background: 'var(--bg-surface-2)', borderColor: 'var(--border)' }}>
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{row.region}</div>
                <div>
                  <span className="rounded-full px-2 py-1 text-[11px] font-medium" style={{ background: `${severityColor(row.maxSeverity)}22`, color: severityColor(row.maxSeverity) }}>{severityLabel(row.maxSeverity)}</span>
                </div>
                <div className="text-sm" style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>{row.count}</div>
                <div className="flex items-center gap-1 text-sm" style={{ color: row.trend >= 0 ? 'var(--sev-critical)' : 'var(--sev-low)' }}>
                  {(() => { const TrendIcon = ChevronUp as any; return <TrendIcon size={12} className={row.trend >= 0 ? '' : 'rotate-180'} /> })()}
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{Math.abs(row.trend)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Source Health</h2>
          </div>
          <div className="p-4">
            {sources.slice(0, 5).map((source) => (
              <div key={source.name} className="mb-3 flex items-center justify-between rounded-lg border px-3 py-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)' }}>
                <div className="flex items-center gap-3">
                  {source.ok ? <span className="live-dot" /> : <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--sev-critical)' }} />}
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{source.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{hoursAgo(source.last_seen_at)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm" style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>{source.events_24h ?? 0}</div>
                  <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>events today</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[3fr_2fr]">
        <section className="rounded-lg border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Events</h2>
          </div>
          <div className="relative p-5">
            <div className="absolute bottom-5 left-[22px] top-5 w-px" style={{ background: 'var(--border)' }} />
            <div className="space-y-4">
              {recentEvents.map((event) => {
                const badge = sourceBadge(event.source)
                return (
                  <div key={event.id} className="relative pl-8">
                    <span className="absolute left-[17px] top-2 h-2.5 w-2.5 rounded-full" style={{ background: severityColor(event.severity) }} />
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-full px-2 py-1 text-[11px] font-medium" style={{ background: badge.bg, color: badge.fg }}>{badge.label}</span>
                      <span className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{(event.title ?? 'Untitled event').slice(0, 70)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{timeAgo(event.occurred_at)}</span>
                      <span>•</span>
                      <span>{severityLabel(event.severity)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="rounded-lg border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Active Alerts</h2>
          </div>
          <div className="p-4">
            {alerts.map((alert) => (
              <div key={alert.id} className="mb-3 rounded-lg border px-4 py-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)' }}>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <span className="rounded-full px-2 py-1 text-[11px] font-medium" style={{ background: `${severityColor(alert.severity)}22`, color: severityColor(alert.severity) }}>{severityLabel(alert.severity)}</span>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{timeAgo(alert.created_at)}</span>
                </div>
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{alert.title ?? 'Untitled alert'}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
