'use client'

import { useEffect, useState } from 'react'

type Prediction = {
  id: string; prediction_type: string; title: string; description: string
  region: string; probability: number; time_horizon_hours: number
  severity_if_true: string; evidence: Record<string, unknown>
  outcome: string | null; created_at: string; expires_at: string
}

type PredMeta = { total: number; accuracy_30d: number | null; confirmed_30d: number; total_evaluated_30d: number }

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
    <div className={`bg-white/[0.015] border rounded-xl overflow-hidden transition-all hover:bg-white/[0.03] ${expanded ? 'border-white/[0.15]' : 'border-white/[0.05]'}`} style={{ borderColor: expanded ? color + '40' : undefined }}>
      <div onClick={onToggle} className="p-4 cursor-pointer flex gap-4 items-start">
        <ProbabilityRing prob={pred.probability} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-[0.05em] px-2 py-1 rounded" style={{ color, background: color + '20' }}>
              {icon} {pred.prediction_type}
            </span>
            <span className="text-[10px] px-2 py-1 rounded uppercase" style={{ color: sevColor, background: sevColor + '15' }}>
              if true: {pred.severity_if_true}
            </span>
            <span className="text-[10px] text-white/50">⏱ {hoursLeft}h window</span>
          </div>
          <div className="text-sm font-semibold text-white leading-tight mb-1">{pred.title}</div>
          <div className="text-xs text-white/50">{pred.region.replace(/_/g, ' ')}</div>
        </div>
        <div className="text-base text-white/50 flex-shrink-0">{expanded ? '▲' : '▼'}</div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 border-t border-white/[0.05]">
          <div className="pt-4 text-xs text-white/70 leading-relaxed whitespace-pre-wrap">
            {pred.description}
          </div>
          {indicators.length > 0 && (
            <div className="mt-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25 mb-2">Watch For</div>
              <div className="flex flex-col gap-1.5">
                {indicators.map((ind, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-white/70">
                    <span className="flex-shrink-0" style={{ color }}>→</span>
                    <span>{ind}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-3 text-[10px] text-white/50">
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
    <div className="min-h-screen bg-[#070B11] flex items-center justify-center">
      <div className="text-white/50 text-sm">Loading predictions…</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#070B11] px-7 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white m-0">Prediction Engine</h1>
        <div className="text-sm text-white/50 mt-1">
          {predictions.length} active predictions
          {meta?.accuracy_30d != null && <span className="ml-3 text-purple-400">30d accuracy: {meta.accuracy_30d}%</span>}
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Active', value: predictions.length, color: 'text-orange-400' },
          { label: 'High Probability (>65%)', value: predictions.filter(p => p.probability > 0.65).length, color: 'text-red-400' },
          { label: 'Confirmed (30d)', value: meta?.confirmed_30d ?? 0, color: 'text-blue-400' },
          { label: 'Accuracy (30d)', value: meta?.accuracy_30d != null ? `${meta.accuracy_30d}%` : '—', color: 'text-purple-400' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white/[0.015] border border-white/[0.05] rounded-xl p-4 hover:bg-white/[0.03] transition-colors">
            <div className="text-[10px] uppercase tracking-[0.15em] text-white/25 mb-2">{kpi.label}</div>
            <div className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Type filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {types.map(t => {
          const color = TYPE_COLORS[t] ?? '#3b82f6'
          const active = filter === t
          return (
            <button key={t} onClick={() => setFilter(t)} className={`px-4 py-1.5 rounded-full text-xs cursor-pointer transition-all ${active ? 'border' : 'border'}`} style={{
              background: active ? color + '20' : 'transparent',
              borderColor: active ? color : 'rgba(255,255,255,0.05)',
              color: active ? color : 'rgba(255,255,255,0.5)',
              textTransform: 'capitalize',
            }}>
              {TYPE_ICONS[t] ? `${TYPE_ICONS[t]} ` : ''}{t}
            </button>
          )
        })}
      </div>

      {/* Prediction list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-white/50 text-sm">
          No active predictions yet. The engine runs hourly once data flows in.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map(pred => (
            <PredCard key={pred.id} pred={pred} expanded={expanded === pred.id} onToggle={() => setExpanded(expanded === pred.id ? null : pred.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
