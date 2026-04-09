'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Zap, MapPin, Users, TrendingUp, TrendingDown, Activity } from 'lucide-react'

/* ============================================================================ */
/*  Types                                                                      */
/* ============================================================================ */
interface Actor {
  id: string
  name: string
  actor_type: string
  threat_level: string
  event_count: number
  region: string | null
  description: string | null
}

interface Relationship {
  actor_id: string
  related_actor_id: string
  relationship_type: string
  strength: number
}

interface Faction {
  name: string
  members: string[]
  color: string
}

interface NodePos {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  actor: Actor
}

/* ============================================================================ */
/*  Constants                                                                  */
/* ============================================================================ */
const THREAT_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  unknown: '#64748b',
}

const TYPE_COLORS: Record<string, string> = {
  state: '#3b82f6',
  'non-state': '#ef4444',
  terrorist: '#dc2626',
  militia: '#f97316',
  political: '#a78bfa',
  international: '#22c55e',
  criminal: '#ec4899',
}

const FACTION_COLORS = ['#3b82f6', '#ef4444', '#f97316', '#22c55e', '#a78bfa', '#ec4899', '#06b6d4', '#eab308']

const SPRING_CONFIG = { type: 'spring' as const, stiffness: 400, damping: 30 }

const GLASS_STYLE = {
  background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
  borderColor: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(10px)',
}

/* ============================================================================ */
/*  Force Layout Hook                                                          */
/* ============================================================================ */
function useForceLayout(actors: Actor[], relationships: Relationship[], w: number, h: number) {
  const [positions, setPositions] = useState<Map<string, NodePos>>(new Map())

  useEffect(() => {
    if (!actors.length) return

    const nodes = new Map<string, NodePos>()
    actors.forEach((a, i) => {
      const angle = (i / actors.length) * 2 * Math.PI
      const r = Math.min(w, h) * 0.35
      nodes.set(a.id, {
        id: a.id,
        x: w / 2 + r * Math.cos(angle),
        y: h / 2 + r * Math.sin(angle),
        vx: 0,
        vy: 0,
        actor: a,
      })
    })

    let frame = 0
    const animate = () => {
      if (frame++ > 100) {
        setPositions(new Map(nodes))
        return
      }

      // Repulsion between all nodes
      for (const [, n1] of nodes) {
        for (const [, n2] of nodes) {
          if (n1.id === n2.id) continue
          const dx = n1.x - n2.x
          const dy = n1.y - n2.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = 4000 / (dist * dist)
          n1.vx += (dx / dist) * force
          n1.vy += (dy / dist) * force
        }
      }

      // Attraction along edges
      for (const rel of relationships) {
        const n1 = nodes.get(rel.actor_id)
        const n2 = nodes.get(rel.related_actor_id)
        if (!n1 || !n2) continue
        const dx = n2.x - n1.x
        const dy = n2.y - n1.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const target = 150
        const force = (dist - target) * 0.015 * rel.strength
        n1.vx += (dx / dist) * force
        n1.vy += (dy / dist) * force
        n2.vx -= (dx / dist) * force
        n2.vy -= (dy / dist) * force
      }

      // Center gravity
      for (const [, n] of nodes) {
        n.vx += (w / 2 - n.x) * 0.002
        n.vy += (h / 2 - n.y) * 0.002
        n.vx *= 0.85
        n.vy *= 0.85
        n.x = Math.max(50, Math.min(w - 50, n.x + n.vx))
        n.y = Math.max(50, Math.min(h - 50, n.y + n.vy))
      }

      setPositions(new Map(nodes))
      requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }, [actors, relationships, w, h])

  return positions
}

/* ============================================================================ */
/*  Main Component                                                             */
/* ============================================================================ */
export function ActorNetworkGraphClient() {
  const [actors, setActors] = useState<Actor[]>([])
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [selectedActor, setSelectedActor] = useState<Actor | null>(null)
  const [selectedFaction, setSelectedFaction] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [countryFilter, setCountryFilter] = useState<string>('')
  const [minEventFilter, setMinEventFilter] = useState(0)
  const [threatFilter, setThreatFilter] = useState<string>('')
  const svgRef = useRef<SVGSVGElement>(null)

  const W = 1200
  const H = 700

  // Fetch data
  useEffect(() => {
    Promise.all([fetch('/api/v1/actors/network').then(r => r.json())])
      .then(([networkData]) => {
        if (networkData.success) {
          const data = networkData.data || networkData
          setActors(data.actors || [])
          setRelationships(data.relationships || [])
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Detect factions from relationships
  const factions = useMemo(() => {
    if (!actors.length) return []

    const groups: Map<string, Set<string>> = new Map()
    const assigned = new Set<string>()

    for (const rel of relationships) {
      if (rel.relationship_type === 'allied') {
        if (!groups.has(rel.actor_id)) groups.set(rel.actor_id, new Set())
        groups.get(rel.actor_id)!.add(rel.actor_id)
        groups.get(rel.actor_id)!.add(rel.related_actor_id)

        if (!groups.has(rel.related_actor_id)) groups.set(rel.related_actor_id, new Set())
        groups.get(rel.related_actor_id)!.add(rel.actor_id)
        groups.get(rel.related_actor_id)!.add(rel.related_actor_id)
      }
    }

    const factionList: Faction[] = []
    let colorIdx = 0

    for (const [id, members] of groups) {
      if (assigned.has(id)) continue
      const memberArray = Array.from(members)
      memberArray.forEach(m => assigned.add(m))
      factionList.push({
        name: `Faction ${factionList.length + 1}`,
        members: memberArray,
        color: FACTION_COLORS[colorIdx % FACTION_COLORS.length] ?? '#3b82f6',
      })
      colorIdx++
    }

    return factionList
  }, [actors, relationships])

  // Filter actors
  const filteredActors = useMemo(() => {
    return actors.filter(a => {
      if (countryFilter && a.region !== countryFilter) return false
      if (a.event_count < minEventFilter) return false
      if (threatFilter && a.threat_level !== threatFilter) return false
      return true
    })
  }, [actors, countryFilter, minEventFilter, threatFilter])

  // Filter relationships for visible actors
  const filteredRelationships = useMemo(() => {
    const actorIds = new Set(filteredActors.map(a => a.id))
    return relationships.filter(r => actorIds.has(r.actor_id) && actorIds.has(r.related_actor_id))
  }, [filteredActors, relationships])

  const positions = useForceLayout(filteredActors, filteredRelationships, W, H)

  // Get connected actors to selected
  const connectedActorIds = useMemo(() => {
    if (!selectedActor) return new Set<string>()
    const connected = new Set<string>([selectedActor.id])
    for (const rel of filteredRelationships) {
      if (rel.actor_id === selectedActor.id) connected.add(rel.related_actor_id)
      if (rel.related_actor_id === selectedActor.id) connected.add(rel.actor_id)
    }
    return connected
  }, [selectedActor, filteredRelationships])

  const countries = useMemo(() => {
    const regions = new Set(actors.map(a => a.region).filter(Boolean))
    return Array.from(regions).sort()
  }, [actors])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070B11] flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-white/50 text-center"
        >
          <Zap className="w-12 h-12 mx-auto mb-4 text-cyan-400" />
          <p>Loading actor network...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#070B11] p-8">
      {/* Header */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <Users className="w-8 h-8 text-cyan-400" />
          <h1 className="text-4xl font-bold text-white">Actor Network Intelligence</h1>
        </div>
        <p className="text-sm text-white/60 mt-2">
          Interactive relationship mapping showing actor alliances, rivalries, and network structures
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main graph area */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Filters */}
          <motion.div
            className="rounded-2xl border p-6 space-y-4"
            style={GLASS_STYLE}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Filters</h3>

            <div>
              <label className="text-xs text-white/60 mb-2 block">Country/Region</label>
              <select
                value={countryFilter}
                onChange={e => setCountryFilter(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
              >
                <option value="">All Regions</option>
                {countries.map(c => (
                  <option key={c} value={c ?? ''}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-white/60 mb-2 block">Threat Level</label>
              <select
                value={threatFilter}
                onChange={e => setThreatFilter(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
              >
                <option value="">All Threats</option>
                {['critical', 'high', 'medium', 'low'].map(t => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-white/60 mb-2 block">Min. Event Count: {minEventFilter}</label>
              <input
                type="range"
                min={0}
                max={Math.max(...actors.map(a => a.event_count))}
                value={minEventFilter}
                onChange={e => setMinEventFilter(parseInt(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="text-xs text-white/50 pt-2">
              Showing {filteredActors.length} of {actors.length} actors
            </div>
          </motion.div>

          {/* Force-Directed Graph */}
          <motion.div
            className="rounded-2xl border overflow-hidden"
            style={GLASS_STYLE}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, ...SPRING_CONFIG }}
          >
            <svg
              ref={svgRef}
              width="100%"
              height={H}
              className="bg-gradient-to-br from-white/[0.02] to-white/[0.01]"
            >
              {/* Draw relationships */}
              {filteredRelationships.map((rel, i) => {
                const n1 = positions.get(rel.actor_id)
                const n2 = positions.get(rel.related_actor_id)
                if (!n1 || !n2) return null

                const isSelected = selectedActor && (selectedActor.id === rel.actor_id || selectedActor.id === rel.related_actor_id)
                const opacity = isSelected ? 0.8 : 0.3
                const strokeWidth = isSelected ? 2 : 1

                return (
                  <line
                    key={`rel-${i}`}
                    x1={n1.x}
                    y1={n1.y}
                    x2={n2.x}
                    y2={n2.y}
                    stroke={rel.relationship_type === 'allied' ? '#22c55e' : rel.relationship_type === 'enemy' ? '#ef4444' : '#64748b'}
                    strokeWidth={strokeWidth}
                    opacity={opacity}
                    strokeDasharray={rel.relationship_type === 'unknown' ? '5,5' : 'none'}
                  />
                )
              })}

              {/* Draw nodes */}
              {filteredActors.map(actor => {
                const pos = positions.get(actor.id)
                if (!pos) return null

                const threatColor = THREAT_COLORS[actor.threat_level] || THREAT_COLORS.unknown
                const isSelected = selectedActor?.id === actor.id
                const isConnected = connectedActorIds.has(actor.id)
                const inFaction = selectedFaction ? factions.find(f => f.name === selectedFaction)?.members.includes(actor.id) : false

                const nodeRadius = 20 + (actor.event_count / 10) * 3
                const displayRadius = isSelected ? nodeRadius + 8 : inFaction ? nodeRadius + 4 : nodeRadius

                return (
                  <motion.g
                    key={actor.id}
                    onMouseEnter={() => {}}
                    onClick={() => setSelectedActor(isSelected ? null : actor)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Node circle */}
                    <motion.circle
                      cx={pos.x}
                      cy={pos.y}
                      r={displayRadius}
                      fill={threatColor}
                      opacity={isSelected ? 0.9 : isConnected ? 0.7 : 0.5}
                      animate={{
                        r: displayRadius,
                        opacity: isSelected ? 0.95 : isConnected || inFaction ? 0.8 : 0.5,
                      }}
                      transition={{ ...SPRING_CONFIG }}
                    />

                    {/* Glow effect when selected */}
                    {isSelected && (
                      <motion.circle
                        cx={pos.x}
                        cy={pos.y}
                        r={displayRadius + 8}
                        fill="none"
                        stroke={threatColor}
                        strokeWidth={2}
                        opacity={0.5}
                        animate={{ r: [displayRadius + 8, displayRadius + 12] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      />
                    )}

                    {/* Hover tooltip */}
                    <title>
                      {actor.name} ({actor.actor_type}) - {actor.event_count} events
                    </title>
                  </motion.g>
                )
              })}
            </svg>
          </motion.div>
        </div>

        {/* Right sidebar - Factions & Details */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Faction Panel */}
          <motion.div
            className="rounded-2xl border p-6"
            style={GLASS_STYLE}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Detected Factions</h3>

            {factions.length === 0 ? (
              <p className="text-xs text-white/40">No factions detected. Add more filters to reveal network clusters.</p>
            ) : (
              <div className="space-y-2">
                {factions.map(faction => (
                  <motion.button
                    key={faction.name}
                    onClick={() => setSelectedFaction(selectedFaction === faction.name ? null : faction.name)}
                    className="w-full text-left p-3 rounded-lg border transition-all"
                    style={{
                      background: selectedFaction === faction.name ? faction.color + '15' : 'transparent',
                      borderColor: selectedFaction === faction.name ? faction.color + '60' : 'rgba(255,255,255,0.1)',
                    }}
                    whileHover={{ scale: 1.02, x: 2 }}
                  >
                    <div className="flex items-center gap-3">
                      <motion.div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: faction.color }}
                        animate={selectedFaction === faction.name ? { scale: [1, 1.2, 1] } : {}}
                        transition={{ repeat: selectedFaction === faction.name ? Infinity : 0, duration: 1.5 }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{faction.name}</p>
                        <p className="text-[10px] text-white/50">{faction.members.length} members</p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Selected Actor Details */}
          <AnimatePresence>
            {selectedActor && (
              <motion.div
                className="rounded-2xl border p-6"
                style={GLASS_STYLE}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ ...SPRING_CONFIG }}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <h3 className="text-lg font-bold text-white flex-1">{selectedActor.name}</h3>
                  <motion.button
                    onClick={() => setSelectedActor(null)}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    whileHover={{ scale: 1.1 }}
                  >
                    <X className="w-4 h-4 text-white/60" />
                  </motion.button>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Type & Threat */}
                  <div>
                    <p className="text-white/60 mb-2">Type & Threat</p>
                    <div className="flex gap-2">
                      <motion.span
                        className="px-2 py-1 rounded text-[10px] font-bold uppercase"
                        style={{
                          background: (TYPE_COLORS[selectedActor.actor_type] || '#6b7280') + '15',
                          color: TYPE_COLORS[selectedActor.actor_type] || '#6b7280',
                        }}
                      >
                        {selectedActor.actor_type}
                      </motion.span>
                      <motion.span
                        className="px-2 py-1 rounded text-[10px] font-bold uppercase"
                        style={{
                          background: THREAT_COLORS[selectedActor.threat_level] + '15',
                          color: THREAT_COLORS[selectedActor.threat_level],
                        }}
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                      >
                        {selectedActor.threat_level}
                      </motion.span>
                    </div>
                  </div>

                  {/* Region */}
                  {selectedActor.region && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3 h-3 text-white/50 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-white/60">Region</p>
                        <p className="text-white font-semibold">{selectedActor.region}</p>
                      </div>
                    </div>
                  )}

                  {/* Activity */}
                  <div className="flex items-start gap-2">
                    <Zap className="w-3 h-3 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white/60">Activity</p>
                      <p className="text-white font-semibold">{selectedActor.event_count} events</p>
                    </div>
                  </div>

                  {/* Connected Actors */}
                  {connectedActorIds.size > 1 && (
                    <div>
                      <p className="text-white/60 mb-2">Connected Actors ({connectedActorIds.size - 1})</p>
                      <div className="space-y-1">
                        {Array.from(connectedActorIds)
                          .filter(id => id !== selectedActor.id)
                          .slice(0, 5)
                          .map(id => {
                            const actor = filteredActors.find(a => a.id === id)
                            if (!actor) return null
                            return (
                              <motion.p
                                key={actor.id}
                                className="text-white/70 text-[10px] pl-2 border-l border-white/20"
                                initial={{ opacity: 0, x: -5 }}
                                animate={{ opacity: 1, x: 0 }}
                              >
                                {actor.name}
                              </motion.p>
                            )
                          })}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {selectedActor.description && (
                    <motion.div
                      className="p-3 rounded-lg bg-white/5 border border-white/10 text-white/70 leading-relaxed"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      {selectedActor.description}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Legend */}
      <motion.div
        className="mt-8 rounded-2xl border p-6"
        style={GLASS_STYLE}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-white/60 mb-2">Threat Levels</p>
            <div className="space-y-1">
              {Object.entries(THREAT_COLORS).map(([level, color]) => (
                <div key={level} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                  <span className="text-white/70 capitalize">{level}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-white/60 mb-2">Relationships</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-4 h-px" style={{ background: '#22c55e' }} />
                <span className="text-white/70">Allied</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-px" style={{ background: '#ef4444' }} />
                <span className="text-white/70">Enemy</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-px" style={{ background: '#64748b', strokeDasharray: '2,2' }} />
                <span className="text-white/70">Unknown</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-white/60 mb-2">Node Size</p>
            <p className="text-white/70 text-[11px]">Proportional to event count</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 rounded-full bg-white/40" />
              <div className="w-4 h-4 rounded-full bg-white/40" />
              <div className="w-6 h-6 rounded-full bg-white/40" />
            </div>
          </div>

          <div>
            <p className="text-white/60 mb-2">Interaction</p>
            <p className="text-white/70 text-[11px]">Click nodes to select/deselect</p>
            <p className="text-white/70 text-[11px] mt-2">Click factions to highlight</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
