'use client'

import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type EvidenceRating = 'consistent' | 'inconsistent' | 'neutral' | 'na'
type IndicatorHealth = 'green' | 'amber' | 'red'
type HealthBadge = 'Shifting' | 'Stale' | 'Active'

type ProbabilityPoint = {
  at: string
  probability: number
}

interface Evidence {
  id: string
  title: string
  credibility: 1 | 2 | 3 | 4 | 5
  hypothesisIds?: string[]
  updatedAt?: string
}

interface KeyIndicator {
  label: string
  health: IndicatorHealth
}

interface Hypothesis {
  id: string
  title: string
  description: string
  status: 'active' | 'confirmed' | 'refuted' | 'suspended'
  probability: number
  lastEvidenceAt?: string
  probability_history: ProbabilityPoint[]
  key_indicators: KeyIndicator[]
}

type Matrix = Record<string, Record<string, EvidenceRating>>
type HypothesisDiffState = Record<string, { items: Evidence[]; changedIds: string[]; loading: boolean }>

const STATUS_COLORS: Record<Hypothesis['status'], string> = {
  active: 'var(--accent-blue)',
  confirmed: 'var(--alert-green)',
  refuted: 'var(--alert-red)',
  suspended: 'var(--text-muted)',
}

const RATING_STYLES: Record<EvidenceRating, { color: string; label: string }> = {
  consistent: { color: 'var(--alert-green)', label: 'C' },
  inconsistent: { color: 'var(--alert-red)', label: 'I' },
  neutral: { color: 'var(--text-muted)', label: 'N' },
  na: { color: 'var(--border)', label: '—' },
}

function computeInconsistencyScore(hypothesis: Hypothesis, evidenceList: Evidence[], matrix: Matrix): number {
  let score = 0
  for (const evidence of evidenceList) {
    const rating = matrix[hypothesis.id]?.[evidence.id] ?? 'na'
    if (rating === 'inconsistent') score += evidence.credibility
  }
  return score
}

function storageKey(hypothesisId: string) {
  return `conflict-ops:ach:last-viewed:${hypothesisId}`
}

function deriveHealthBadge(hypothesis: Hypothesis): HealthBadge {
  const lastSevenDays = Date.now() - 7 * 24 * 60 * 60 * 1000
  const recent = hypothesis.probability_history.filter((point) => new Date(point.at).getTime() >= lastSevenDays)
  if (recent.length >= 2) {
    const delta = Math.abs(recent[recent.length - 1]!.probability - recent[0]!.probability)
    if (delta > 0.1) return 'Shifting'
  }

  if (!hypothesis.lastEvidenceAt || new Date(hypothesis.lastEvidenceAt).getTime() < lastSevenDays) {
    return 'Stale'
  }

  return 'Active'
}

function indicatorColor(health: IndicatorHealth) {
  if (health === 'green') return '#22C55E'
  if (health === 'amber') return '#F59E0B'
  return '#EF4444'
}

function badgeColor(badge: HealthBadge) {
  if (badge === 'Shifting') return '#F59E0B'
  if (badge === 'Stale') return '#EF4444'
  return '#22C55E'
}

type ChartComponent = ComponentType<Record<string, unknown>>

export function ACHMatrix({ planHasACH }: { planHasACH: boolean }) {
  const ResponsiveContainerChart = ResponsiveContainer as unknown as ChartComponent
  const LineChartComponent = LineChart as unknown as ChartComponent
  const LineComponent = Line as unknown as ChartComponent
  const XAxisComponent = XAxis as unknown as ChartComponent
  const YAxisComponent = YAxis as unknown as ChartComponent
  const TooltipComponent = Tooltip as unknown as ChartComponent
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([
    {
      id: '1',
      title: 'State-sponsored escalation',
      description: 'Actor A is being directed by a state sponsor to escalate conflict',
      status: 'active',
      probability: 0.45,
      lastEvidenceAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      probability_history: [
        { at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), probability: 0.29 },
        { at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), probability: 0.38 },
        { at: new Date().toISOString(), probability: 0.45 },
      ],
      key_indicators: [
        { label: 'Cross-border logistics chatter', health: 'green' },
        { label: 'State media synchronization', health: 'amber' },
      ],
    },
    {
      id: '2',
      title: 'Resource conflict',
      description: 'Violence is driven by competition for natural resources',
      status: 'active',
      probability: 0.35,
      lastEvidenceAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
      probability_history: [
        { at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), probability: 0.36 },
        { at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), probability: 0.35 },
      ],
      key_indicators: [
        { label: 'Mine seizure reporting', health: 'red' },
        { label: 'Fuel convoy interdictions', health: 'amber' },
      ],
    },
  ])
  const [evidence, setEvidence] = useState<Evidence[]>([
    { id: 'e1', title: 'Satellite imagery shows military buildup', credibility: 4, hypothesisIds: ['1'], updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
    { id: 'e2', title: 'Intercepted communications reference foreign handler', credibility: 3, hypothesisIds: ['1'], updatedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString() },
    { id: 'e3', title: 'Local reports of resource disputes', credibility: 2, hypothesisIds: ['2'], updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
  ])
  const [matrix, setMatrix] = useState<Matrix>({})
  const [newHypothesis, setNewHypothesis] = useState('')
  const [diffs, setDiffs] = useState<HypothesisDiffState>({})

  useEffect(() => {
    void fetch('/api/v1/events?window=30d&limit=50', { cache: 'no-store' })
      .then((response) => response.json() as Promise<{ data?: Array<{ id: string; title: string; severity?: number | null; occurred_at?: string | null; event_type?: string | null }> }>)
      .then((json) => {
        const fetched = (json.data ?? []).slice(0, 8).map((item, index) => ({
          id: item.id,
          title: item.title,
          credibility: ((item.severity ?? 3) >= 5 ? 5 : (item.severity ?? 3)) as 1 | 2 | 3 | 4 | 5,
          hypothesisIds: index % 2 === 0 ? ['1'] : ['2'],
          updatedAt: item.occurred_at ?? new Date().toISOString(),
        }))
        if (fetched.length > 0) setEvidence((current) => [...fetched, ...current.filter((existing) => !fetched.some((next) => next.id === existing.id))])
      })
      .catch(() => undefined)
  }, [])

  const rankedHypotheses = useMemo(
    () => [...hypotheses].sort((a, b) => computeInconsistencyScore(a, evidence, matrix) - computeInconsistencyScore(b, evidence, matrix)),
    [evidence, hypotheses, matrix]
  )

  if (!planHasACH) {
    return (
      <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-8 text-center">
        <div className="mb-2 text-sm mono text-blue-400">ACH MATRIX</div>
        <div className="text-xs mono text-white/50">
          UPGRADE TO PRO TO ACCESS ANALYSIS OF COMPETING HYPOTHESES
        </div>
      </div>
    )
  }

  const cycleRating = (hypId: string, evId: string) => {
    const current = matrix[hypId]?.[evId] ?? 'na'
    const cycle: EvidenceRating[] = ['na', 'consistent', 'inconsistent', 'neutral']
    const nextIdx = (cycle.indexOf(current) + 1) % cycle.length
    setMatrix((prev) => ({ ...prev, [hypId]: { ...(prev[hypId] ?? {}), [evId]: cycle[nextIdx] ?? 'na' } }))
  }

  const fetchHypothesisDiff = async (hypothesisId: string) => {
    setDiffs((current) => ({ ...current, [hypothesisId]: { items: current[hypothesisId]?.items ?? [], changedIds: current[hypothesisId]?.changedIds ?? [], loading: true } }))
    const fallbackItems = evidence.filter((item) => item.hypothesisIds?.includes(hypothesisId)).sort((left, right) => new Date(right.updatedAt ?? 0).getTime() - new Date(left.updatedAt ?? 0).getTime())

    try {
      const response = await fetch('/api/v1/events?window=30d&limit=20', { cache: 'no-store' })
      const json = await response.json() as { data?: Array<{ id: string; title: string; severity?: number | null; occurred_at?: string | null }> }
      const remoteItems = (json.data ?? []).slice(0, 6).map((item) => ({
        id: item.id,
        title: item.title,
        credibility: ((item.severity ?? 3) >= 5 ? 5 : (item.severity ?? 3)) as 1 | 2 | 3 | 4 | 5,
        hypothesisIds: [hypothesisId],
        updatedAt: item.occurred_at ?? new Date().toISOString(),
      }))

      const items = remoteItems.length > 0 ? remoteItems : fallbackItems
      const lastViewedAt = typeof window === 'undefined' ? null : window.localStorage.getItem(storageKey(hypothesisId))
      const changedIds = items.filter((item) => !lastViewedAt || new Date(item.updatedAt ?? 0).getTime() > new Date(lastViewedAt).getTime()).map((item) => item.id)

      if (typeof window !== 'undefined') window.localStorage.setItem(storageKey(hypothesisId), new Date().toISOString())
      setDiffs((current) => ({ ...current, [hypothesisId]: { items, changedIds, loading: false } }))
    } catch {
      const lastViewedAt = typeof window === 'undefined' ? null : window.localStorage.getItem(storageKey(hypothesisId))
      const changedIds = fallbackItems.filter((item) => !lastViewedAt || new Date(item.updatedAt ?? 0).getTime() > new Date(lastViewedAt).getTime()).map((item) => item.id)
      if (typeof window !== 'undefined') window.localStorage.setItem(storageKey(hypothesisId), new Date().toISOString())
      setDiffs((current) => ({ ...current, [hypothesisId]: { items: fallbackItems, changedIds, loading: false } }))
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.015]">
      <div className="border-b border-white/[0.05] px-4 py-3">
        <div className="text-xs mono tracking-widest text-white/50">ANALYSIS OF COMPETING HYPOTHESES (ACH)</div>
        <div className="mt-1 text-xs text-white/50">CLICK CELLS TO CYCLE: — → C (consistent) → I (inconsistent) → N (neutral)</div>
      </div>

      <div className="p-4 overflow-x-auto">
        <table className="w-full text-xs mono" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="p-2 text-left text-white/50" style={{ minWidth: '360px' }}>HYPOTHESIS</th>
              {evidence.map((ev) => (
                <th key={ev.id} className="p-2 text-center text-white/50" style={{ minWidth: '80px' }}>
                  <div className="max-w-20 truncate text-xs">{ev.title.substring(0, 20)}</div>
                  <div className="text-blue-400">CR:{ev.credibility}</div>
                </th>
              ))}
              <th className="p-2 text-center text-white/50">INCON. SCORE</th>
              <th className="p-2 text-center text-white/50">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {rankedHypotheses.map((hyp, idx) => {
              const inconsistencyScore = computeInconsistencyScore(hyp, evidence, matrix)
              const diff = diffs[hyp.id]
              const healthBadge = deriveHealthBadge(hyp)
              return (
                <tr key={hyp.id} className="border-t border-white/[0.05]">
                  <td className="align-top p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-white">{hyp.title}</div>
                        <div className="truncate text-xs text-white/50">{hyp.description}</div>
                      </div>
                      <span className="rounded-full px-2 py-1 text-[10px]" style={{ color: badgeColor(healthBadge), background: `${badgeColor(healthBadge)}22` }}>{healthBadge}</span>
                    </div>
                    {idx === 0 && <div className="mt-1 text-xs text-blue-400">★ MOST LIKELY</div>}
                    <div className="mt-3 rounded-lg border border-white/[0.05] bg-white/[0.025] p-2">
                      <div className="mb-2 text-[11px] text-white/50">Probability history</div>
                      <div style={{ width: '100%', height: 120 }}>
                        <ResponsiveContainerChart>
                          <LineChartComponent data={hyp.probability_history.map((point) => ({ label: new Date(point.at).toLocaleDateString(), probability: Math.round(point.probability * 100) }))}>
                            <XAxisComponent dataKey="label" hide />
                            <YAxisComponent hide domain={[0, 100]} />
                            <TooltipComponent />
                            <LineComponent type="monotone" dataKey="probability" stroke="#60A5FA" strokeWidth={2} dot={false} />
                          </LineChartComponent>
                        </ResponsiveContainerChart>
                      </div>
                      <div className="mt-2 text-[11px] text-white">Current: {Math.round(hyp.probability * 100)}%</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {hyp.key_indicators.map((indicator) => (
                        <span key={indicator.label} className="rounded-full px-2 py-1 text-[10px]" style={{ border: `1px solid ${indicatorColor(indicator.health)}`, color: indicatorColor(indicator.health) }}>
                          {indicator.label}
                        </span>
                      ))}
                    </div>
                    <button onClick={() => void fetchHypothesisDiff(hyp.id)} className="mt-2 rounded-lg border border-white/[0.05] px-2 py-1 text-[11px] text-white">
                      {diff?.loading ? 'Checking…' : 'What changed?'}
                    </button>
                    {diff && !diff.loading && (
                      <div className="mt-2 space-y-1 rounded-lg border border-white/[0.05] bg-white/[0.025] p-2 text-[11px]">
                        <div className="text-white/50">{diff.changedIds.length === 0 ? 'No new linked evidence since last view.' : `${diff.changedIds.length} new/updated evidence item(s)`}</div>
                        {diff.items.slice(0, 3).map((item) => {
                          const changed = diff.changedIds.includes(item.id)
                          return (
                            <div key={item.id} className="rounded px-2 py-1" style={{ background: changed ? 'rgba(234,179,8,0.12)' : 'transparent', color: changed ? '#EAB308' : 'text-white' }}>
                              • {item.title}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </td>
                  {evidence.map((ev) => {
                    const rating = matrix[hyp.id]?.[ev.id] ?? 'na'
                    const style = RATING_STYLES[rating]
                    return (
                      <td key={ev.id} className="cursor-pointer p-2 text-center" onClick={() => cycleRating(hyp.id, ev.id)}>
                        <span className="inline-block h-6 w-6 rounded border text-center font-bold leading-6" style={{ color: style.color, borderColor: style.color, backgroundColor: `${style.color}15` }}>{style.label}</span>
                      </td>
                    )
                  })}
                  <td className="p-2 text-center">
                    <span className="text-sm font-bold" style={{ color: inconsistencyScore > 5 ? '#EF4444' : inconsistencyScore > 2 ? '#F59E0B' : '#22C55E' }}>{inconsistencyScore}</span>
                  </td>
                  <td className="p-2 text-center">
                    <span className="rounded-lg px-2 py-1 text-xs" style={{ color: STATUS_COLORS[hyp.status], border: `1px solid ${STATUS_COLORS[hyp.status]}` }}>{hyp.status.toUpperCase()}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="mt-4 flex gap-2">
          <input type="text" value={newHypothesis} onChange={(e) => setNewHypothesis(e.target.value)} placeholder="ADD HYPOTHESIS..." className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs mono text-white placeholder:text-white/20" />
          <button
            onClick={() => {
              if (!newHypothesis.trim()) return
              const now = new Date().toISOString()
              setHypotheses((prev) => [...prev, { id: String(Date.now()), title: newHypothesis, description: '', status: 'active', probability: 0.5, lastEvidenceAt: now, probability_history: [{ at: now, probability: 0.5 }], key_indicators: [] }])
              setNewHypothesis('')
            }}
            className="rounded-lg border border-blue-500 px-4 py-2 text-xs mono text-white hover:bg-blue-600"
            style={{ backgroundColor: '#3B82F6' }}
          >
            + ADD
          </button>
        </div>
      </div>
    </div>
  )
}
