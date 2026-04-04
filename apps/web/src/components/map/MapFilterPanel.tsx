'use client'

import { useState } from 'react'

const LIVE_LAYERS = [
  { id: 'seismic', icon: '💥', label: 'Seismic', color: '#f59e0b' },
  { id: 'flights', icon: '✈️', label: 'Flights', color: '#60a5fa' },
  { id: 'nuclear', icon: '☢️', label: 'Nuclear', color: '#a78bfa' },
  { id: 'outages', icon: '🌐', label: 'Outages', color: '#8b5cf6' },
  { id: 'vessels', icon: '🚢', label: 'Vessels', color: '#34d399' },
  { id: 'fires', icon: '🔥', label: 'Fires', color: '#ff4500' },
]

interface Props {
  timeWindow: string
  severity: string
  activeLayers: Set<string>
  onTimeChange: (v: string) => void
  onSeverityChange: (v: string) => void
  onLayerToggle: (id: string) => void
}

export function MapFilterPanel({ timeWindow, severity, activeLayers, onTimeChange, onSeverityChange, onLayerToggle }: Props) {
  const [open, setOpen] = useState(true)

  const panelBase: React.CSSProperties = {
    background: 'rgba(8,13,25,0.94)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    backdropFilter: 'blur(16px)',
    overflow: 'hidden',
  }

  return (
    <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 30, width: 220 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          marginBottom: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(8,13,25,0.92)',
          color: '#9ca3af',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          backdropFilter: 'blur(12px)',
        }}
      >
        <span style={{ fontSize: 10 }}>⚙</span>
        {open ? 'HIDE FILTERS' : 'SHOW FILTERS'}
        <span style={{ marginLeft: 'auto', fontSize: 9 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={panelBase}>

          {/* Time Window */}
          <div style={{ padding: '12px 12px 8px' }}>
            <p style={{ fontSize: 9, letterSpacing: '0.12em', color: '#4b5563', textTransform: 'uppercase', marginBottom: 8 }}>
              Time Window
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
              {[{ label: '24H', val: '24h' }, { label: '72H', val: '72h' }, { label: '7D', val: '7d' }, { label: '30D', val: '30d' }].map(t => {
                const active = timeWindow === t.val
                return (
                  <button key={t.val} onClick={() => onTimeChange(t.val)} style={{
                    padding: '6px 0', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    border: 'none', cursor: 'pointer',
                    background: active ? '#2563eb' : 'rgba(255,255,255,0.06)',
                    color: active ? '#fff' : '#6b7280',
                    transition: 'all 0.15s',
                  }}>
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0 12px' }} />

          {/* Severity */}
          <div style={{ padding: '10px 12px 8px' }}>
            <p style={{ fontSize: 9, letterSpacing: '0.12em', color: '#4b5563', textTransform: 'uppercase', marginBottom: 8 }}>
              Severity
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {[
                { val: 'all', label: 'All' },
                { val: 'critical', label: 'Critical' },
                { val: 'high', label: 'High+' },
                { val: 'medium', label: 'Medium+' },
              ].map(s => (
                <button key={s.val} onClick={() => onSeverityChange(s.val)} style={{
                  padding: '6px 0', borderRadius: 6, fontSize: 11, fontWeight: 500,
                  border: severity === s.val ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
                  cursor: 'pointer',
                  background: severity === s.val ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                  color: severity === s.val ? '#fff' : '#6b7280',
                  transition: 'all 0.15s',
                }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0 12px' }} />

          {/* Live Layers */}
          <div style={{ padding: '10px 12px 8px' }}>
            <p style={{ fontSize: 9, letterSpacing: '0.12em', color: '#4b5563', textTransform: 'uppercase', marginBottom: 6 }}>
              Live Layers
            </p>
            {LIVE_LAYERS.map(layer => {
              const on = activeLayers.has(layer.id)
              return (
                <button key={layer.id} onClick={() => onLayerToggle(layer.id)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '7px 6px', borderRadius: 8,
                  border: 'none', cursor: 'pointer',
                  background: 'transparent', transition: 'background 0.15s',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>{layer.icon}</span>
                    <span style={{ fontSize: 12, color: on ? '#e5e7eb' : '#4b5563', transition: 'color 0.15s' }}>
                      {layer.label}
                    </span>
                  </span>
                  {/* Toggle pill */}
                  <span style={{
                    position: 'relative', width: 32, height: 16, borderRadius: 9999,
                    background: on ? '#2563eb' : 'rgba(255,255,255,0.1)',
                    transition: 'background 0.2s', flexShrink: 0, display: 'inline-block',
                  }}>
                    <span style={{
                      position: 'absolute', top: 2, left: on ? 16 : 2,
                      width: 12, height: 12, borderRadius: '50%',
                      background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                      transition: 'left 0.2s',
                    }} />
                  </span>
                </button>
              )
            })}
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0 12px' }} />

          {/* Legend — once, at bottom */}
          <div style={{ padding: '10px 12px 12px' }}>
            <p style={{ fontSize: 9, letterSpacing: '0.12em', color: '#4b5563', textTransform: 'uppercase', marginBottom: 8 }}>
              Legend
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
              {[
                { color: '#ef4444', label: 'Critical' },
                { color: '#f97316', label: 'High' },
                { color: '#eab308', label: 'Medium' },
                { color: '#22c55e', label: 'Low' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: '#6b7280' }}>{s.label}</span>
                </div>
              ))}
              {LIVE_LAYERS.filter(l => activeLayers.has(l.id)).map(l => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11 }}>{l.icon}</span>
                  <span style={{ fontSize: 10, color: '#6b7280' }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
