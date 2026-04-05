'use client'

import { useEffect, useState } from 'react'

type Prediction = {
  id: string; prediction_type: string; title: string; description: string
  region: string; probability: number; time_horizon_hours: number
  severity_if_true: string; evidence: Record<string, unknown>
  outcome: string | null; created_at: string; expires_at: string
}

type PredMeta = { total: number; accuracy_30d: number | null; confirmed_30d: number; total_evaluated_30d: number }

const S = { background: '#080c12', card: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', text: '#e2e8f0', muted: '#64748b', accent: '#3b82f6' }
const TYPE_COLORS: Record<string, string> = { escalation: '#ef4444', attack: '#f97316', diplomatic: '#3b82f6', humanitarian: '#a78bfa', economic: '#22c55e' }
const TYPE_ICONS: Record<string, string> = { escalation: '⚡', attack: '💥', diplomatic: '🤝', humanitarian: '🏥', economic: '📊' }
const SEV_COLORS: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' }

function ProbabilityRing({ prob }: { prob: number }) {
  const r = 22, circ = 2 * Math.PI * r
  const pct = Math.round(prob * 100)
  const color = pct >= 70 ? '#ef4444' : pct >= 50 ? '#f97316' : pct >= 30 ? '#eab308' : '#22c55e'
  return (
    <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
      <svg width={56} height={56} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={28} cy={28} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4} />
        <circle cx={28} cy={28} r={r} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round"
          strokeDasharray={`${circ * prob} ${circ}`} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color, lineHeight: 1 }}>{pct}%</span>
      </div>
    </div>
  )
}

function PredCard({ pred, expanded, onToggle }: { pred: Prediction; expanded: boolean; onToggle: () => void }) {
  const color = TYPE_COLORS[pred.prediction_type] ?? '#64748b'
  const icon = TYPE_ICONS[pred.prediction_type] ?? '🔮'
  const sevColor = SEV_COLORS[pred.severity_if_true] ?? '#64748b'
  const hoursLeft = Math.max(0, Math.round((new Date(pred.expires_at).getTime() - Date.now()) / 3600000))
  const indicators = (pred.evidence?.key_indicators as string[]) ?? []

  return (
    <div style={{ background: S.card, border: `1px solid ${expanded ? color + '40' : S.border}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.2s' }}>
      <div onClick={onToggle} style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <ProbabilityRing prob={pred.probability} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color, background: color + '20', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {icon} {pred.prediction_type}
            </span>
            <span style={{ fontSize: 10, color: sevColor, background: sevColor + '15', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>
              if true: {pred.severity_if_true}
            </span>
            <span style={{ fontSize: 10, color: S.muted }}>⏱ {hoursLeft}h window</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: S.text, lineHeight: 1.3, marginBottom: 4 }}>{pred.title}</div>
          <div style={{ fontSize: 12, color: S.muted }}>{pred.region.replace(/_/g, ' ')}</div>
        </div>
        <div style={{ fontSize: 18, color: S.muted, flexShrink: 0 }}>{expanded ? '▲' : '▼'}</div>
      </div>

      {expanded && (
        <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${S.border}` }}>
          <div style={{ paddingTop: 16, fontSize: 13, color: '#94a3b8', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {pred.description}
          </div>
          {indicators.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: S.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Watch For</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {indicators.map((ind, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#94a3b8' }}>
                    <span style={{ color: color, flexShrink: 0 }}>→</span>
                    <span>{ind}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ marginTop: 12, fontSize: 11, color: S.muted }}>
            Generated {new Date(pred.created_at).toLocaleString()} · Expires {new Date(pred.expires_at).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  )
}

export function PredictionsClient() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [meta, setMeta] = useState<PredMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    fetch('/api/v1/predictions?limit=30')
      .then(r => r.json())
      .then(d => {
        const dd = d as { predictions: Prediction[]; meta: PredMeta }
        setPredictions(dd.predictions ?? [])
        setMeta(dd.meta ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? predictions : predictions.filter(p => p.prediction_type === filter)
  const types = ['all', 'escalation', 'attack', 'diplomatic', 'humanitarian', 'economic']

  if (loading) return (
    <div style={{ minHeight: '100vh', background: S.background, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: S.muted, fontSize: 14 }}>Loading predictions…</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: S.background, padding: '32px 28px', fontFamily: '-apple-system,sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: S.text, margin: 0 }}>Prediction Engine</h1>
        <div style={{ fontSize: 13, color: S.muted, marginTop: 4 }}>
          {predictions.length} active predictions
          {meta?.accuracy_30d != null && <span style={{ marginLeft: 12, color: '#a78bfa' }}>30d accuracy: {meta.accuracy_30d}%</span>}
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Active', value: predictions.length, color: '#f97316' },
          { label: 'High Probability (>65%)', value: predictions.filter(p => p.probability > 0.65).length, color: '#ef4444' },
          { label: 'Confirmed (30d)', value: meta?.confirmed_30d ?? 0, color: '#22c55e' },
          { label: 'Accuracy (30d)', value: meta?.accuracy_30d != null ? `${meta.accuracy_30d}%` : '—', color: '#a78bfa' },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{kpi.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Type filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {types.map(t => {
          const color = TYPE_COLORS[t] ?? S.accent
          const active = filter === t
          return (
            <button key={t} onClick={() => setFilter(t)} style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 12,
              border: `1px solid ${active ? color : S.border}`,
              background: active ? color + '20' : 'transparent',
              color: active ? color : S.muted, cursor: 'pointer',
              textTransform: 'capitalize',
            }}>
              {TYPE_ICONS[t] ? `${TYPE_ICONS[t]} ` : ''}{t}
            </button>
          )
        })}
      </div>

      {/* Prediction list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: S.muted, fontSize: 14 }}>
          No active predictions yet. The engine runs hourly once data flows in.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(pred => (
            <PredCard key={pred.id} pred={pred} expanded={expanded === pred.id} onToggle={() => setExpanded(expanded === pred.id ? null : pred.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
