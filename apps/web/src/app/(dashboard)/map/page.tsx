'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { MapFilterPanel } from '@/components/map/MapFilterPanel'
import { MapStatsBar } from '@/components/map/MapStatsBar'
import { EventDetailPanel } from '@/components/map/EventDetailPanel'
import type { MapEvent } from '@/components/map/GlobeMap'

const GlobeMap = dynamic(() => import('@/components/map/GlobeMap'), {
  ssr: false,
  loading: () => (
    <div style={{ position: 'absolute', inset: 0, background: '#060a10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36,
          border: '2px solid rgba(99,102,241,0.3)',
          borderTopColor: '#6366f1',
          borderRadius: '50%',
          animation: 'cr-spin 0.8s linear infinite',
        }} />
        <span style={{ fontSize: 10, letterSpacing: '0.2em', color: '#4b5563', textTransform: 'uppercase' }}>
          LOADING GLOBE
        </span>
      </div>
    </div>
  ),
})

export default function MapPage() {
  const [timeWindow, setTimeWindow] = useState('7d')
  const [severity, setSeverity] = useState('all')
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set(['events', 'seismic']))
  const [stats, setStats] = useState({ tracked: 0, critical: 0, high: 0, medium: 0, low: 0 })
  const [selectedEvent, setSelectedEvent] = useState<MapEvent | null>(null)

  const handleLayerToggle = useCallback((id: string) => {
    setActiveLayers(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', background: '#060a10', overflow: 'hidden' }}>

      <GlobeMap
        timeWindow={timeWindow}
        severity={severity}
        activeLayers={activeLayers}
        onStatsUpdate={setStats}
        onEventClick={setSelectedEvent}
      />

      <MapFilterPanel
        timeWindow={timeWindow}
        severity={severity}
        activeLayers={activeLayers}
        onTimeChange={setTimeWindow}
        onSeverityChange={setSeverity}
        onLayerToggle={handleLayerToggle}
      />

      <MapStatsBar
        tracked={stats.tracked}
        critical={stats.critical}
        high={stats.high}
        medium={stats.medium}
        low={stats.low}
        isLive={true}
      />

      <EventDetailPanel
        event={selectedEvent as Record<string, unknown> | null}
        onClose={() => setSelectedEvent(null)}
      />

      {/* Intel Co-pilot */}
      <button style={{
        position: 'absolute', bottom: 20, right: 20, zIndex: 30,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 16px',
        background: 'rgba(10,13,20,0.92)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        color: '#94a3b8', fontSize: 12, fontWeight: 500, cursor: 'pointer',
        backdropFilter: 'blur(12px)',
        fontFamily: '-apple-system, system-ui, sans-serif',
      }}>
        🤖 Intel Co-pilot
      </button>

      {/* Vignette */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, transparent 55%, rgba(6,10,16,0.45) 100%)',
      }} />

      <style>{`
        @keyframes cr-spin { to { transform: rotate(360deg); } }
        @keyframes cr-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  )
}
