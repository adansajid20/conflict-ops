'use client'

import { useEffect, useRef, useState } from 'react'

type Actor = { id: string; name: string; actor_type: string; region: string | null; threat_level: string | null; description: string | null }
type Relationship = { actor_id: string; related_actor_id: string; relationship_type: string; strength: number }

const TYPE_COLORS: Record<string, string> = { state: '#3b82f6', non_state: '#ef4444', terrorist: '#dc2626', militia: '#f97316', political: '#a78bfa', international: '#22c55e', criminal: '#ec4899' }
const THREAT_COLORS: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', unknown: '#64748b' }

interface NodePos { id: string; x: number; y: number; vx: number; vy: number; actor: Actor }

function useForceLayout(actors: Actor[], relationships: Relationship[], w: number, h: number) {
  const [positions, setPositions] = useState<Map<string, NodePos>>(new Map())

  useEffect(() => {
    if (!actors.length) return
    const nodes = new Map<string, NodePos>()
    actors.forEach((a, i) => {
      const angle = (i / actors.length) * 2 * Math.PI
      const r = Math.min(w, h) * 0.3
      nodes.set(a.id, { id: a.id, x: w/2 + r * Math.cos(angle), y: h/2 + r * Math.sin(angle), vx: 0, vy: 0, actor: a })
    })

    let frame = 0
    const tick = () => {
      if (frame++ > 200) { setPositions(new Map(nodes)); return }
      // Repulsion
      for (const [, n1] of nodes) {
        for (const [, n2] of nodes) {
          if (n1.id === n2.id) continue
          const dx = n1.x - n2.x, dy = n1.y - n2.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = 3000 / (dist * dist)
          n1.vx += (dx / dist) * force
          n1.vy += (dy / dist) * force
        }
      }
      // Attraction along edges
      for (const rel of relationships) {
        const n1 = nodes.get(rel.actor_id), n2 = nodes.get(rel.related_actor_id)
        if (!n1 || !n2) continue
        const dx = n2.x - n1.x, dy = n2.y - n1.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const target = 120, force = (dist - target) * 0.02 * rel.strength
        n1.vx += (dx / dist) * force; n1.vy += (dy / dist) * force
        n2.vx -= (dx / dist) * force; n2.vy -= (dy / dist) * force
      }
      // Center gravity
      for (const [, n] of nodes) {
        n.vx += (w / 2 - n.x) * 0.002
        n.vy += (h / 2 - n.y) * 0.002
        n.vx *= 0.85; n.vy *= 0.85
        n.x = Math.max(40, Math.min(w - 40, n.x + n.vx))
        n.y = Math.max(40, Math.min(h - 40, n.y + n.vy))
      }
      setPositions(new Map(nodes))
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [actors, relationships, w, h])

  return positions
}

export function ActorNetworkClient() {
  const [actors, setActors] = useState<Actor[]>([])
  const [rels, setRels] = useState<Relationship[]>([])
  const [selected, setSelected] = useState<Actor | null>(null)
  const [loading, setLoading] = useState(true)
  const svgRef = useRef<SVGSVGElement>(null)
  const W = 800, H = 560

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/actors?limit=40').then(r => r.json()),
    ]).then(([actorsData]) => {
      const ad = actorsData as { actors?: Actor[] }
      setActors(ad.actors ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))

    // Fetch relationships
    fetch('/api/v1/actors/relationships?limit=80')
      .then(r => r.json())
      .then(d => { const dd = d as { relationships?: Relationship[] }; setRels(dd.relationships ?? []) })
      .catch(() => {})
  }, [])

  const positions = useForceLayout(actors, rels, W, H)

  if (loading) return (
    <div className="min-h-screen bg-[#070B11] flex items-center justify-center">
      <div className="text-white/50 text-sm">Loading actor network…</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#070B11] p-7">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-white m-0">Actor Network</h1>
        <div className="text-sm text-white/50 mt-1">{actors.length} actors · {rels.length} relationships</div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 flex-wrap">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-xs text-white/50 capitalize">{type.replace('_', ' ')}</span>
          </div>
        ))}
      </div>

      <div className={selected ? 'grid grid-cols-[1fr_280px] gap-4' : 'grid grid-cols-1'}>
        {/* Graph */}
        <div className="bg-white/[0.015] border border-white/[0.05] rounded-xl overflow-hidden relative hover:bg-white/[0.03] transition-colors">
          {actors.length === 0 ? (
            <div className="py-20 text-center text-white/50 text-sm">
              No actors tracked yet. They populate automatically as events are processed.
            </div>
          ) : (
            <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
              {/* Edges */}
              {rels.map((rel, i) => {
                const n1 = positions.get(rel.actor_id), n2 = positions.get(rel.related_actor_id)
                if (!n1 || !n2) return null
                const relColors: Record<string, string> = { allied: '#22c55e', enemy: '#ef4444', neutral: '#475569', proxy: '#f97316', sponsor: '#a78bfa', covert: '#0ea5e9' }
                const color = relColors[rel.relationship_type] ?? '#475569'
                return <line key={i} x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} stroke={color} strokeOpacity={0.35 + rel.strength * 0.3} strokeWidth={rel.strength * 2} />
              })}
              {/* Nodes */}
              {actors.map(actor => {
                const pos = positions.get(actor.id)
                if (!pos) return null
                const color = TYPE_COLORS[actor.actor_type] ?? '#64748b'
                const threatColor = THREAT_COLORS[actor.threat_level ?? 'unknown'] ?? '#64748b'
                const r = actor.actor_type === 'state' ? 16 : 12
                const isSelected = selected?.id === actor.id
                return (
                  <g key={actor.id} onClick={() => setSelected(isSelected ? null : actor)} style={{ cursor: 'pointer' }}>
                    {isSelected && <circle cx={pos.x} cy={pos.y} r={r + 8} fill="none" stroke={color} strokeWidth={2} strokeOpacity={0.5} />}
                    <circle cx={pos.x} cy={pos.y} r={r} fill={color} fillOpacity={0.85} stroke={threatColor} strokeWidth={2} />
                    <text x={pos.x} y={pos.y + r + 12} textAnchor="middle" fill="#94a3b8" fontSize={9} fontFamily="-apple-system,sans-serif">
                      {actor.name.length > 14 ? actor.name.slice(0, 14) + '…' : actor.name}
                    </text>
                  </g>
                )
              })}
            </svg>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="bg-white/[0.015] border border-white/[0.05] rounded-xl p-5 hover:bg-white/[0.03] transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-base font-bold text-white">{selected.name}</div>
                <div className="text-xs uppercase mt-0.5" style={{ color: TYPE_COLORS[selected.actor_type] ?? '#64748b' }}>{selected.actor_type.replace('_', ' ')}</div>
              </div>
              <button onClick={() => setSelected(null)} className="bg-none border-none text-white/50 cursor-pointer text-base hover:text-white/70">✕</button>
            </div>
            {selected.region && <div className="text-xs text-white/50 mb-2.5">📍 {selected.region}</div>}
            {selected.threat_level && (
              <div className="inline-block text-xs font-semibold px-2.5 py-1 rounded mb-3 uppercase" style={{ background: (THREAT_COLORS[selected.threat_level] ?? '#64748b') + '20', color: THREAT_COLORS[selected.threat_level] ?? '#64748b' }}>
                Threat: {selected.threat_level}
              </div>
            )}
            {selected.description && <div className="text-xs text-white/70 leading-relaxed">{selected.description}</div>}
            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-[0.15em] text-white/25 mb-2">Relationships</div>
              {rels.filter(r => r.actor_id === selected.id || r.related_actor_id === selected.id).slice(0, 8).map((rel, i) => {
                const otherId = rel.actor_id === selected.id ? rel.related_actor_id : rel.actor_id
                const other = actors.find(a => a.id === otherId)
                const relColors: Record<string, string> = { allied: '#22c55e', enemy: '#ef4444', neutral: '#475569', proxy: '#f97316', sponsor: '#a78bfa' }
                return (
                  <div key={i} className="flex items-center gap-2 mb-1.5 text-xs text-white/70 cursor-pointer hover:text-white/90"
                    onClick={() => other && setSelected(other)}>
                    <span style={{ color: relColors[rel.relationship_type] ?? '#64748b' }}>→</span>
                    <span>{other?.name ?? otherId.slice(0, 8)}</span>
                    <span className="text-white/50 ml-auto">{rel.relationship_type}</span>
                  </div>
                )
              })}
              {rels.filter(r => r.actor_id === selected.id || r.related_actor_id === selected.id).length === 0 && (
                <div className="text-xs text-white/50">No relationships mapped yet</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
