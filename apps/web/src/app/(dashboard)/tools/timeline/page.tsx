'use client'

import { useState, useCallback } from 'react'
import { Clock, Star, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

type TimelineEntry = {
  timestamp: string
  event_id?: string
  title: string
  severity: string
  description?: string
  is_turning_point?: boolean
}
type TurningPoint = { timestamp: string; description: string; significance: string }
type Cluster = { id: string; canonical_title: string; event_count: number; location?: string; country_code?: string }
type TimelineResult = {
  title?: string
  entries?: TimelineEntry[]
  turning_points?: TurningPoint[]
  ai_narrative?: string
  id?: string
  error?: string
}
type ClustersData = { clusters?: Cluster[] }

const severityColor: Record<string, string> = {
  critical: 'bg-red-500 border-red-400',
  high: 'bg-orange-500 border-orange-400',
  medium: 'bg-yellow-500 border-yellow-400',
  low: 'bg-green-500 border-green-400',
}
const severityDot: Record<string, string> = {
  4: 'bg-red-500',
  3: 'bg-orange-500',
  2: 'bg-yellow-500',
  1: 'bg-green-500',
}

export default function TimelinePage() {
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [selectedCluster, setSelectedCluster] = useState<string>('')
  const [result, setResult] = useState<TimelineResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingClusters, setLoadingClusters] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  const loadClusters = useCallback(async () => {
    setLoadingClusters(true)
    try {
      const res = await fetch('/api/v1/situations?limit=30')
      const d = await res.json() as ClustersData
      setClusters(d.clusters ?? [])
    } catch { /* ignore */ }
    setLoadingClusters(false)
  }, [])

  const generate = useCallback(async () => {
    if (!selectedCluster) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/v1/tools/timeline', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cluster_id: selectedCluster }),
      })
      const data = await res.json() as TimelineResult
      setResult(data)
    } catch (e) { setResult({ error: String(e) }) }
    setLoading(false)
  }, [selectedCluster])

  const sev = (entry: TimelineEntry) => {
    const n = Number(entry.severity)
    if (!isNaN(n)) return severityDot[String(n)] ?? 'bg-gray-500'
    return severityColor[entry.severity] ?? 'bg-gray-500'
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Clock className="w-6 h-6 text-blue-400" /> Event Timeline Reconstruction
        </h1>
        <p className="text-gray-400 text-sm mt-1">AI-generated timeline of any developing situation — turning points, escalation moments, key actors</p>
      </div>

      {/* Selector */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Select a Situation</h2>
          {clusters.length === 0 && (
            <button onClick={() => void loadClusters()} disabled={loadingClusters} className="text-sm text-blue-400 hover:text-blue-300">
              {loadingClusters ? 'Loading...' : 'Load situations'}
            </button>
          )}
        </div>
        {clusters.length > 0 && (
          <select
            value={selectedCluster}
            onChange={e => setSelectedCluster(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="">-- Choose a situation --</option>
            {clusters.map(c => (
              <option key={c.id} value={c.id}>
                {c.canonical_title} {c.location ? `(${c.location})` : ''} — {c.event_count} events
              </option>
            ))}
          </select>
        )}
        {clusters.length === 0 && (
          <p className="text-sm text-gray-500">Click &quot;Load situations&quot; to fetch active situation clusters from the database.</p>
        )}
        <button
          onClick={() => void generate()}
          disabled={loading || !selectedCluster}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
          {loading ? 'Reconstructing Timeline...' : 'Generate Timeline'}
        </button>
      </div>

      {/* Result */}
      {result?.error && <div className="text-red-400 text-sm p-4 bg-red-950/20 rounded-xl border border-red-500/20">{result.error}</div>}

      {result && !result.error && (
        <div className="space-y-5">
          {result.title && <h2 className="text-xl font-bold">{result.title}</h2>}

          {/* AI Narrative */}
          {result.ai_narrative && (
            <div className="bg-blue-950/30 border border-blue-800/30 rounded-xl p-5">
              <h3 className="font-semibold mb-2 text-blue-300">Intelligence Narrative</h3>
              <p className="text-sm text-gray-300 leading-relaxed">{result.ai_narrative}</p>
            </div>
          )}

          {/* Turning points summary */}
          {result.turning_points && result.turning_points.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400" /> Turning Points ({result.turning_points.length})
              </h3>
              <div className="space-y-2">
                {result.turning_points.map((tp, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <div className="text-yellow-400 shrink-0 font-mono text-xs pt-0.5">
                      {new Date(tp.timestamp).toLocaleDateString()}
                    </div>
                    <div>
                      <div className="font-medium">{tp.description}</div>
                      {tp.significance && <div className="text-gray-400 text-xs">{tp.significance}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          {result.entries && result.entries.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-5">Event Timeline ({result.entries.length} events)</h3>
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-700" />

                <div className="space-y-1">
                  {result.entries.map((entry, i) => (
                    <div key={i}>
                      <button
                        onClick={() => setExpanded(expanded === i ? null : i)}
                        className="w-full flex items-start gap-4 text-left hover:bg-gray-800/50 p-2 rounded-lg transition-colors"
                      >
                        {/* Dot */}
                        <div className={`relative z-10 w-3 h-3 rounded-full mt-1 shrink-0 ml-2.5 ${sev(entry)} ${entry.is_turning_point ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-gray-900' : ''}`} />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {entry.is_turning_point && <Star className="w-3 h-3 text-yellow-400 shrink-0" />}
                            <span className="text-xs text-gray-500 font-mono shrink-0">
                              {new Date(entry.timestamp).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className={`text-sm ${entry.is_turning_point ? 'font-semibold text-white' : 'text-gray-300'}`}>
                            {entry.title}
                          </div>
                        </div>

                        {entry.description && (expanded === i ? <ChevronUp className="w-3 h-3 text-gray-500 shrink-0 mt-1" /> : <ChevronDown className="w-3 h-3 text-gray-500 shrink-0 mt-1" />)}
                      </button>
                      {expanded === i && entry.description && (
                        <div className="ml-10 mb-2 text-xs text-gray-400 leading-relaxed px-2">{entry.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
