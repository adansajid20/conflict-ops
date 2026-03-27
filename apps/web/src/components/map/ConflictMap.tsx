'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { eventToIntelItem, safeTimeAgo, severityColor, type IntelItem } from '@/types/intel-item'
import { IntelDrawer } from '@/components/intel/IntelDrawer'

let maplibregl: typeof import('maplibre-gl') | null = null

// Country centroid fallback [lng, lat] — for events without coordinates
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  UA:[31.2,48.4],RU:[60.0,60.0],SY:[38.5,35.0],YE:[47.5,15.5],SD:[30.0,15.0],
  SS:[31.3,7.9],ET:[40.0,9.1],LY:[17.2,27.0],IQ:[44.4,33.2],AF:[67.7,33.9],
  MM:[95.9,21.9],CD:[23.7,-2.9],SO:[46.2,5.2],ML:[2.6,17.6],BF:[-1.6,12.4],
  NE:[8.1,17.6],CF:[21.0,7.0],MZ:[35.5,-18.7],NG:[8.7,9.1],CM:[12.4,5.7],
  PS:[35.2,31.9],IL:[34.9,31.5],LB:[35.9,33.9],IR:[53.7,32.4],PK:[69.3,30.4],
  IN:[78.9,20.6],CN:[104.2,35.9],EG:[30.8,26.8],SA:[45.0,24.0],TR:[35.2,38.9],
  US:[-98.0,39.5],GB:[-2.0,54.4],FR:[2.3,46.2],DE:[10.4,51.2],VE:[-66.6,8.0],
  CO:[-74.3,4.6],MX:[-102.6,23.6],BR:[-51.9,-14.2],ZA:[25.1,-29.0],KE:[37.9,0.0],
  TN:[9.5,33.9],DZ:[3.0,28.0],MA:[-7.1,31.8],KP:[127.5,40.3],AU:[133.8,-25.3],
  IS:[34.9,31.5],GH:[-1.0,7.9],TW:[121.0,23.7],GE:[43.4,42.3],
}

type RawEvent = {
  id: string; title: string; event_type: string | null; severity: number | null
  status: string; country_code: string | null; region: string | null
  source: string; occurred_at: string; ingested_at: string
  description: string | null; location: unknown
  provenance_raw?: Record<string, unknown>
}

function parseLocation(location: unknown): [number, number] | null {
  if (!location) return null
  if (typeof location === 'object' && location !== null) {
    const geo = location as Record<string, unknown>
    if (Array.isArray(geo.coordinates) && geo.coordinates.length >= 2) {
      const [lng, lat] = geo.coordinates as [number, number]
      if (isFinite(lng) && isFinite(lat)) return [lng, lat]
    }
  }
  return null
}

function getCoords(event: RawEvent): [number, number] | null {
  const geo = parseLocation(event.location)
  if (geo) return geo
  if (event.country_code) return COUNTRY_CENTROIDS[event.country_code] ?? null
  return null
}

const SEV_COLORS = ['#10B981','#3B82F6','#F59E0B','#EF4444','#FF0000']

function buildGeoJSON(events: RawEvent[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  for (const e of events) {
    const coords = getCoords(e)
    if (!coords) continue
    const sev = e.severity ?? 1
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: coords },
      properties: {
        id: e.id, title: e.title, severity: sev,
        color: SEV_COLORS[(sev - 1)] ?? SEV_COLORS[0],
        source: e.source, country_code: e.country_code ?? '',
        region: e.region ?? '', occurred_at: e.occurred_at,
        is_centroid: !parseLocation(e.location),
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

// Filter panel
type Filters = {
  severity: number | null
  source: string | null
  country: string | null
  window_h: number
}

const WINDOWS = [
  { label: '1H', h: 1 }, { label: '6H', h: 6 }, { label: '24H', h: 24 },
  { label: '7D', h: 168 }, { label: '30D', h: 720 },
]

function applyFilters(events: RawEvent[], f: Filters): RawEvent[] {
  const cutoff = f.window_h > 0
    ? new Date(Date.now() - f.window_h * 3600000).toISOString()
    : null
  return events.filter(e => {
    if (cutoff && e.occurred_at < cutoff) return false
    if (f.severity && e.severity !== f.severity) return false
    if (f.source && e.source !== f.source) return false
    if (f.country && e.country_code !== f.country) return false
    return true
  })
}

export function ConflictMap({ className = '' }: { className?: string }) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('maplibre-gl').Map | null>(null)
  const isInitialized = useRef(false)

  const [allEvents, setAllEvents] = useState<RawEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [selectedItem, setSelectedItem] = useState<IntelItem | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [showList, setShowList] = useState(false)
  const [filters, setFilters] = useState<Filters>({ severity: null, source: null, country: null, window_h: 168 })

  const filtered = applyFilters(allEvents, filters)
  const withCoords = filtered.filter(e => getCoords(e) !== null)

  // Unique sources and countries for filter dropdowns
  const sources = [...new Set(allEvents.map(e => e.source))].sort()
  const countries = [...new Set(allEvents.map(e => e.country_code).filter(Boolean) as string[])].sort()

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/events/geo', { cache: 'no-store' })
      if (!res.ok) return
      const d = await res.json() as { ok?: boolean; data?: RawEvent[] }
      setAllEvents(d.data ?? [])
    } catch { /* keep existing */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    void fetchEvents()
    const id = setInterval(() => void fetchEvents(), 120_000)
    return () => clearInterval(id)
  }, [fetchEvents])

  // Init map
  useEffect(() => {
    if (isInitialized.current || !mapContainer.current) return
    const initMap = async () => {
      maplibregl = await import('maplibre-gl')
      if (!mapContainer.current || isInitialized.current) return
      isInitialized.current = true

      const map = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: { 'osm': { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors' } },
          layers: [{ id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-saturation': -0.88, 'raster-brightness-min': 0.06, 'raster-brightness-max': 0.32 } }],
        },
        center: [20, 15], zoom: 2, attributionControl: false,
      })
      mapRef.current = map

      map.on('load', () => {
        setMapLoaded(true)
        map.addSource('events', { type: 'geojson', data: buildGeoJSON([]), cluster: true, clusterMaxZoom: 8, clusterRadius: 50 })

        map.addLayer({ id: 'clusters', type: 'circle', source: 'events', filter: ['has', 'point_count'],
          paint: { 'circle-color': '#00FF88', 'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 30], 'circle-opacity': 0.75 } })
        map.addLayer({ id: 'cluster-count', type: 'symbol', source: 'events', filter: ['has', 'point_count'],
          layout: { 'text-field': '{point_count_abbreviated}', 'text-font': ['Open Sans Bold'], 'text-size': 11 },
          paint: { 'text-color': '#080A0E' } })
        map.addLayer({ id: 'points', type: 'circle', source: 'events', filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': ['get', 'color'],
            'circle-radius': ['case', ['get', 'is_centroid'], 5, 7],
            'circle-stroke-width': ['case', ['get', 'is_centroid'], 1, 2],
            'circle-stroke-color': ['case', ['get', 'is_centroid'], 'rgba(255,255,255,0.3)', 'rgba(0,0,0,0.6)'],
            'circle-opacity': ['case', ['get', 'is_centroid'], 0.6, 0.9],
          } })

        map.on('mouseenter', 'points', () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', 'points', () => { map.getCanvas().style.cursor = '' })
        map.on('click', 'points', (e) => {
          const f = e.features?.[0]
          if (!f?.properties) return
          const p = f.properties as Record<string, unknown>
          const raw = allEvents.find(ev => ev.id === String(p.id))
          if (raw) setSelectedItem(eventToIntelItem(raw as Record<string, unknown>))
        })
        map.on('click', 'clusters', (e) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })
          const clusterId = features[0]?.properties?.cluster_id as number | undefined
          if (clusterId !== undefined) {
            const src = map.getSource('events') as import('maplibre-gl').GeoJSONSource
            src.getClusterExpansionZoom(clusterId)
              .then((zoom: number) => {
                if (e.lngLat) map.easeTo({ center: e.lngLat, zoom })
              })
              .catch(() => { /* ignore */ })
          }
        })
      })
    }
    void initMap()
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; isInitialized.current = false }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update map when filtered events change
  useEffect(() => {
    const updateSource = () => {
      const src = mapRef.current?.getSource('events') as import('maplibre-gl').GeoJSONSource | undefined
      if (src) src.setData(buildGeoJSON(withCoords))
      else setTimeout(updateSource, 300)
    }
    updateSource()
  }, [withCoords.length, filters]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredItems = withCoords.map(e => eventToIntelItem(e as Record<string, unknown>))

  return (
    <div className="relative w-full h-full flex" style={{ backgroundColor: 'var(--bg-base)' }}>
      {/* Filter sidebar */}
      {showFilters && (
        <div className="w-56 shrink-0 border-r overflow-y-auto p-3 space-y-4"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="text-xs mono font-bold tracking-widest" style={{ color: 'var(--text-muted)' }}>FILTERS</div>

          {/* Time window */}
          <div>
            <div className="text-xs mono mb-1.5" style={{ color: 'var(--text-muted)', fontSize: 10 }}>WINDOW</div>
            <div className="flex flex-wrap gap-1">
              {WINDOWS.map(w => (
                <button key={w.h} onClick={() => setFilters(f => ({ ...f, window_h: w.h }))}
                  className="px-2 py-0.5 text-xs mono rounded transition-colors"
                  style={{
                    backgroundColor: filters.window_h === w.h ? 'rgba(0,255,136,0.15)' : 'transparent',
                    color: filters.window_h === w.h ? 'var(--primary)' : 'var(--text-muted)',
                    border: `1px solid ${filters.window_h === w.h ? 'rgba(0,255,136,0.3)' : 'var(--border)'}`,
                  }}>{w.label}</button>
              ))}
            </div>
          </div>

          {/* Severity */}
          <div>
            <div className="text-xs mono mb-1.5" style={{ color: 'var(--text-muted)', fontSize: 10 }}>SEVERITY</div>
            <div className="space-y-0.5">
              {[null, 1, 2, 3, 4, 5].map(sev => (
                <button key={sev ?? 'all'} onClick={() => setFilters(f => ({ ...f, severity: sev }))}
                  className="w-full text-left px-2 py-1 rounded text-xs mono transition-colors hover:bg-white/5"
                  style={{
                    color: filters.severity === sev ? 'var(--text-primary)' : 'var(--text-muted)',
                    backgroundColor: filters.severity === sev ? 'rgba(255,255,255,0.08)' : 'transparent',
                  }}>
                  {sev === null ? 'All' : `${sev} — ${['LOW','ELEVATED','HIGH','CRITICAL','CRITICAL+'][sev-1]}`}
                </button>
              ))}
            </div>
          </div>

          {/* Source */}
          <div>
            <div className="text-xs mono mb-1.5" style={{ color: 'var(--text-muted)', fontSize: 10 }}>SOURCE</div>
            <div className="space-y-0.5">
              {[null, ...sources].map(src => (
                <button key={src ?? 'all'} onClick={() => setFilters(f => ({ ...f, source: src }))}
                  className="w-full text-left px-2 py-1 rounded text-xs mono transition-colors hover:bg-white/5"
                  style={{ color: filters.source === src ? 'var(--primary)' : 'var(--text-muted)', backgroundColor: filters.source === src ? 'rgba(0,255,136,0.08)' : 'transparent' }}>
                  {src ?? 'All sources'}
                </button>
              ))}
            </div>
          </div>

          {/* Country */}
          <div>
            <div className="text-xs mono mb-1.5" style={{ color: 'var(--text-muted)', fontSize: 10 }}>COUNTRY</div>
            <select
              value={filters.country ?? ''}
              onChange={e => setFilters(f => ({ ...f, country: e.target.value || null }))}
              className="w-full text-xs mono p-1 rounded"
              style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
              <option value="">All countries</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <button onClick={() => setFilters({ severity: null, source: null, country: null, window_h: 168 })}
            className="w-full text-xs mono py-1 rounded border transition-colors hover:bg-white/5"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
            RESET FILTERS
          </button>
        </div>
      )}

      {/* Map area */}
      <div className="relative flex-1 min-w-0">
        <div ref={mapContainer} className={`w-full h-full ${className}`} />
        {!mapLoaded && <motion.div initial={{ opacity: 1 }} animate={{ opacity: mapLoaded ? 0 : 1 }} exit={{ opacity: 0 }} style={{ position:'absolute', inset:0, background:'var(--bg-base)', zIndex:10, display:'flex', alignItems:'center', justifyContent:'center' }}><div style={{ color:'var(--text-muted)', fontSize:14 }}>Loading map...</div></motion.div>}

        {/* Top bar */}
        <div className="absolute top-3 left-3 right-3 flex items-center gap-2 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2">
            <button onClick={() => setShowFilters(f => !f)}
              className="px-3 py-1.5 text-xs mono rounded transition-colors"
              style={{
                backgroundColor: showFilters ? 'rgba(0,255,136,0.15)' : 'rgba(8,10,14,0.85)',
                color: showFilters ? 'var(--primary)' : 'var(--text-muted)',
                border: `1px solid ${showFilters ? 'rgba(0,255,136,0.3)' : 'var(--border)'}`,
              }}>
              ⊟ FILTERS
            </button>
            <button onClick={() => setShowList(l => !l)}
              className="px-3 py-1.5 text-xs mono rounded transition-colors"
              style={{
                backgroundColor: showList ? 'rgba(0,255,136,0.15)' : 'rgba(8,10,14,0.85)',
                color: showList ? 'var(--primary)' : 'var(--text-muted)',
                border: `1px solid ${showList ? 'rgba(0,255,136,0.3)' : 'var(--border)'}`,
              }}>
              ▤ LIST
            </button>
          </div>
          <div className="ml-auto pointer-events-auto px-2 py-1 rounded text-xs mono"
            style={{ backgroundColor: 'rgba(8,10,14,0.85)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            {loading ? 'LOADING...' : `${withCoords.length} EVENTS`}
          </div>
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 px-2 py-1.5 rounded text-xs mono space-y-1"
          style={{ backgroundColor: 'rgba(8,10,14,0.85)', border: '1px solid var(--border)' }}>
          {['LOW','ELEVATED','HIGH','CRITICAL'].map((l, i) => (
            <div key={l} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: SEV_COLORS[i] }} />
              <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>{l}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 pt-0.5 border-t" style={{ borderColor: 'var(--border)' }}>
            <span className="w-2 h-2 rounded-full inline-block border" style={{ backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.3)' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>COUNTRY ≈</span>
          </div>
        </div>

        {/* List view overlay */}
        {showList && (
          <div className="absolute top-12 right-3 bottom-3 w-80 rounded overflow-hidden flex flex-col"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <div className="px-3 py-2 border-b text-xs mono font-bold flex items-center justify-between shrink-0"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <span>INTEL LIST ({filteredItems.length})</span>
              <button onClick={() => setShowList(false)} style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredItems.length === 0 ? (
                <div className="p-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                  No events match current filters
                </div>
              ) : filteredItems.map(item => (
                <button key={item.id} onClick={() => setSelectedItem(item)}
                  className="w-full text-left border-b px-3 py-2 hover:bg-white/5 transition-colors"
                  style={{ borderColor: 'var(--border)', display: 'block' }}>
                  <div className="text-xs font-bold truncate mb-0.5" style={{ color: 'var(--text-primary)' }}>{item.title}</div>
                  <div className="text-xs mono flex items-center gap-2" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                    <span style={{ color: SEV_COLORS[(item.severity ?? 1) - 1] }}>●</span>
                    <span>{item.source}</span>
                    {item.country_code && <span>{item.country_code}</span>}
                    <span className="ml-auto">{safeTimeAgo(item.occurred_at ?? item.ingested_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && withCoords.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center px-6 py-4 rounded" style={{ backgroundColor: 'rgba(8,10,14,0.85)', border: '1px solid var(--border)' }}>
              <div className="text-2xl mb-2 opacity-30">⊞</div>
              <div className="text-xs mono font-bold mb-1" style={{ color: 'var(--text-primary)' }}>NO EVENTS IN RANGE</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Expand filters or run ingest</div>
            </div>
          </div>
        )}
      </div>

      {/* Intel drawer */}
      <IntelDrawer
        item={selectedItem}
        items={filteredItems}
        onClose={() => setSelectedItem(null)}
        onNavigate={setSelectedItem}
      />
    </div>
  )
}
