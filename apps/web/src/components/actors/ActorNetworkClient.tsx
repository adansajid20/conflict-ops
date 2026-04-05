'use client'

import { useEffect, useRef, useState } from 'react'

type Actor = { id: string; name: string; actor_type: string; region: string | null; threat_level: string | null; description: string | null }
type Relationship = { actor_id: string; related_actor_id: string; relationship_type: string; strength: number }

const S = { background: '#080c12', card: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', text: '#e2e8f0', muted: '#64748b' }
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
    <div style={{ minHeight: '100vh', background: S.background, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: S.muted, fontSize: 14 }}>Loading actor network…</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: S.background, padding: '28px', fontFamily: '-apple-system,sans-serif' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: S.text, margin: 0 }}>Actor Network</h1>
        <div style={{ fontSize: 13, color: S.muted, marginTop: 4 }}>{actors.length} actors · {rels.length} relationships</div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
            <span style={{ fontSize: 11, color: S.muted, textTransform: 'capitalize' }}>{type.replace('_', ' ')}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 280px' : '1fr', gap: 16 }}>
        {/* Graph */}
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
          {actors.length === 0 ? (
            <div style={{ padding: '80px 0', textAlign: 'center', color: S.muted, fontSize: 14 }}>
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
          <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: S.text }}>{selected.name}</div>
                <div style={{ fontSize: 11, color: TYPE_COLORS[selected.actor_type] ?? '#64748b', marginTop: 3, textTransform: 'uppercase' }}>{selected.actor_type.replace('_', ' ')}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            {selected.region && <div style={{ fontSize: 12, color: S.muted, marginBottom: 10 }}>📍 {selected.region}</div>}
            {selected.threat_level && (
              <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 4, background: (THREAT_COLORS[selected.threat_level] ?? '#64748b') + '20', color: THREAT_COLORS[selected.threat_level] ?? '#64748b', marginBottom: 12, textTransform: 'uppercase' }}>
                Threat: {selected.threat_level}
              </div>
            )}
            {selected.description && <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>{selected.description}</div>}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, color: S.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Relationships</div>
              {rels.filter(r => r.actor_id === selected.id || r.related_actor_id === selected.id).slice(0, 8).map((rel, i) => {
                const otherId = rel.actor_id === selected.id ? rel.related_actor_id : rel.actor_id
                const other = actors.find(a => a.id === otherId)
                const relColors: Record<string, string> = { allied: '#22c55e', enemy: '#ef4444', neutral: '#475569', proxy: '#f97316', sponsor: '#a78bfa' }
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}
                    onClick={() => other && setSelected(other)}>
                    <span style={{ color: relColors[rel.relationship_type] ?? '#64748b' }}>→</span>
                    <span>{other?.name ?? otherId.slice(0, 8)}</span>
                    <span style={{ color: S.muted, marginLeft: 'auto' }}>{rel.relationship_type}</span>
                  </div>
                )
              })}
              {rels.filter(r => r.actor_id === selected.id || r.related_actor_id === selected.id).length === 0 && (
                <div style={{ fontSize: 12, color: S.muted }}>No relationships mapped yet</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
