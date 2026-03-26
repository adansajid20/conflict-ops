'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import { Flame, Plane, Ship } from 'lucide-react'
const TrackingMap = dynamic(() => import('./TrackingMap'), { ssr: false })

type Vessel = { mmsi?: number; ship_name?: string | null; ship_type?: number; latitude: number; longitude: number; speed?: number; flag?: string | null; last_seen?: string | null; demo?: boolean }
type Flight = { icao24?: string; callsign?: string | null; latitude: number; longitude: number; altitude?: number; speed?: number; is_military?: boolean; last_seen?: string | null; demo?: boolean }
type Thermal = { region: string; frp: number; lat: number; lon: number; detected_at: string; demo?: boolean }

function timeAgo(input?: string | null) {
  if (!input) return 'unknown'
  const diff = Math.max(0, Date.now() - new Date(input).getTime())
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function TrackingPanel() {
  const ShipIcon = Ship as any
  const PlaneIcon = Plane as any
  const FlameIcon = Flame as any
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [flights, setFlights] = useState<Flight[]>([])
  const [thermals, setThermals] = useState<Thermal[]>([])
  const [activeTab, setActiveTab] = useState<'vessels' | 'flights' | 'thermal'>('vessels')
  const [layerToggles, setLayerToggles] = useState({ vessels: true, flights: true, thermal: true })

  useEffect(() => {
    void Promise.all([fetch('/api/v1/tracking/vessels'), fetch('/api/v1/tracking/flights')]).then(async ([vRes, fRes]) => {
      const vJson = await vRes.json() as { data?: Vessel[]; meta?: { demo?: boolean } }
      const fJson = await fRes.json() as { data?: Flight[]; meta?: { demo?: boolean } }
      setVessels((vJson.data ?? []).map((item) => ({ ...item, demo: vJson.meta?.demo })))
      setFlights((fJson.data ?? []).map((item) => ({ ...item, demo: fJson.meta?.demo })))
      setThermals([
        { region: 'Levant', frp: 42, lat: 33.1, lon: 35.2, detected_at: new Date().toISOString(), demo: true },
        { region: 'Sahel', frp: 31, lat: 14.6, lon: 20.7, detected_at: new Date().toISOString(), demo: true },
      ])
    })
  }, [])

  const showDemoBanner = useMemo(() => [...vessels, ...flights, ...thermals].some((item) => item.demo), [flights, thermals, vessels])

  return (
    <div className="grid h-full gap-4 xl:grid-cols-[1.7fr_1fr]">
      <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Operational Tracking Layer</div>
          <div className="flex gap-2 text-xs">
            {(['vessels', 'flights', 'thermal'] as const).map((layer) => <button key={layer} onClick={() => setLayerToggles((prev) => ({ ...prev, [layer]: !prev[layer] }))} className="rounded-full border px-2 py-1 capitalize" style={{ borderColor: 'var(--border)', color: layerToggles[layer] ? 'var(--primary)' : 'var(--text-muted)' }}>{layer}</button>)}
          </div>
        </div>
        <TrackingMap vessels={vessels} flights={flights} thermals={thermals} layerToggles={layerToggles} />
      </div>

      <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        {showDemoBanner && <div className="border-b px-4 py-3 text-sm" style={{ borderColor: 'rgba(234,179,8,0.24)', color: '#FACC15', background: 'rgba(234,179,8,0.08)' }}>Live tracking requires AIS/ADS-B API keys. Showing demo data.</div>}
        <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
          {(['vessels', 'flights', 'thermal'] as const).map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className="flex-1 px-3 py-3 text-sm capitalize" style={{ color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)', borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent' }}>{tab}</button>)}
        </div>
        <div className="max-h-[620px] overflow-auto p-4">
          {activeTab === 'vessels' && <div className="space-y-2">{vessels.map((v, i) => <div key={`${v.mmsi}-${i}`} className="rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)' }}><div className="mb-1 flex items-center gap-2"><ShipIcon size={14} style={{ color: v.ship_type === 35 ? 'var(--sev-critical)' : 'var(--primary)' }} /><span style={{ color: 'var(--text-primary)' }}>{v.ship_name || `MMSI ${v.mmsi}`}</span></div><div style={{ color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>{v.mmsi} · {v.flag || '--'} · {v.latitude.toFixed(2)}, {v.longitude.toFixed(2)} · {v.speed || 0}kn · {timeAgo(v.last_seen)}</div></div>)}</div>}
          {activeTab === 'flights' && <div className="space-y-2">{flights.map((f, i) => <div key={`${f.icao24}-${i}`} className="rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)' }}><div className="mb-1 flex items-center gap-2"><PlaneIcon size={14} style={{ color: f.is_military ? 'var(--sev-critical)' : 'var(--primary)' }} /><span style={{ color: 'var(--text-primary)' }}>{f.callsign || f.icao24}</span></div><div style={{ color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>{f.icao24} · alt {Math.round((f.altitude || 0) * 3.28084)}ft · speed {f.speed || 0} · {timeAgo(f.last_seen)}</div></div>)}</div>}
          {activeTab === 'thermal' && <div className="space-y-2">{thermals.map((t, i) => <div key={`${t.region}-${i}`} className="rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)' }}><div className="mb-1 flex items-center gap-2"><FlameIcon size={14} style={{ color: 'var(--sev-high)' }} /><span style={{ color: 'var(--text-primary)' }}>{t.region}</span></div><div style={{ color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>FRP {t.frp} · {t.lat.toFixed(2)}, {t.lon.toFixed(2)} · {timeAgo(t.detected_at)}</div></div>)}</div>}
        </div>
      </div>
    </div>
  )
}
