'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import { Flame as FlameIcon, Plane as PlaneIcon, Ship as ShipIcon, ExternalLink as ExternalLinkIcon, X as XIcon, Globe as GlobeIcon, Map as MapIcon } from 'lucide-react'

// Cast icons to avoid React version JSX compatibility errors
const Flame = FlameIcon as any
const Plane = PlaneIcon as any
const Ship = ShipIcon as any
const ExternalLink = ExternalLinkIcon as any
const X = XIcon as any
const GlobeLucide = GlobeIcon as any
const MapLucide = MapIcon as any

import { IntelDrawer } from '@/components/intel/IntelDrawer'
import { eventToIntelItem, type IntelItem } from '@/types/intel-item'
import { safeRelativeTime } from '@/lib/utils/time'
import type { GlobeIntelEvent } from '@/components/tracking/GlobeView'

const TrackingMap = dynamic(() => import('./TrackingMap'), { ssr: false })
const GlobeView = dynamic(() => import('./GlobeView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-black flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-white/80">Loading globe...</p>
      </div>
    </div>
  ),
})

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
type IntelEvent = GlobeIntelEvent

type TimeWindow = '24h' | '7d' | '30d'
type SeverityFilter = 'all' | 'high' | 'critical'
type ViewMode = 'globe' | 'map'

// ─── Severity helpers ─────────────────────────────────────────────────────────
const SEV_COLOR: Record<number, string> = {
  1: '#6B7280', 2: '#EAB308', 3: '#F97316', 4: '#EF4444',
}
const SEV_LABEL: Record<number, string> = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical' }

// ─── Setup card data ──────────────────────────────────────────────────────────
const SETUP_CARDS = {
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
type SetupCardKey = keyof typeof SETUP_CARDS

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
function SetupCard({ layerKey, onClose }: { layerKey: SetupCardKey; onClose: () => void }) {
  const card = SETUP_CARDS[layerKey]
  return (
    <div className="rounded-lg border p-4 text-xs mt-2 bg-white/[0.03] border-white/[0.06] relative">
      <button onClick={onClose} className="absolute top-2 right-2 opacity-50 hover:opacity-100 text-white/50">
        <X size={12} />
      </button>
      <div className="font-semibold mb-2 text-white">
        {card.icon} {card.title}
      </div>
      <p className="text-white/50 mb-2">{card.desc}</p>
      <p className="text-white/50 mb-3">
        {card.freeNote}{' '}
        <span className="mono text-blue-400">{card.url}</span>
      </p>
      <a href="/settings/api" className="inline-flex items-center gap-1 text-xs rounded px-3 py-1.5 bg-blue-500 text-white no-underline">
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
    <div className="rounded-lg border p-3 text-xs bg-white/[0.015] border-white/[0.05]" style={{ borderLeft: `3px solid ${sevColor}` }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="rounded px-1.5 py-0.5 text-[10px] font-bold mono"
            style={{ background: `${sevColor}22`, color: sevColor }}>
            {sevLabel.toUpperCase()}
          </span>
          {event.event_type && (
            <span className="text-[10px] mono uppercase text-white/50">
              {event.event_type}
            </span>
          )}
        </div>
        <button onClick={onClose} className="shrink-0 opacity-50 hover:opacity-100 text-white/50">
          <X size={12} />
        </button>
      </div>

      <div className="font-medium mb-2 text-white" style={{ lineHeight: 1.4 }}>
        {event.title}
      </div>

      <div className="space-y-1 mb-3 text-white/50 font-mono">
        {(event.region || event.country_code) && (
          <div>📍 {event.region || event.country_code}</div>
        )}
        <div>🕐 {safeRelativeTime(event.occurred_at)}</div>
        {event.source && (
          <div>📡 {event.source.toUpperCase()}</div>
        )}
      </div>

      {snippet && (
        <p className="mb-3 text-[11px] leading-relaxed text-white/80">
          {snippet}
        </p>
      )}

      <a
        href={`/feed?eventId=${event.id}`}
        className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium bg-blue-500 text-white no-underline">
        View in Intel Feed <ExternalLink size={10} />
      </a>
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2 mt-4 first:mt-0 text-white/50">
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

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('globe')

  // Layer toggles
  const [showEvents, setShowEvents] = useState(true)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [showChoropleth, setShowChoropleth] = useState(true)
  const [showAttackArcs, setShowAttackArcs] = useState(true)
  const [showISS, setShowISS] = useState(true)
  const [showAircraft, setShowAircraft] = useState(false)
  const [showShippingLanes, setShowShippingLanes] = useState(false)

  // Filters
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('7d')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('')

  // UI state
  const [setupCard, setSetupCard] = useState<SetupCardKey | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<IntelEvent | null>(null)
  const [selectedIntelItem, setSelectedIntelItem] = useState<IntelItem | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch tracking data
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

  // Fetch intel events
  useEffect(() => {
    setLoading(true)
    void fetch(`/api/v1/events?window=${timeWindow}&limit=500`, { cache: 'no-store' })
      .then(r => r.json())
      .then((j: { data?: IntelEvent[] }) => {
        const events = (j.data ?? []).filter(e =>
          parseCoords(e.location) !== null || e.country_code || e.region
        )
        setAllIntelEvents(events)
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [timeWindow])

  // Apply filters
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

  // Layer toggles for 2D map
  const layerToggles = {
    vessels: false,
    flights: false,
    thermal: false,
    intel: showEvents,
    heatmap: showHeatmap,
  }

  return (
    <div className="grid h-full" style={{ gridTemplateColumns: '1fr 320px', gap: 0 }}>
      {/* ── Map / Globe area ──────────────────────────────────────────────── */}
      <div className="overflow-hidden relative bg-[#070B11]">

        {/* View toggle */}
        <div className="absolute top-3 right-3 z-20 flex rounded-lg overflow-hidden border border-white/[0.05] bg-black/90">
          <button
            onClick={() => setViewMode('globe')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${
              viewMode === 'globe' ? 'bg-blue-500 text-white' : 'text-white/50'
            }`}>
            <GlobeLucide size={12} />
            Globe
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${
              viewMode === 'map' ? 'bg-blue-500 text-white' : 'text-white/50'
            }`}>
            <MapLucide size={12} />
            Map
          </button>
        </div>

        {/* Globe view */}
        {viewMode === 'globe' && (
          <GlobeView
            events={showEvents ? filteredEvents : []}
            onEventClick={event => setSelectedEvent(event)}
            showAircraft={showAircraft}
            showShippingLanes={showShippingLanes}
            showHeatmap={showHeatmap}
            timeWindow={timeWindow}
            showChoropleth={showChoropleth}
            showAttackArcs={showAttackArcs}
            showISS={showISS}
          />
        )}

        {/* 2D map view */}
        {viewMode === 'map' && (
          <>
            <TrackingMap
              vessels={[]}
              flights={[]}
              thermals={[]}
              intelEvents={filteredEvents}
              layerToggles={layerToggles}
              onIntelClick={(event: IntelEvent) => setSelectedEvent(event)}
            />
            {filteredEvents.length > 0 && (
              <div className="absolute top-3 left-3 rounded-md px-2 py-1 text-xs mono pointer-events-none text-white border border-white/[0.05] bg-black/85">
                {filteredEvents.length} events · {timeWindow}
              </div>
            )}
            {loading && (
              <div className="absolute top-3 left-3 rounded-md px-2 py-1 text-xs mono text-white/50 border border-white/[0.05] bg-black/85">
                Loading…
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Right Panel ──────────────────────────────────────────────────── */}
      <div className="border-l border-white/[0.05] flex flex-col overflow-hidden bg-white/[0.015]">
        <div className="overflow-y-auto flex-1 px-3 py-3 space-y-0">

          {/* LAYERS */}
          <SectionLabel label="Layers" />
          <div className="space-y-1.5 mb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showEvents} onChange={e => setShowEvents(e.target.checked)}
                className="rounded accent-blue-500" />
              <span className="text-xs text-white">Conflict Events</span>
              <span className="ml-auto text-[10px] mono px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                {filteredEvents.length}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showHeatmap} onChange={e => setShowHeatmap(e.target.checked)}
                className="rounded accent-blue-500" />
              <span className="text-xs text-white">Heatmap view</span>
            </label>
            {viewMode === 'globe' && (
              <>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showChoropleth} onChange={e => setShowChoropleth(e.target.checked)}
                    className="rounded accent-blue-500" />
                  <span className="text-xs text-white">🗺 Risk Overlay</span>
                  <span className="ml-auto text-[9px] mono px-1 py-0.5 rounded bg-red-500/20 text-red-400">threat</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showAttackArcs} onChange={e => setShowAttackArcs(e.target.checked)}
                    className="rounded accent-blue-500" />
                  <span className="text-xs text-white">⚔ Attack Vectors</span>
                  <span className="ml-auto text-[9px] mono px-1 py-0.5 rounded bg-orange-500/20 text-orange-400">live</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showShippingLanes} onChange={e => setShowShippingLanes(e.target.checked)}
                    className="rounded accent-blue-500" />
                  <span className="text-xs text-white">Shipping Lanes</span>
                </label>
              </>
            )}
          </div>

          {/* FILTERS */}
          <SectionLabel label="Filters" />
          <div className="space-y-2 mb-1">
            {/* Time window */}
            <div>
              <div className="text-[10px] mb-1 text-white/50">Time window</div>
              <div className="flex gap-1">
                {(['24h', '7d', '30d'] as TimeWindow[]).map(w => (
                  <button key={w} onClick={() => setTimeWindow(w)}
                    className={`flex-1 rounded py-1 text-[11px] mono border transition-colors ${
                      timeWindow === w
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-transparent text-white/50 border-white/[0.05] hover:border-white/[0.08]'
                    }`}>
                    {w}
                  </button>
                ))}
              </div>
            </div>

            {/* Severity */}
            <div>
              <div className="text-[10px] mb-1 text-white/50">Severity</div>
              <div className="flex gap-1">
                {([['all', 'All'], ['high', 'High+'], ['critical', 'Crit']] as [SeverityFilter, string][]).map(([v, label]) => (
                  <button key={v} onClick={() => setSeverityFilter(v)}
                    className={`flex-1 rounded py-1 text-[11px] border transition-colors ${
                      severityFilter === v
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-transparent text-white/50 border-white/[0.05] hover:border-white/[0.08]'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div>
              <div className="text-[10px] mb-1 text-white/50">Category</div>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                className="w-full rounded border border-white/[0.06] px-2 py-1 text-xs bg-white/[0.03] text-white">
                {CATEGORY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Country */}
            <div>
              <div className="text-[10px] mb-1 text-white/50">Country / Region</div>
              <input
                type="text"
                placeholder="e.g. UA, Syria, Sahel…"
                value={countryFilter}
                onChange={e => setCountryFilter(e.target.value)}
                className="w-full rounded border border-white/[0.06] px-2 py-1 text-xs bg-white/[0.03] text-white placeholder:text-white/20" />
            </div>
          </div>

          {/* TRACKING LAYERS */}
          <SectionLabel label="Tracking Layers" />
          <div className="space-y-2 mb-1">

            {/* ── ISS Tracker (free, no key) ── */}
            {viewMode === 'globe' && (
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">🛸</span>
                  <span className="text-xs flex-1 text-white">
                    ISS Tracker
                  </span>
                  <span className="text-[9px] mono px-1 py-0.5 rounded mr-1 bg-purple-500/20 text-purple-400">
                    free
                  </span>
                  <button
                    onClick={() => setShowISS(prev => !prev)}
                    className={`w-8 h-4 rounded-full flex items-center transition-colors relative ${
                      showISS ? 'bg-purple-500' : 'bg-white/[0.1]'
                    }`}
                    style={{ flexShrink: 0 }}>
                    <div
                      className="w-3 h-3 rounded-full transition-transform bg-white"
                      style={{
                        transform: showISS ? 'translateX(18px)' : 'translateX(2px)',
                      }}
                    />
                  </button>
                </div>
                {/* ISS status chip */}
                {showISS && (
                  <div className="mt-1.5 ml-6 text-[10px] mono rounded px-2 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    🛸 Live position · updating every 5s
                  </div>
                )}
              </div>
            )}

            {/* ── Flights (OpenSky — free, functional) ── */}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm">✈</span>
                <span className="text-xs flex-1 text-white">
                  Live Flights
                </span>
                {/* Functional toggle */}
                <button
                  onClick={() => setShowAircraft(prev => !prev)}
                  className={`w-8 h-4 rounded-full flex items-center transition-colors relative ${
                    showAircraft ? 'bg-blue-500' : 'bg-white/[0.1]'
                  }`}
                  style={{ flexShrink: 0 }}
                  title="Toggle live aircraft via OpenSky Network">
                  <div
                    className="w-3 h-3 rounded-full transition-transform bg-white"
                    style={{
                      transform: showAircraft ? 'translateX(18px)' : 'translateX(2px)',
                    }}
                  />
                </button>
              </div>
              <div className="text-[10px] mt-0.5 ml-6 text-white/50">
                Powered by{' '}
                <a href="https://opensky-network.org" target="_blank" rel="noopener noreferrer"
                  className="text-blue-400 no-underline">
                  OpenSky Network
                </a>{' '}(free)
              </div>
            </div>

            {/* ── Vessels (requires AIS key) ── */}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm">⚓</span>
                <span className="text-xs flex-1 text-white/50">
                  Vessel tracking
                </span>
                <button
                  onClick={() => setSetupCard(prev => prev === 'vessels' ? null : 'vessels')}
                  className="text-[10px] rounded px-2 py-0.5 border border-white/[0.05] text-white/50 bg-transparent transition-colors">
                  Setup
                </button>
                {/* Disabled toggle */}
                <div className="w-8 h-4 rounded-full flex items-center opacity-30 cursor-not-allowed bg-white/[0.1]">
                  <div className="w-3 h-3 rounded-full mx-0.5 bg-white/50" />
                </div>
              </div>
              {setupCard === 'vessels' && (
                <SetupCard layerKey="vessels" onClose={() => setSetupCard(null)} />
              )}
            </div>

            {/* ── Thermal (requires FIRMS key) ── */}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm">🔥</span>
                <span className="text-xs flex-1 text-white/50">
                  Thermal anomalies
                </span>
                <button
                  onClick={() => setSetupCard(prev => prev === 'thermal' ? null : 'thermal')}
                  className="text-[10px] rounded px-2 py-0.5 border border-white/[0.05] text-white/50 bg-transparent transition-colors">
                  Setup
                </button>
                {/* Disabled toggle */}
                <div className="w-8 h-4 rounded-full flex items-center opacity-30 cursor-not-allowed bg-white/[0.1]">
                  <div className="w-3 h-3 rounded-full mx-0.5 bg-white/50" />
                </div>
              </div>
              {setupCard === 'thermal' && (
                <SetupCard layerKey="thermal" onClose={() => setSetupCard(null)} />
              )}
            </div>

          </div>

          {/* SELECTED EVENT */}
          <SectionLabel label="Selected Event" />
          {selectedEvent ? (
            <SelectedEventPanel
              event={selectedEvent}
              onClose={() => setSelectedEvent(null)}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-white/[0.05] py-6 text-center text-xs text-white/50">
              <div className="mb-1 text-lg">{viewMode === 'globe' ? '🌐' : '🗺'}</div>
              Click a marker to<br />view event details
            </div>
          )}

        </div>
      </div>

      {/* Intel drawer */}
      <IntelDrawer
        item={selectedIntelItem}
        items={intelItems}
        onClose={() => setSelectedIntelItem(null)}
        onNavigate={item => setSelectedIntelItem(item)}
      />
    </div>
  )
}
