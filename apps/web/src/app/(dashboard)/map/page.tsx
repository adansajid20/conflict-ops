'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { MapFilterPanel } from '@/components/map/MapFilterPanel'
import { MapStatsBar } from '@/components/map/MapStatsBar'

const GlobeMap = dynamic(() => import('@/components/map/GlobeMap'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '100%', background: '#030512', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, border: '2px solid rgba(99,102,241,0.3)',
          borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite',
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
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set(['events']))
  const [stats, setStats] = useState({ total: 0, critical: 0, high: 0, medium: 0, low: 0 })

  function handleLayerToggle(id: string) {
    setActiveLayers(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', background: '#030512', overflow: 'hidden' }}>
      <GlobeMap
        window={timeWindow}
        severity={severity}
        activeLayers={activeLayers}
        onStatsUpdate={s => setStats(s)}
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
        tracked={stats.total}
        critical={stats.critical}
        high={stats.high}
        medium={stats.medium}
        low={stats.low}
        isLive={true}
      />

      {/* Intel Co-pilot */}
      <button style={{
        position: 'absolute', bottom: 20, right: 20, zIndex: 30,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 16px',
        background: 'rgba(8,13,25,0.92)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        color: '#d1d5db', fontSize: 12, fontWeight: 500, cursor: 'pointer',
        backdropFilter: 'blur(14px)',
      }}>
        🤖 Intel Co-pilot
      </button>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  )
}
