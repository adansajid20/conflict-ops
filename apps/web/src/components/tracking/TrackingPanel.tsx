'use client'

import { useEffect, useState, useCallback } from 'react'

type TrackingStats = {
  vessels: number
  flights: number
  thermal_anomalies: number
  dark_vessels: number
  emergency_squawks: number
  last_updated: string
}

type VesselTrack = {
  mmsi: number
  ship_name: string | null
  ship_type: number
  latitude: number
  longitude: number
  speed: number
  flag: string | null
  zone_name: string
  last_seen: string
}

type FlightTrack = {
  icao24: string
  callsign: string | null
  origin_country: string | null
  latitude: number
  longitude: number
  altitude: number
  is_military: boolean
  is_isr: boolean
  squawk: string | null
  last_seen: string
}

const SHIP_TYPE_LABELS: Record<number, string> = {
  31: 'TUG', 32: 'TUG', 33: 'DREDGER', 34: 'DIVE',
  35: '★ MILITARY', 36: 'SAILING', 37: 'PLEASURE',
}

function VesselRow({ vessel }: { vessel: VesselTrack }) {
  const label = SHIP_TYPE_LABELS[vessel.ship_type] ?? `TYPE ${vessel.ship_type}`
  const isMilitary = vessel.ship_type === 35
  const age = Math.round((Date.now() - new Date(vessel.last_seen).getTime()) / 60000)

  return (
    <div
      className="p-2 rounded border-l-2 mb-1 text-xs mono"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderLeftColor: isMilitary ? 'var(--alert-red)' : 'var(--accent-blue)',
      }}
    >
      <div className="flex items-center justify-between">
        <span style={{ color: isMilitary ? 'var(--alert-red)' : 'var(--text-primary)' }} className="font-bold">
          {vessel.ship_name || `MMSI ${vessel.mmsi}`}
        </span>
        <span style={{ color: 'var(--text-muted)' }}>{vessel.flag ?? '??'} · {label}</span>
      </div>
      <div style={{ color: 'var(--text-muted)' }}>
        {vessel.zone_name} · {vessel.speed}kn · {age}m ago
      </div>
    </div>
  )
}

function FlightRow({ flight }: { flight: FlightTrack }) {
  const isEmergency = ['7700','7600','7500'].includes(flight.squawk ?? '')
  const age = Math.round((Date.now() - new Date(flight.last_seen).getTime()) / 60000)
  const altFt = Math.round((flight.altitude ?? 0) * 3.28084 / 100) * 100

  return (
    <div
      className="p-2 rounded border-l-2 mb-1 text-xs mono"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderLeftColor: isEmergency ? '#FF0000' : flight.is_isr ? 'var(--alert-amber)' : 'var(--primary)',
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="font-bold"
          style={{ color: isEmergency ? '#FF0000' : flight.is_isr ? 'var(--alert-amber)' : 'var(--text-primary)' }}
        >
          {flight.callsign ?? flight.icao24}
          {isEmergency && ` ⚠ SQK${flight.squawk}`}
          {flight.is_isr && ' [ISR]'}
          {flight.is_military && !flight.is_isr && ' [MIL]'}
        </span>
        <span style={{ color: 'var(--text-muted)' }}>{flight.origin_country ?? '??'}</span>
      </div>
      <div style={{ color: 'var(--text-muted)' }}>
        {altFt.toLocaleString()}ft · {age}m ago
      </div>
    </div>
  )
}

export function TrackingPanel() {
  const [stats, setStats] = useState<TrackingStats | null>(null)
  const [vessels, setVessels] = useState<VesselTrack[]>([])
  const [flights, setFlights] = useState<FlightTrack[]>([])
  const [activeTab, setActiveTab] = useState<'vessels' | 'flights' | 'thermal'>('vessels')
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, vesselsRes, flightsRes] = await Promise.all([
        fetch('/api/v1/tracking/stats'),
        fetch('/api/v1/tracking/vessels?limit=50'),
        fetch('/api/v1/tracking/flights?limit=50'),
      ])

      const [statsJson, vesselsJson, flightsJson] = await Promise.all([
        statsRes.json() as Promise<{ data?: TrackingStats }>,
        vesselsRes.json() as Promise<{ data?: VesselTrack[] }>,
        flightsRes.json() as Promise<{ data?: FlightTrack[] }>,
      ])

      if (statsJson.data) setStats(statsJson.data)
      if (vesselsJson.data) setVessels(vesselsJson.data)
      if (flightsJson.data) setFlights(flightsJson.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
    const interval = setInterval(() => void fetchData(), 120_000) // refresh every 2min
    return () => clearInterval(interval)
  }, [fetchData])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold mono tracking-widest" style={{ color: 'var(--text-primary)' }}>
            MARITIME / AIR PICTURE
          </h2>
          <div className="text-xs mono" style={{ color: 'var(--text-muted)' }}>LIVE · 30MIN REFRESH</div>
        </div>

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-5 gap-2 text-center">
            {[
              { label: 'VESSELS', value: stats.vessels, color: 'var(--accent-blue)' },
              { label: 'FLIGHTS', value: stats.flights, color: 'var(--primary)' },
              { label: 'THERMAL', value: stats.thermal_anomalies, color: 'var(--alert-amber)' },
              { label: 'DARK', value: stats.dark_vessels, color: 'var(--text-muted)' },
              { label: 'EMERG', value: stats.emergency_squawks, color: 'var(--alert-red)' },
            ].map(s => (
              <div key={s.label} className="rounded border p-1" style={{ borderColor: 'var(--border)' }}>
                <div className="text-lg font-bold mono" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs mono" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
        {(['vessels', 'flights', 'thermal'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 text-xs mono tracking-wider"
            style={{
              color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
            }}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="text-xs mono text-center py-8" style={{ color: 'var(--text-muted)' }}>
            LOADING TRACKING DATA...
          </div>
        ) : activeTab === 'vessels' ? (
          vessels.length === 0 ? (
            <div className="text-xs mono text-center py-8" style={{ color: 'var(--text-muted)' }}>
              NO VESSELS TRACKED — SET AISSTREAM_API_KEY TO ENABLE
            </div>
          ) : (
            vessels.map(v => <VesselRow key={v.mmsi} vessel={v} />)
          )
        ) : activeTab === 'flights' ? (
          flights.length === 0 ? (
            <div className="text-xs mono text-center py-8" style={{ color: 'var(--text-muted)' }}>
              NO FLIGHTS TRACKED — OPENSKY CREDENTIALS OPTIONAL
            </div>
          ) : (
            flights.map(f => <FlightRow key={f.icao24} flight={f} />)
          )
        ) : (
          <div className="text-xs mono text-center py-8" style={{ color: 'var(--text-muted)' }}>
            THERMAL ANOMALY MAP — SET NASA_FIRMS_API_KEY TO ENABLE
          </div>
        )}
      </div>
    </div>
  )
}
