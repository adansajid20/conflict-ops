'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

interface EventProps {
  id: string
  title: string
  severity: string
  category: string
  region: string
  summary?: string
  publishedAt?: string
  isBreaking?: boolean
}

const SATELLITE_STYLE = {
  version: 8,
  name: 'ConflictRadar Satellite',
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    'esri-satellite': {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: '© Esri',
      maxzoom: 18,
    },
  },
  layers: [
    {
      id: 'esri-satellite-layer',
      type: 'raster',
      source: 'esri-satellite',
      paint: {
        'raster-brightness-min': 0.0,
        'raster-brightness-max': 0.85,
        'raster-contrast': 0.15,
        'raster-saturation': -0.2,
        'raster-fade-duration': 300,
      },
    },
  ],
} as unknown as maplibregl.StyleSpecification

export default function OperationalMap() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const animRef = useRef<number | null>(null)
  const issMarkerRef = useRef<maplibregl.Marker | null>(null)

  const [mapMode, setMapMode] = useState<'globe' | 'map'>('globe')
  const [eventCount, setEventCount] = useState(0)
  const [selected, setSelected] = useState<EventProps | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [layers, setLayers] = useState({
    conflictEvents: true,
    heatmap: false,
    riskOverlay: true,
    attackVectors: true,
  })

  const [filters, setFilters] = useState({
    timeWindow: '7d',
    severity: 'all',
    category: 'all',
    region: '',
  })

  const [tracking, setTracking] = useState({
    iss: true,
    flights: false,
    vessels: false,
  })

  // ── ISS ────────────────────────────────────────────────────────────────────
  const updateISS = useCallback(async () => {
    if (!mapRef.current) return
    try {
      const d = await fetch('https://api.wheretheiss.at/v1/satellites/25544').then(r => r.json()) as { longitude: number; latitude: number; altitude: number; velocity: number }
      if (!issMarkerRef.current && mapRef.current) {
        const el = document.createElement('div')
        el.style.cssText = 'width:12px;height:12px;background:#a855f7;border-radius:50%;border:2px solid #c084fc;box-shadow:0 0 8px #a855f7;cursor:pointer;'
        issMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([d.longitude, d.latitude])
          .setPopup(new maplibregl.Popup({ offset: 14, closeButton: false }).setHTML(
            `<div style="background:#111827;color:#e2e8f0;padding:10px 12px;font-size:11px;font-family:monospace;"><b style="color:#c084fc">🛸 ISS LIVE</b><br>Alt: ${Math.round(d.altitude)} km<br>Speed: ${Math.round(d.velocity).toLocaleString()} km/h</div>`
          ))
          .addTo(mapRef.current)
      } else issMarkerRef.current?.setLngLat([d.longitude, d.latitude])
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    if (!tracking.iss) { issMarkerRef.current?.remove(); issMarkerRef.current = null; return }
    void updateISS()
    const iv = setInterval(() => void updateISS(), 5000)
    return () => clearInterval(iv)
  }, [tracking.iss, updateISS])

  // ── Fetch events — API returns GeoJSON FeatureCollection ─────────────────
  const fetchEvents = useCallback(async (f: typeof filters) => {
    try {
      const timeMap: Record<string, number> = { '24h': 24, '7d': 168, '30d': 720 }
      const hours = timeMap[f.timeWindow] ?? 168
      let url = `/api/v1/map/events?hours=${hours}&limit=500`
      if (f.severity !== 'all') url += `&severity=${f.severity}`
      if (f.category !== 'all') url += `&category=${f.category}`
      if (f.region) url += `&region=${encodeURIComponent(f.region)}`

      const res = await fetch(url)
      // API returns a GeoJSON FeatureCollection directly
      const geojson = await res.json() as GeoJSON.FeatureCollection & { meta?: { total: number } }

      setEventCount(geojson.meta?.total ?? geojson.features?.length ?? 0)

      // Pass GeoJSON directly to MapLibre source
      const src = mapRef.current?.getSource('events-source') as maplibregl.GeoJSONSource | undefined
      src?.setData(geojson)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    if (mapRef.current) void fetchEvents(filters)
  }, [filters, fetchEvents])

  // ── Layer visibility ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current; if (!map) return
    const vis = (id: string, v: boolean) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v ? 'visible' : 'none') }
    vis('events-layer', layers.conflictEvents)
    vis('events-pulse', layers.conflictEvents)
    vis('events-heatmap', layers.heatmap)
    vis('risk-overlay-layer', layers.riskOverlay)
    vis('attack-vectors-layer', layers.attackVectors)
  }, [layers])

  useEffect(() => {
    const map = mapRef.current; if (!map) return
    const vis = (id: string, v: boolean) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v ? 'visible' : 'none') }
    vis('flights-layer', tracking.flights)
    vis('vessels-layer', tracking.vessels)
  }, [tracking])

  // ── Globe ↔ Map ──────────────────────────────────────────────────────────────
  const toggleMapMode = useCallback(() => {
    const map = mapRef.current; if (!map) return
    const next = mapMode === 'globe' ? 'mercator' : 'globe'
    try { ;(map as unknown as { setProjection: (p: {type:string}) => void }).setProjection({ type: next }) } catch { /* ignore */ }
    map.easeTo({ zoom: next === 'globe' ? 1.8 : 2, pitch: 0, duration: 1000 })
    setMapMode(next === 'globe' ? 'globe' : 'map')
  }, [mapMode])

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: SATELLITE_STYLE,
      center: [30, 20],
      zoom: 1.8,
      minZoom: 1,
      maxZoom: 18,
      attributionControl: false,
      fadeDuration: 0,
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'top-left')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')

    map.on('style.load', () => {
      try { ;(map as unknown as { setProjection: (p:unknown) => void }).setProjection({ type: 'globe' }) } catch { /* ignore */ }
      try {
        ;(map as unknown as { setFog: (f:unknown) => void }).setFog({
          'color': 'rgb(8, 12, 18)', 'high-color': 'rgb(15, 25, 55)',
          'horizon-blend': 0.06, 'space-color': 'rgb(2, 3, 12)', 'star-intensity': 1.0,
        })
      } catch { /* ignore */ }

      mapRef.current = map
      setIsLoading(false)

      const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
      map.addSource('events-source', { type: 'geojson', data: empty })
      map.addSource('attack-vectors-source', { type: 'geojson', data: empty })
      map.addSource('risk-overlay-source', { type: 'geojson', data: empty })
      map.addSource('flights-source', { type: 'geojson', data: empty })
      map.addSource('vessels-source', { type: 'geojson', data: empty })

      // Heatmap
      map.addLayer({ id: 'events-heatmap', type: 'heatmap', source: 'events-source', maxzoom: 8, layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': ['match', ['get', 'severity'], 'critical', 1.0, 'high', 0.7, 'medium', 0.4, 0.2],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.5, 8, 2],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 8, 8, 30],
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.4, 'rgba(253,219,93,0.6)', 1.0, 'rgba(178,24,43,0.9)'],
        },
      })
      // Risk fill
      map.addLayer({ id: 'risk-overlay-layer', type: 'fill', source: 'risk-overlay-source',
        paint: { 'fill-color': ['match', ['get', 'risk_level'], 'critical', '#ef444440', 'high', '#f9731640', '#00000000'], 'fill-opacity': 0.3 },
      })
      // Attack vectors
      map.addLayer({ id: 'attack-vectors-layer', type: 'line', source: 'attack-vectors-source',
        paint: { 'line-color': '#ef4444', 'line-width': 1.5, 'line-opacity': 0.6, 'line-dasharray': [4, 4] },
      })
      // Critical pulse
      map.addLayer({ id: 'events-pulse', type: 'circle', source: 'events-source',
        filter: ['==', ['get', 'severity'], 'critical'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 14, 5, 22, 10, 32],
          'circle-color': '#ef4444', 'circle-opacity': 0.12,
          'circle-stroke-width': 1.5, 'circle-stroke-color': '#ef4444', 'circle-stroke-opacity': 0.25,
        },
      })
      // Event dots
      map.addLayer({ id: 'events-layer', type: 'circle', source: 'events-source',
        paint: {
          'circle-radius': ['match', ['get', 'severity'], 'critical', 7, 'high', 5.5, 'medium', 4.5, 'low', 3.5, 4],
          'circle-color': ['match', ['get', 'severity'], 'critical', '#ef4444', 'high', '#f97316', 'medium', '#eab308', '#6b7280'],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': ['match', ['get', 'severity'], 'critical', '#fca5a5', 'high', '#fdba74', 'medium', '#fde047', '#9ca3af'],
          'circle-opacity': 0.9,
        },
      })
      // Flights / Vessels
      map.addLayer({ id: 'flights-layer', type: 'circle', source: 'flights-source', layout: { visibility: 'none' },
        paint: { 'circle-radius': 4, 'circle-color': ['case', ['boolean', ['get', 'is_military'], false], '#ef4444', '#60a5fa'], 'circle-stroke-width': 1, 'circle-stroke-color': '#fff', 'circle-opacity': 0.9 },
      })
      map.addLayer({ id: 'vessels-layer', type: 'circle', source: 'vessels-source', layout: { visibility: 'none' },
        paint: { 'circle-radius': 3, 'circle-color': ['case', ['boolean', ['get', 'is_dark'], false], '#ef4444', '#34d399'], 'circle-stroke-width': 1, 'circle-stroke-color': '#fff', 'circle-opacity': 0.8 },
      })

      // Click
      map.on('click', 'events-layer', e => {
        const f = (e.features as maplibregl.MapGeoJSONFeature[] | undefined)?.[0]
        if (f) setSelected(f.properties as EventProps)
      })
      map.on('mouseenter', 'events-layer', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'events-layer', () => { map.getCanvas().style.cursor = '' })

      // Auto-rotation
      let interacting = false
      map.on('mousedown', () => { interacting = true })
      map.on('mouseup', () => { interacting = false })
      map.on('dragend', () => { interacting = false })
      map.on('touchstart', () => { interacting = true })
      map.on('touchend', () => { interacting = false })
      const spin = () => {
        if (!mapRef.current) return
        if (!interacting && mapRef.current.getZoom() < 4) {
          const c = mapRef.current.getCenter(); c.lng += 0.3
          mapRef.current.easeTo({ center: c, duration: 1000, easing: t => t })
        }
        animRef.current = requestAnimationFrame(spin)
      }
      spin()

      void fetchEvents(filters)
    })

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      issMarkerRef.current?.remove(); issMarkerRef.current = null
      map.remove(); mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const freshness = (d?: string) => {
    if (!d) return ''
    const m = (Date.now() - new Date(d).getTime()) / 60000
    if (m < 30) return 'BREAKING'
    if (m < 120) return 'FRESH'
    if (m < 1440) return '24H'
    return 'ARCHIVED'
  }

  const Toggle = ({ on, onChange }: { on: boolean; onChange: () => void }) => (
    <button onClick={onChange} className={`w-8 h-4 rounded-full relative transition-colors shrink-0 ${on ? 'bg-blue-600' : 'bg-gray-700'}`}>
      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  )

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* MAP */}
      <div ref={mapContainer} className="absolute inset-0 z-0" />

      {/* GLOBE ↔ MAP TOGGLE */}
      <div className="absolute top-4 right-[292px] z-10">
        <div className="flex bg-gray-900/90 border border-gray-700 rounded-lg overflow-hidden backdrop-blur-sm">
          {(['globe','map'] as const).map(m => (
            <button key={m} onClick={() => { if (mapMode !== m) toggleMapMode() }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${mapMode === m ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
              {m === 'globe' ? '🌐 Globe' : '🗺️ Map'}
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT SIDEBAR — full height, independently scrollable */}
      <div className="absolute top-0 right-0 bottom-0 w-[280px] z-10"
        style={{ background: 'linear-gradient(to left, rgba(3,7,18,0.97) 70%, rgba(3,7,18,0.85) 90%, transparent 100%)' }}>
        <div className="h-full overflow-y-auto overflow-x-hidden px-3 py-4 space-y-3"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(75,85,99,0.5) transparent' }}>

          {/* LAYERS */}
          <div className="bg-gray-900/80 border border-gray-700/60 rounded-lg p-3">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Layers</h3>
            {([
              { key: 'conflictEvents', label: 'Conflict Events', count: eventCount },
              { key: 'heatmap', label: 'Heatmap View' },
              { key: 'riskOverlay', label: '🟥 Risk Overlay', badge: 'threat' },
              { key: 'attackVectors', label: '✕ Attack Vectors', badge: 'live' },
            ] as {key:string;label:string;count?:number;badge?:string}[]).map(({ key, label, count, badge }) => (
              <label key={key} className="flex items-center justify-between py-1 cursor-pointer group">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={layers[key as keyof typeof layers]}
                    onChange={() => setLayers(p => ({ ...p, [key]: !p[key as keyof typeof layers] }))}
                    className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-0" />
                  <span className="text-xs text-gray-300 group-hover:text-white">{label}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {count != null && <span className="text-[10px] font-mono text-red-400">{count}</span>}
                  {badge === 'threat' && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-orange-600/30 text-orange-400 border border-orange-600/50">threat</span>}
                  {badge === 'live' && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-green-600/30 text-green-400 border border-green-600/50">live</span>}
                </div>
              </label>
            ))}
          </div>

          {/* FILTERS */}
          <div className="bg-gray-900/80 border border-gray-700/60 rounded-lg p-3">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Filters</h3>
            <div className="mb-2">
              <div className="text-[10px] text-gray-500 mb-1">Time window</div>
              <div className="flex gap-1">
                {['24h','7d','30d'].map(tw => (
                  <button key={tw} onClick={() => setFilters(p => ({ ...p, timeWindow: tw }))}
                    className={`flex-1 px-2 py-1.5 text-xs rounded border ${filters.timeWindow === tw ? 'bg-blue-600/30 border-blue-500 text-blue-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}>
                    {tw}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-2">
              <div className="text-[10px] text-gray-500 mb-1">Severity</div>
              <div className="flex gap-1">
                {[{v:'all',l:'All'},{v:'high',l:'High+'},{v:'critical',l:'Crit'}].map(s => (
                  <button key={s.v} onClick={() => setFilters(p => ({ ...p, severity: s.v }))}
                    className={`flex-1 px-2 py-1.5 text-xs rounded border ${filters.severity === s.v ? 'bg-blue-600/30 border-blue-500 text-blue-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}>
                    {s.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-2">
              <div className="text-[10px] text-gray-500 mb-1">Category</div>
              <select value={filters.category} onChange={e => setFilters(p => ({ ...p, category: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs rounded border border-gray-700 bg-gray-800 text-gray-300 focus:outline-none focus:border-blue-500">
                {['all','conflict','political','humanitarian','military','terrorism','cyber','maritime','nuclear','economic','diplomatic'].map(c => (
                  <option key={c} value={c}>{c === 'all' ? 'All categories' : c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 mb-1">Country / Region</div>
              <input type="text" value={filters.region} onChange={e => setFilters(p => ({ ...p, region: e.target.value }))}
                placeholder="e.g. UA, Syria, Sahel..."
                className="w-full px-2 py-1.5 text-xs rounded border border-gray-700 bg-gray-800 text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500" />
            </div>
          </div>

          {/* TRACKING */}
          <div className="bg-gray-900/80 border border-gray-700/60 rounded-lg p-3">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Tracking Layers</h3>
            {([
              { key: 'iss', icon: '🛸', label: 'ISS Tracker', sub: tracking.iss ? '🟣 Live · every 5s' : 'International Space Station', badge: 'free' },
              { key: 'flights', icon: '✈️', label: 'Live Flights', sub: 'OpenSky Network' },
              { key: 'vessels', icon: '🚢', label: 'Vessel Tracking' },
            ] as {key:string;icon:string;label:string;sub?:string;badge?:string}[]).map(item => (
              <div key={item.key} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{item.icon}</span>
                  <div>
                    <div className="text-xs text-gray-300">{item.label}</div>
                    {item.sub && <div className={`text-[10px] mt-0.5 ${item.key === 'iss' && tracking.iss ? 'text-purple-400' : 'text-gray-500'}`}>{item.sub}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {item.badge && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-gray-700 text-gray-400">{item.badge}</span>}
                  <Toggle on={tracking[item.key as keyof typeof tracking]} onChange={() => setTracking(p => ({ ...p, [item.key]: !p[item.key as keyof typeof tracking] }))} />
                </div>
              </div>
            ))}
          </div>

          {/* SELECTED EVENT */}
          <div className="bg-gray-900/80 border border-gray-700/60 rounded-lg p-3">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Selected Event</h3>
            {selected ? (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${selected.severity === 'critical' ? 'bg-red-500 animate-pulse' : selected.severity === 'high' ? 'bg-orange-500' : selected.severity === 'medium' ? 'bg-yellow-500' : 'bg-gray-500'}`} />
                  <span className="text-[10px] font-bold uppercase text-gray-400">{selected.severity}</span>
                  <span className="text-[10px] text-gray-500 ml-auto">{freshness(selected.publishedAt)}</span>
                </div>
                <p className="text-xs text-white font-medium leading-tight mb-1.5">{selected.title}</p>
                {selected.summary && <p className="text-[11px] text-gray-400 leading-relaxed mb-2">{selected.summary}</p>}
                <div className="text-[10px] text-gray-500">{selected.region} · {selected.category}</div>
                <button onClick={() => setSelected(null)} className="mt-2 text-[10px] text-gray-600 hover:text-gray-300">✕ Dismiss</button>
              </div>
            ) : (
              <div className="flex flex-col items-center py-4 text-gray-600">
                <div className="text-2xl mb-1">🌐</div>
                <p className="text-xs">Click a marker to view details</p>
              </div>
            )}
          </div>

          {/* Spacer so last panel isn't cut off */}
          <div className="h-20" />
        </div>
      </div>

      {/* SEVERITY LEGEND — bottom left */}
      <div className="absolute bottom-8 left-14 z-10 bg-gray-900/90 border border-gray-700 rounded-lg p-3 backdrop-blur-sm">
        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Severity</h3>
        {[['#ef4444','Critical'],['#f97316','High'],['#eab308','Medium'],['#6b7280','Low']].map(([c,l]) => (
          <div key={l} className="flex items-center gap-2 py-0.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c }} />
            <span className="text-[11px] text-gray-400">{l}</span>
          </div>
        ))}
        <div className="mt-1 pt-1 border-t border-gray-700">
          <div className="flex items-center gap-2 py-0.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
            <span className="text-[11px] text-gray-400">ISS live</span>
          </div>
        </div>
      </div>

      {/* HINT */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="bg-gray-900/70 border border-gray-700 rounded-lg px-3 py-1.5 text-[10px] text-gray-500 backdrop-blur-sm whitespace-nowrap">
          Click marker · Drag to rotate · Scroll to zoom
        </div>
      </div>

      {/* CO-PILOT */}
      <div className="absolute bottom-8 right-[292px] z-10">
        <button className="flex items-center gap-2 px-4 py-2.5 bg-gray-900/90 border border-gray-700 rounded-lg text-white text-xs font-medium hover:bg-gray-800 backdrop-blur-sm transition-colors">
          🤖 Intel Co-pilot
        </button>
      </div>

      {/* VIGNETTE */}
      <div className="absolute inset-0 z-[5] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.4) 100%)' }} />

      {/* LOADING */}
      {isLoading && (
        <div className="absolute inset-0 bg-black flex items-center justify-center z-20">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-400 text-xs font-mono tracking-widest">INITIALIZING OPERATIONAL MAP...</p>
          </div>
        </div>
      )}
    </div>
  )
}
