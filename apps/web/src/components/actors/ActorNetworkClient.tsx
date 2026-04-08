'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Maximize2, X, AlertTriangle } from 'lucide-react'

type Actor = { id: string; name: string; actor_type: string; region: string | null; threat_level: string | null; description: string | null }
type Relationship = { actor_id: string; related_actor_id: string; relationship_type: string; strength: number }

const TYPE_COLORS: Record<string, string> = { state: '#3b82f6', non_state: '#ef4444', terrorist: '#dc2626', militia: '#f97316', political: '#a78bfa', international: '#22c55e', criminal: '#ec4899' }
const THREAT_COLORS: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', unknown: '#64748b' }
const REL_COLORS: Record<string, string> = { allied: '#22c55e', enemy: '#ef4444', neutral: '#475569', proxy: '#f97316', sponsor: '#a78bfa', covert: '#0ea5e9' }

const SPRING_SNAPPY = { stiffness: 400, damping: 30 }

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
  const W = 1000, H = 600

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
      <motion.div
        className="text-white/50 text-sm"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        Mapping actor relationships…
      </motion.div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#070B11] px-8 py-10">
      {/* Header */}
      <motion.div
        className="mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-white mb-2">Actor Network</h1>
        <p className="text-sm text-white/40">
          {actors.length} entities · {rels.length} connections mapped
        </p>
      </motion.div>

      {/* Legend */}
      <motion.div
        className="mb-6 p-4 rounded-lg"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="text-xs font-semibold text-white/50 mb-3 uppercase tracking-wider">Entity Types</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3">
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <motion.div
              key={type}
              className="flex items-center gap-2"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <motion.div
                className="w-3 h-3 rounded-full"
                style={{ background: color }}
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity, delay: Math.random() * 0.5 }}
              />
              <span className="text-xs text-white/50 capitalize whitespace-nowrap">{type.replace('_', ' ')}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <div className={`grid gap-4 transition-all ${selected ? 'grid-cols-[1fr_340px]' : 'grid-cols-1'}`}>
        {/* Network visualization */}
        <motion.div
          className="relative overflow-hidden rounded-2xl border"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
            borderColor: 'rgba(255,255,255,0.06)',
            aspectRatio: actors.length === 0 ? 'auto' : 'auto',
            minHeight: '600px',
          }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring' as const, ...SPRING_SNAPPY }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

          {actors.length === 0 ? (
            <div className="h-full flex items-center justify-center flex-col gap-3">
              <AlertTriangle className="w-12 h-12 text-white/20" />
              <p className="text-white/40 text-sm">No actors to visualize yet.</p>
            </div>
          ) : (
            <svg ref={svgRef} width="100%" height="600" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
              {/* Edges with gradient */}
              <defs>
                {rels.map((rel, i) => {
                  const color = REL_COLORS[rel.relationship_type] ?? '#475569'
                  return (
                    <linearGradient key={`grad-${i}`} id={`grad-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.5} />
                    </linearGradient>
                  )
                })}
              </defs>

              {/* Edges */}
              {rels.map((rel, i) => {
                const n1 = positions.get(rel.actor_id), n2 = positions.get(rel.related_actor_id)
                if (!n1 || !n2) return null
                const color = REL_COLORS[rel.relationship_type] ?? '#475569'
                return (
                  <motion.line
                    key={i}
                    x1={n1.x}
                    y1={n1.y}
                    x2={n2.x}
                    y2={n2.y}
                    stroke={color}
                    strokeOpacity={0.4 + rel.strength * 0.2}
                    strokeWidth={Math.max(1, rel.strength * 1.5)}
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.5, delay: i * 0.01 }}
                  />
                )
              })}

              {/* Nodes */}
              {actors.map(actor => {
                const pos = positions.get(actor.id)
                if (!pos) return null
                const color = TYPE_COLORS[actor.actor_type] ?? '#64748b'
                const threatColor = THREAT_COLORS[actor.threat_level ?? 'unknown'] ?? '#64748b'
                const r = actor.actor_type === 'state' ? 18 : 14
                const isSelected = selected?.id === actor.id

                return (
                  <g
                    key={actor.id}
                    onClick={() => setSelected(isSelected ? null : actor)}
                    style={{ cursor: 'pointer' }}
                    opacity={isSelected || !selected ? 1 : 0.4}
                  >
                    {/* Glow for selected */}
                    {isSelected && (
                      <motion.circle
                        cx={pos.x}
                        cy={pos.y}
                        r={r + 12}
                        fill="none"
                        stroke={color}
                        strokeWidth={2}
                        strokeOpacity={0.3}
                        animate={{ r: [r + 12, r + 16, r + 12] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    )}

                    {/* Main circle */}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={r}
                      fill={color}
                      fillOpacity={isSelected ? 1 : 0.8}
                      stroke={threatColor}
                      strokeWidth={2.5}
                    />

                    {/* Label */}
                    <text
                      x={pos.x}
                      y={pos.y + r + 16}
                      textAnchor="middle"
                      fill={isSelected ? '#fff' : '#94a3b8'}
                      fontSize={isSelected ? 11 : 9}
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight={isSelected ? 'bold' : 'normal'}
                    >
                      {actor.name.length > 14 ? actor.name.slice(0, 12) + '…' : actor.name}
                    </text>
                  </g>
                )
              })}
            </svg>
          )}
        </motion.div>

        {/* Detail panel */}
        <AnimatePresence>
          {selected && (
            <motion.div
              layoutId="detail-panel"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="rounded-2xl border overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
                borderColor: 'rgba(255,255,255,0.06)',
              }}
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

              <div className="p-6 space-y-4">
                {/* Header */}
                <div className="flex justify-between items-start">
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <h3 className="text-lg font-bold text-white">{selected.name}</h3>
                    <motion.div
                      className="text-xs uppercase mt-2 px-2.5 py-1 rounded w-fit font-semibold"
                      style={{
                        color: TYPE_COLORS[selected.actor_type] ?? '#64748b',
                        background: (TYPE_COLORS[selected.actor_type] ?? '#64748b') + '15',
                        border: `1px solid ${(TYPE_COLORS[selected.actor_type] ?? '#64748b')}30`,
                      }}
                    >
                      {selected.actor_type.replace('_', ' ')}
                    </motion.div>
                  </motion.div>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-white/40 hover:text-white/70 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Info */}
                <motion.div
                  className="space-y-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  {selected.region && (
                    <div className="text-xs text-white/50">
                      📍 <span className="text-white/70">{selected.region}</span>
                    </div>
                  )}
                  {selected.threat_level && (
                    <div>
                      <div className="text-xs font-semibold text-white/40 mb-1">Threat Level</div>
                      <motion.div
                        className="text-xs font-bold uppercase px-2.5 py-1 rounded w-fit"
                        style={{
                          background: (THREAT_COLORS[selected.threat_level] ?? '#64748b') + '15',
                          color: THREAT_COLORS[selected.threat_level] ?? '#64748b',
                          border: `1px solid ${(THREAT_COLORS[selected.threat_level] ?? '#64748b')}30`,
                        }}
                      >
                        {selected.threat_level}
                      </motion.div>
                    </div>
                  )}
                  {selected.description && (
                    <div>
                      <div className="text-xs font-semibold text-white/40 mb-2">Description</div>
                      <p className="text-xs text-white/60 leading-relaxed">{selected.description}</p>
                    </div>
                  )}
                </motion.div>

                {/* Relationships */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="pt-3 border-t border-white/[0.05]"
                >
                  <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25 mb-3">Connections</div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {rels
                      .filter(r => r.actor_id === selected.id || r.related_actor_id === selected.id)
                      .slice(0, 10)
                      .map((rel, i) => {
                        const otherId = rel.actor_id === selected.id ? rel.related_actor_id : rel.actor_id
                        const other = actors.find(a => a.id === otherId)
                        const relColor = REL_COLORS[rel.relationship_type] ?? '#64748b'
                        return (
                          <motion.button
                            key={i}
                            onClick={() => other && setSelected(other)}
                            className="w-full text-left text-xs p-2 rounded hover:bg-white/[0.05] transition-colors flex items-center gap-2"
                            whileHover={{ x: 4 }}
                          >
                            <span style={{ color: relColor }} className="flex-shrink-0">→</span>
                            <span className="text-white/70 truncate flex-1">{other?.name ?? otherId.slice(0, 8)}</span>
                            <span
                              className="text-[9px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                              style={{ background: relColor + '15', color: relColor }}
                            >
                              {rel.relationship_type.replace('_', ' ')}
                            </span>
                          </motion.button>
                        )
                      })}
                    {rels.filter(r => r.actor_id === selected.id || r.related_actor_id === selected.id).length === 0 && (
                      <p className="text-xs text-white/40">No direct relationships</p>
                    )}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
