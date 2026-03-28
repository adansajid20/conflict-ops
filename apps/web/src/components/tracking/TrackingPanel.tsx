'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import { Flame as FlameIcon, Plane as PlaneIcon, Ship as ShipIcon, ExternalLink as ExternalLinkIcon, X as XIcon } from 'lucide-react'

// Cast icons to avoid React version JSX compatibility errors
const Flame = FlameIcon as any
const Plane = PlaneIcon as any
const Ship = ShipIcon as any
const ExternalLink = ExternalLinkIcon as any
const X = XIcon as any
import { IntelDrawer } from '@/components/intel/IntelDrawer'
import { eventToIntelItem, type IntelItem } from '@/types/intel-item'
import { safeRelativeTime } from '@/lib/utils/time'

const TrackingMap = dynamic(() => import('./TrackingMap'), { ssr: false })

// ─── Types ────────────────────────────────────────────────────────────────────
type Vessel = {
  mmsi?: number; ship_name?: string | null; ship_type?: number
  latitude: number; longitude: number; speed?: number
  flag?: string | null; last_seen?: string | null; demo?: boolean
}
type Flight = {
  icao24?: string; callsign?: string | null
  latitude: number; longitude: number
  altitude?: number; speed?: number; is_military?: boolean
  last_seen?: string | null; demo?: boolean
}
type Thermal = { region: string; frp: number; lat: number; lon: number; detected_at: string; demo?: boolean }
type IntelEvent = {
  id: string; source: string; title: string; description?: string | null
  severity?: number | null; region?: string | null; occurred_at?: string | null
  ingested_at?: string | null; event_type?: string | null; country_code?: string | null
  provenance_raw?: Record<string, unknown> | null; location?: string | null
}

type TimeWindow = '24h' | '7d' | '30d'
type SeverityFilter = 'all' | 'high' | 'critical'

// ─── Severity helpers ─────────────────────────────────────────────────────────
const SEV_COLOR: Record<number, string> = {
  1: '#6B7280',
  2: '#EAB308',
  3: '#F97316',
  4: '#EF4444',
}
const SEV_LABEL: Record<number, string> = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical' }

// ─── Setup card data ──────────────────────────────────────────────────────────
const SETUP_CARDS = {
  flights: {
    icon: '✈',
    title: 'ADS-B Flight Tracking',
    desc: 'This premium layer requires an ADS-B Exchange API key.',
    freeNote: 'Free tier available at:',
    url: 'adsbexchange.com/api-info',
  },
  vessels: {
    icon: '⚓',
    title: 'AIS Vessel Tracking',
    desc: 'This premium layer requires an AISStream.io API key.',
    freeNote: 'Free tier available at:',
    url: 'aisstream.io',
  },
  thermal: {
    icon: '🔥',
    title: 'NASA FIRMS Thermal',
    desc: 'This premium layer requires a NASA FIRMS API key.',
    freeNote: 'Free tier available at:',
    url: 'firms.modaps.eosdis.nasa.gov/api',
  },
} as const
type TrackingLayerKey = keyof typeof SETUP_CARDS

function parseCoords(location: unknown): { lat: number; lng: number } | null {
  if (!location) return null
  if (typeof location === 'string') {
    const wkt = location.includes(';') ? (location.split(';')[1] ?? '') : location
    const m = wkt.match(/POINT\(([-.0-9]+)\s+([-.0-9]+)\)/)
    if (!m) return null
    const lng = parseFloat(m[1] ?? '')
    const lat = parseFloat(m[2] ?? '')
    return isNaN(lng) || isNaN(lat) ? null : { lng, lat }
  }
  if (typeof location === 'object' && location !== null) {
    const loc = location as { type?: string; coordinates?: number[] }
    if (loc.type === 'Point' && Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
      const lng = loc.coordinates[0] ?? NaN
      const lat = loc.coordinates[1] ?? NaN
      return isNaN(lng) || isNaN(lat) ? null : { lng, lat }
    }
  }
  return null
}

// ─── Setup card component ─────────────────────────────────────────────────────
function SetupCard({ layerKey, onClose }: { layerKey: TrackingLayerKey; onClose: () => void }) {
  const card = SETUP_CARDS[layerKey]
  return (
    <div className="rounded-lg border p-4 text-xs mt-2"
      style={{ borderColor: 'rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.06)', position: 'relative' }}>
      <button onClick={onClose} className="absolute top-2 right-2 opacity-50 hover:opacity-100"
        style={{ color: 'var(--text-muted)' }}>
        <X size={12} />
      </button>
      <div className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
        {card.icon} {card.title}
      </div>
      <p style={{ color: 'var(--text-muted)' }} className="mb-2">{card.desc}</p>
      <p style={{ color: 'var(--text-muted)' }} className="mb-3">
        {card.freeNote}{' '}
        <span className="mono" style={{ color: 'var(--primary-text)' }}>{card.url}</span>
      </p>
      <a href="/settings/api" className="inline-flex items-center gap-1 text-xs rounded px-3 py-1.5"
        style={{ background: 'var(--primary)', color: 'var(--primary-text)', textDecoration: 'none' }}>
        Configure in Settings <ExternalLink size={10} />
      </a>
    </div>
  )
}

// ─── Selected event panel ─────────────────────────────────────────────────────
function SelectedEventPanel({ event, onClose }: { event: IntelEvent; onClose: () => void }) {
  const sev = event.severity ?? 1
  const sevColor = SEV_COLOR[sev] ?? '#6B7280'
  const sevLabel = SEV_LABEL[sev] ?? 'Low'
  const desc = event.description ?? ''
  const snippet = desc.length > 200 ? desc.slice(0, 200) + '…' : desc

  return (
    <div className="rounded-lg border p-3 text-xs"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)', borderLeft: `3px solid ${sevColor}` }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="rounded px-1.5 py-0.5 text-[10px] font-bold mono"
            style={{ background: `${sevColor}22`, color: sevColor }}>
            {sevLabel.toUpperCase()}
          </span>
          {event.event_type && (
            <span className="text-[10px] mono uppercase" style={{ color: 'var(--text-muted)' }}>
              {event.event_type}
            </span>
          )}
        </div>
        <button onClick={onClose} className="shrink-0 opacity-50 hover:opacity-100"
          style={{ color: 'var(--text-muted)' }}>
          <X size={12} />
        </button>
      </div>

      <div className="font-medium mb-2" style={{ color: 'var(--text-primary)', lineHeight: 1.4 }}>
        {event.title}
      </div>

      <div className="space-y-1 mb-3" style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
        {(event.region || event.country_code) && (
          <div>📍 {event.region || event.country_code}</div>
        )}
        <div>🕐 {safeRelativeTime(event.occurred_at)}</div>
        {event.source && (
          <div>📡 {event.source.toUpperCase()}</div>
        )}
      </div>

      {snippet && (
        <p className="mb-3 text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {snippet}
        </p>
      )}

      <a
        href={`/feed?eventId=${event.id}`}
        className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium"
        style={{ background: 'var(--bg-active)', color: 'var(--primary-text)', textDecoration: 'none' }}>
        View in Intel Feed <ExternalLink size={10} />
      </a>
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2 mt-4 first:mt-0"
      style={{ color: 'var(--text-muted)' }}>
      {label}
    </div>
  )
}

// ─── Category options ─────────────────────────────────────────────────────────
const CATEGORY_OPTIONS = [
  { value: '', label: 'All categories' },
  { value: 'conflict', label: 'Conflict' },
  { value: 'airstrike', label: 'Airstrike' },
  { value: 'explosion', label: 'Explosion' },
  { value: 'displacement', label: 'Displacement' },
  { value: 'protest', label: 'Protest' },
  { value: 'disaster', label: 'Disaster' },
  { value: 'fire', label: 'Fire' },
]

// ─── Main TrackingPanel ────────────────────────────────────────────────────────
export function TrackingPanel() {
  // Data state
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [flights, setFlights] = useState<Flight[]>([])
  const [thermals, setThermals] = useState<Thermal[]>([])
  const [allIntelEvents, setAllIntelEvents] = useState<IntelEvent[]>([])

  // Layer toggles
  const [showEvents, setShowEvents] = useState(true)
  const [showHeatmap, setShowHeatmap] = useState(false)

  // Filters
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('7d')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('')

  // UI state
  const [setupCard, setSetupCard] = useState<TrackingLayerKey | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<IntelEvent | null>(null)
  const [selectedIntelItem, setSelectedIntelItem] = useState<IntelItem | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch tracking data (vessels/flights — always attempt, no scary errors on failure)
  useEffect(() => {
    void Promise.all([
      fetch('/api/v1/tracking/vessels').then(r => r.json()).catch(() => ({ data: [], meta: { demo: true } })),
      fetch('/api/v1/tracking/flights').then(r => r.json()).catch(() => ({ data: [], meta: { demo: true } })),
    ]).then(([vJson, fJson]: [any, any]) => {
      setVessels((vJson.data ?? []).map((item: Vessel) => ({ ...item, demo: vJson.meta?.demo })))
      setFlights((fJson.data ?? []).map((item: Flight) => ({ ...item, demo: fJson.meta?.demo })))
      setThermals([
        { region: 'Levant', frp: 42, lat: 33.1, lon: 35.2, detected_at: new Date().toISOString(), demo: true },
        { region: 'Sahel', frp: 31, lat: 14.6, lon: 20.7, detected_at: new Date().toISOString(), demo: true },
      ])
    })
  }, [])

  // Fetch intel events (re-fetch on timeWindow change)
  useEffect(() => {
    setLoading(true)
    void fetch(`/api/v1/events?window=${timeWindow}&limit=500`, { cache: 'no-store' })
      .then(r => r.json())
      .then((j: { data?: IntelEvent[] }) => {
        // Include events that have location OR country_code/region
        const events = (j.data ?? []).filter(e =>
          parseCoords(e.location) !== null || e.country_code || e.region
        )
        setAllIntelEvents(events)
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [timeWindow])

  // Apply client-side filters
  const filteredEvents = useMemo(() => {
    return allIntelEvents.filter(e => {
      if (severityFilter === 'high' && (e.severity ?? 1) < 3) return false
      if (severityFilter === 'critical' && (e.severity ?? 1) < 4) return false
      if (categoryFilter && !(e.event_type ?? '').toLowerCase().includes(categoryFilter)) return false
      if (countryFilter) {
        const cf = countryFilter.toLowerCase()
        const matches = (e.country_code ?? '').toLowerCase().includes(cf) ||
          (e.region ?? '').toLowerCase().includes(cf)
        if (!matches) return false
      }
      return true
    })
  }, [allIntelEvents, severityFilter, categoryFilter, countryFilter])

  const intelItems = useMemo(() => filteredEvents.map(e => eventToIntelItem(e as never)), [filteredEvents])

  // Layer toggles for map
  const layerToggles = {
    vessels: false, // disabled until API key
    flights: false, // disabled until API key
    thermal: false, // disabled until API key
    intel: showEvents,
    heatmap: showHeatmap,
  }

  return (
    <div className="grid h-full" style={{ gridTemplateColumns: '1fr 320px', gap: 0 }}>
      {/* ── Map ─────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden relative" style={{ background: 'var(--bg-base)' }}>
        <TrackingMap
          vessels={[]}
          flights={[]}
          thermals={[]}
          intelEvents={filteredEvents}
          layerToggles={layerToggles}
          onIntelClick={event => {
            setSelectedEvent(event)
          }}
        />
        {/* Event count badge */}
        {filteredEvents.length > 0 && (
          <div className="absolute top-3 left-3 rounded-md px-2 py-1 text-xs mono pointer-events-none"
            style={{ background: 'rgba(7,11,17,0.85)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
            {filteredEvents.length} events · {timeWindow}
          </div>
        )}
        {loading && (
          <div className="absolute top-3 left-3 rounded-md px-2 py-1 text-xs mono"
            style={{ background: 'rgba(7,11,17,0.85)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            Loading…
          </div>
        )}
      </div>

      {/* ── Right Panel ─────────────────────────────────────────────────── */}
      <div className="border-l flex flex-col overflow-hidden"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <div className="overflow-y-auto flex-1 px-3 py-3 space-y-0">

          {/* LAYERS */}
          <SectionLabel label="Layers" />
          <div className="space-y-1.5 mb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showEvents} onChange={e => setShowEvents(e.target.checked)}
                className="rounded" style={{ accentColor: 'var(--primary)' }} />
              <span className="text-xs" style={{ color: 'var(--text-primary)' }}>Conflict Events</span>
              <span className="ml-auto text-[10px] mono px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E' }}>
                {filteredEvents.length}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showHeatmap} onChange={e => setShowHeatmap(e.target.checked)}
                className="rounded" style={{ accentColor: 'var(--primary)' }} />
              <span className="text-xs" style={{ color: 'var(--text-primary)' }}>Heatmap view</span>
            </label>
          </div>

          {/* FILTERS */}
          <SectionLabel label="Filters" />
          <div className="space-y-2 mb-1">
            {/* Time window */}
            <div>
              <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Time window</div>
              <div className="flex gap-1">
                {(['24h', '7d', '30d'] as TimeWindow[]).map(w => (
                  <button key={w} onClick={() => setTimeWindow(w)}
                    className="flex-1 rounded py-1 text-[11px] mono border transition-colors"
                    style={{
                      borderColor: timeWindow === w ? 'var(--primary)' : 'var(--border)',
                      color: timeWindow === w ? 'var(--primary-text)' : 'var(--text-muted)',
                      background: timeWindow === w ? 'var(--bg-active)' : 'transparent',
                    }}>
                    {w}
                  </button>
                ))}
              </div>
            </div>

            {/* Severity */}
            <div>
              <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Severity</div>
              <div className="flex gap-1">
                {([['all', 'All'], ['high', 'High+'], ['critical', 'Crit']] as [SeverityFilter, string][]).map(([v, label]) => (
                  <button key={v} onClick={() => setSeverityFilter(v)}
                    className="flex-1 rounded py-1 text-[11px] border transition-colors"
                    style={{
                      borderColor: severityFilter === v ? 'var(--primary)' : 'var(--border)',
                      color: severityFilter === v ? 'var(--primary-text)' : 'var(--text-muted)',
                      background: severityFilter === v ? 'var(--bg-active)' : 'transparent',
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div>
              <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Category</div>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                className="w-full rounded border px-2 py-1 text-xs"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)' }}>
                {CATEGORY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Country */}
            <div>
              <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Country / Region</div>
              <input
                type="text"
                placeholder="e.g. UA, Syria, Sahel…"
                value={countryFilter}
                onChange={e => setCountryFilter(e.target.value)}
                className="w-full rounded border px-2 py-1 text-xs"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)' }} />
            </div>
          </div>

          {/* TRACKING LAYERS */}
          <SectionLabel label="Tracking Layers" />
          <div className="space-y-1.5 mb-1">
            {(Object.keys(SETUP_CARDS) as TrackingLayerKey[]).map(key => {
              const card = SETUP_CARDS[key]
              return (
                <div key={key}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{card.icon}</span>
                    <span className="text-xs flex-1"
                      style={{ color: 'var(--text-muted)' }}>
                      {key === 'flights' ? 'Flight tracking' : key === 'vessels' ? 'Vessel tracking' : 'Thermal anomalies'}
                    </span>
                    <button
                      onClick={() => setSetupCard(prev => prev === key ? null : key)}
                      className="text-[10px] rounded px-2 py-0.5 border transition-colors"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'transparent' }}
                      title={`Configure ${card.title} in Settings to enable`}>
                      Setup
                    </button>
                    {/* Disabled toggle */}
                    <div className="w-8 h-4 rounded-full flex items-center opacity-30 cursor-not-allowed"
                      style={{ background: 'var(--border)' }}
                      title={`Configure ${card.title} API key in Settings to enable`}>
                      <div className="w-3 h-3 rounded-full mx-0.5" style={{ background: 'var(--text-muted)' }} />
                    </div>
                  </div>
                  {setupCard === key && (
                    <SetupCard layerKey={key} onClose={() => setSetupCard(null)} />
                  )}
                </div>
              )
            })}
          </div>

          {/* SELECTED EVENT */}
          <SectionLabel label="Selected Event" />
          {selectedEvent ? (
            <SelectedEventPanel
              event={selectedEvent}
              onClose={() => setSelectedEvent(null)}
            />
          ) : (
            <div className="rounded-lg border border-dashed py-6 text-center text-xs"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <div className="mb-1 text-lg">🗺</div>
              Click a marker to<br />view event details
            </div>
          )}

        </div>
      </div>

      {/* Intel drawer for full-detail view */}
      <IntelDrawer
        item={selectedIntelItem}
        items={intelItems}
        onClose={() => setSelectedIntelItem(null)}
        onNavigate={item => setSelectedIntelItem(item)}
      />
    </div>
  )
}
