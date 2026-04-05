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

// ── Toggle switch ────────────────────────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0 ${on ? 'bg-blue-600' : 'bg-gray-700'}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
    </button>
  )
}

export default function OperationalMap() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const animRef = useRef<number | null>(null)
  const issMarkerRef = useRef<maplibregl.Marker | null>(null)

  const [mapMode, setMapMode] = useState<'globe' | 'map'>('globe')
  const [eventCount, setEventCount] = useState(0)
  const [selected, setSelected] = useState<EventProps | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'map' | 'chokepoints'>('map')

  const [layers, setLayers] = useState({
    conflictEvents: true,
    heatmap: false,
    riskOverlay: true,
    attackVectors: true,
    shippingLanes: false,
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
            `<div style="background:#111827;color:#e2e8f0;padding:10px 12px;font-size:11px;font-family:monospace;min-width:130px"><b style="color:#c084fc">🛸 ISS LIVE</b><br>Alt: ${Math.round(d.altitude)} km<br>Speed: ${Math.round(d.velocity).toLocaleString()} km/h</div>`
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

  // ── Fetch events (API returns GeoJSON FeatureCollection) ──────────────────
  const fetchEvents = useCallback(async (f: typeof filters) => {
    try {
      const timeMap: Record<string, number> = { '24h': 24, '7d': 168, '30d': 720 }
      const hours = timeMap[f.timeWindow] ?? 168
      let url = `/api/v1/map/events?hours=${hours}&limit=500`
      if (f.severity !== 'all') url += `&severity=${f.severity}`
      if (f.category !== 'all') url += `&category=${f.category}`
      if (f.region) url += `&region=${encodeURIComponent(f.region)}`

      const res = await fetch(url)
      const geojson = await res.json() as GeoJSON.FeatureCollection & { meta?: { total: number } }
      setEventCount(geojson.meta?.total ?? geojson.features?.length ?? 0)

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
  const switchMode = useCallback((next: 'globe' | 'map') => {
    const map = mapRef.current; if (!map || mapMode === next) return
    try { ;(map as unknown as { setProjection: (p: { type: string }) => void }).setProjection({ type: next === 'globe' ? 'globe' : 'mercator' }) } catch { /* ignore */ }
    map.easeTo({ zoom: next === 'globe' ? 1.8 : 2, pitch: 0, duration: 1000 })
    setMapMode(next)
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
      try { ;(map as unknown as { setProjection: (p: unknown) => void }).setProjection({ type: 'globe' }) } catch { /* ignore */ }
      try {
        ;(map as unknown as { setFog: (f: unknown) => void }).setFog({
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

      map.addLayer({ id: 'events-heatmap', type: 'heatmap', source: 'events-source', maxzoom: 8, layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': ['match', ['get', 'severity'], 'critical', 1.0, 'high', 0.7, 'medium', 0.4, 0.2],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.5, 8, 2],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 8, 8, 30],
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.4, 'rgba(253,219,93,0.6)', 1.0, 'rgba(178,24,43,0.9)'],
        },
      })
      map.addLayer({ id: 'risk-overlay-layer', type: 'fill', source: 'risk-overlay-source',
        paint: { 'fill-color': '#ef444440', 'fill-opacity': 0.3 },
      })
      map.addLayer({ id: 'attack-vectors-layer', type: 'line', source: 'attack-vectors-source',
        paint: { 'line-color': '#ef4444', 'line-width': 1.5, 'line-opacity': 0.6, 'line-dasharray': [4, 4] },
      })
      map.addLayer({ id: 'events-pulse', type: 'circle', source: 'events-source',
        filter: ['==', ['get', 'severity'], 'critical'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 14, 5, 22, 10, 32],
          'circle-color': '#ef4444', 'circle-opacity': 0.12,
          'circle-stroke-width': 1.5, 'circle-stroke-color': '#ef4444', 'circle-stroke-opacity': 0.25,
        },
      })
      map.addLayer({ id: 'events-layer', type: 'circle', source: 'events-source',
        paint: {
          'circle-radius': ['match', ['get', 'severity'], 'critical', 7, 'high', 5.5, 'medium', 4.5, 'low', 3.5, 4],
          'circle-color': ['match', ['get', 'severity'], 'critical', '#ef4444', 'high', '#f97316', 'medium', '#eab308', '#6b7280'],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': ['match', ['get', 'severity'], 'critical', '#fca5a5', 'high', '#fdba74', 'medium', '#fde047', '#9ca3af'],
          'circle-opacity': 0.9,
        },
      })
      map.addLayer({ id: 'flights-layer', type: 'circle', source: 'flights-source', layout: { visibility: 'none' },
        paint: { 'circle-radius': 4, 'circle-color': ['case', ['boolean', ['get', 'is_military'], false], '#ef4444', '#60a5fa'], 'circle-stroke-width': 1, 'circle-stroke-color': '#fff', 'circle-opacity': 0.9 },
      })
      map.addLayer({ id: 'vessels-layer', type: 'circle', source: 'vessels-source', layout: { visibility: 'none' },
        paint: { 'circle-radius': 3, 'circle-color': ['case', ['boolean', ['get', 'is_dark'], false], '#ef4444', '#34d399'], 'circle-stroke-width': 1, 'circle-stroke-color': '#fff', 'circle-opacity': 0.8 },
      })

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

  // ── Helpers ────────────────────────────────────────────────────────────────
  const sevBadgeClass = (s: string) =>
    s === 'critical' ? 'bg-red-500/20 text-red-400 border-red-500/40' :
    s === 'high' ? 'bg-orange-500/20 text-orange-400 border-orange-500/40' :
    s === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' :
    'bg-gray-500/20 text-gray-400 border-gray-500/40'

  const sevDotClass = (s: string) =>
    s === 'critical' ? 'bg-red-400 animate-pulse' :
    s === 'high' ? 'bg-orange-400' :
    s === 'medium' ? 'bg-yellow-400' : 'bg-gray-400'

  const activeBtn = 'bg-blue-600/20 border-blue-500/60 text-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.15)]'
  const inactiveBtn = 'bg-gray-800/60 border-gray-700/50 text-gray-400 hover:text-white hover:border-gray-600'

  // ═════════════════════════════════════════════════════════════════════════
  return (
    <div className="relative w-full h-full bg-black overflow-hidden">

      {/* 1. MAP CANVAS */}
      <div ref={mapContainer} className="absolute inset-0 z-0" />

      {/* 2. HEADER — top-left */}
      <div className="absolute top-4 left-14 z-10 pointer-events-auto">
        <div className="flex items-center gap-2.5 mb-0.5">
          <h1 className="text-white font-mono text-sm font-bold tracking-[0.18em] uppercase">OPERATIONAL MAP</h1>
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-600 text-white leading-none">β</span>
        </div>
        <p className="text-gray-500 text-[11px]">Real-time conflict intelligence overlay</p>
        {/* Map / Chokepoints tabs */}
        <div className="flex gap-2 mt-2.5">
          <button
            onClick={() => setActiveTab('map')}
            className={`px-4 py-1.5 text-[12px] font-medium rounded-lg border backdrop-blur-md transition-all ${activeTab === 'map' ? 'bg-gray-700/80 border-gray-500/60 text-white' : 'bg-gray-800/50 border-gray-700/40 text-gray-400 hover:text-gray-300 hover:border-gray-600/50'}`}
          >
            Map
          </button>
          <button
            onClick={() => setActiveTab('chokepoints')}
            className={`px-4 py-1.5 text-[12px] font-medium rounded-lg border backdrop-blur-md transition-all ${activeTab === 'chokepoints' ? 'bg-gray-700/80 border-gray-500/60 text-white' : 'bg-gray-800/50 border-gray-700/40 text-gray-400 hover:text-gray-300 hover:border-gray-600/50'}`}
          >
            Chokepoints
          </button>
        </div>
      </div>

      {/* 3. GLOBE / MAP TOGGLE — top-right, just left of sidebar */}
      <div className="absolute top-4 right-[296px] z-10 pointer-events-auto">
        <div className="flex bg-gray-900/80 backdrop-blur-md border border-gray-700/50 rounded-xl overflow-hidden">
          <button
            onClick={() => switchMode('globe')}
            className={`px-4 py-2 text-[12px] font-medium flex items-center gap-1.5 transition-all ${mapMode === 'globe' ? 'bg-gray-700/60 text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            🌐 Globe
          </button>
          <div className="w-px bg-gray-700/50" />
          <button
            onClick={() => switchMode('map')}
            className={`px-4 py-2 text-[12px] font-medium flex items-center gap-1.5 transition-all ${mapMode === 'map' ? 'bg-gray-700/60 text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            🗺️ Map
          </button>
        </div>
      </div>

      {/* 4. RIGHT SIDEBAR — full height, independently scrollable */}
      <div className="absolute top-0 right-0 bottom-0 w-[280px] z-10 pointer-events-auto">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-l from-gray-950/80 to-transparent pointer-events-none" />

        {/* Scrollable content */}
        <div className="relative h-full overflow-y-auto overflow-x-hidden p-3 pt-4 space-y-3"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(75,85,99,0.5) transparent' }}>

          {/* ── LAYERS ── */}
          <div className="bg-gray-900/80 backdrop-blur-md border border-gray-700/50 rounded-xl p-4">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Layers</h3>

            {([
              { key: 'conflictEvents', label: 'Conflict Events', count: eventCount },
              { key: 'heatmap', label: 'Heatmap View' },
              { key: 'riskOverlay', label: 'Risk Overlay', riskDot: true, badge: { text: 'threat', cls: 'bg-orange-500/20 text-orange-400 border-orange-500/40' } },
              { key: 'attackVectors', label: '✕ Attack Vectors', badge: { text: 'live', cls: 'bg-green-500/20 text-green-400 border-green-500/40' } },
              { key: 'shippingLanes', label: 'Shipping Lanes' },
            ] as {key:string;label:string;count?:number;riskDot?:boolean;badge?:{text:string;cls:string}}[]).map(item => (
              <label key={item.key} className="flex items-center justify-between py-1.5 cursor-pointer group">
                <div className="flex items-center gap-2.5">
                  <input type="checkbox" checked={layers[item.key as keyof typeof layers]}
                    onChange={() => setLayers(p => ({ ...p, [item.key]: !p[item.key as keyof typeof layers] }))}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-0 cursor-pointer" />
                  <span className="text-[13px] text-gray-300 group-hover:text-white transition-colors flex items-center gap-1">
                    {item.riskDot && <span className="inline-block w-3 h-3 rounded-sm bg-red-500/40 border border-red-500/60 align-middle" />}
                    {item.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.count != null && <span className="text-[12px] font-mono font-bold text-red-400">{item.count}</span>}
                  {item.badge && <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${item.badge.cls}`}>{item.badge.text}</span>}
                </div>
              </label>
            ))}
          </div>

          {/* ── FILTERS ── */}
          <div className="bg-gray-900/80 backdrop-blur-md border border-gray-700/50 rounded-xl p-4">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Filters</h3>

            <div className="mb-3">
              <div className="text-[11px] text-gray-500 mb-1.5">Time window</div>
              <div className="flex gap-1.5">
                {['24h','7d','30d'].map(tw => (
                  <button key={tw} onClick={() => setFilters(p => ({ ...p, timeWindow: tw }))}
                    className={`flex-1 px-3 py-2 text-[12px] font-medium rounded-lg border transition-all ${filters.timeWindow === tw ? activeBtn : inactiveBtn}`}>
                    {tw}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <div className="text-[11px] text-gray-500 mb-1.5">Severity</div>
              <div className="flex gap-1.5">
                {[{v:'all',l:'All'},{v:'high',l:'High+'},{v:'critical',l:'Crit'}].map(s => (
                  <button key={s.v} onClick={() => setFilters(p => ({ ...p, severity: s.v }))}
                    className={`flex-1 px-3 py-2 text-[12px] font-medium rounded-lg border transition-all ${filters.severity === s.v ? activeBtn : inactiveBtn}`}>
                    {s.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <div className="text-[11px] text-gray-500 mb-1.5">Category</div>
              <select value={filters.category} onChange={e => setFilters(p => ({ ...p, category: e.target.value }))}
                className="w-full px-3 py-2 text-[12px] rounded-lg border border-gray-700/50 bg-gray-800/60 text-gray-300 focus:outline-none focus:border-blue-500/60 transition-colors appearance-none cursor-pointer">
                {['all','conflict','political','humanitarian','military','terrorism','cyber','maritime','nuclear','economic','diplomatic'].map(c => (
                  <option key={c} value={c}>{c === 'all' ? 'All categories' : c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-[11px] text-gray-500 mb-1.5">Country / Region</div>
              <input type="text" value={filters.region} onChange={e => setFilters(p => ({ ...p, region: e.target.value }))}
                placeholder="e.g. UA, Syria, Sahel..."
                className="w-full px-3 py-2 text-[12px] rounded-lg border border-gray-700/50 bg-gray-800/60 text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500/60 transition-colors" />
            </div>
          </div>

          {/* ── TRACKING LAYERS ── */}
          <div className="bg-gray-900/80 backdrop-blur-md border border-gray-700/50 rounded-xl p-4">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Tracking Layers</h3>

            {/* ISS */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2.5">
                <span className="text-sm">🛸</span>
                <div>
                  <div className="text-[13px] text-gray-300">ISS Tracker</div>
                  {tracking.iss && (
                    <div className="text-[10px] text-purple-400 flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                      Live · every 5s
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-gray-700/80 text-gray-400">free</span>
                <Toggle on={tracking.iss} onChange={() => setTracking(p => ({ ...p, iss: !p.iss }))} />
              </div>
            </div>

            <div className="border-t border-gray-700/30 my-0.5" />

            {/* Flights */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2.5">
                <span className="text-sm">✈️</span>
                <div>
                  <div className="text-[13px] text-gray-300">Live Flights</div>
                  <div className="text-[10px] text-gray-500">OpenSky Network</div>
                </div>
              </div>
              <Toggle on={tracking.flights} onChange={() => setTracking(p => ({ ...p, flights: !p.flights }))} />
            </div>

            <div className="border-t border-gray-700/30 my-0.5" />

            {/* Vessels */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2.5">
                <span className="text-sm">🚢</span>
                <div className="text-[13px] text-gray-300">Vessel Tracking</div>
              </div>
              <Toggle on={tracking.vessels} onChange={() => setTracking(p => ({ ...p, vessels: !p.vessels }))} />
            </div>
          </div>

          {/* ── SELECTED EVENT ── */}
          <div className="bg-gray-900/80 backdrop-blur-md border border-gray-700/50 rounded-xl p-4">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Selected Event</h3>
            {selected ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full uppercase border ${sevBadgeClass(selected.severity)}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sevDotClass(selected.severity)}`} />
                    {selected.severity}
                  </span>
                  <span className="text-[10px] text-gray-500">{selected.category}</span>
                </div>
                <p className="text-[13px] text-white font-medium leading-snug mb-2">{selected.title}</p>
                {selected.summary && <p className="text-[11px] text-gray-400 leading-relaxed mb-3">{selected.summary}</p>}
                <div className="flex items-center gap-2 text-[10px] text-gray-500 pt-2 border-t border-gray-700/30">
                  <span>{selected.region}</span>
                </div>
                <button onClick={() => setSelected(null)} className="mt-2 text-[10px] text-gray-600 hover:text-gray-400 transition-colors">✕ Dismiss</button>
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-gray-500">
                <div className="w-10 h-10 rounded-full bg-gray-800/60 border border-gray-700/50 flex items-center justify-center mb-2">
                  <span className="text-lg">🌐</span>
                </div>
                <p className="text-[12px]">Click a marker to</p>
                <p className="text-[12px]">view event details</p>
              </div>
            )}
          </div>

          {/* ── INTEL CO-PILOT (ONLY here, not on map) ── */}
          <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl text-white text-[13px] font-medium hover:from-blue-600/30 hover:to-purple-600/30 hover:border-blue-500/50 transition-all duration-200 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
            <span>🤖</span>
            Intel Co-pilot
          </button>

          {/* Spacer */}
          <div className="h-4" />
        </div>
      </div>

      {/* 5. SEVERITY LEGEND — bottom-left */}
      <div className="absolute bottom-12 left-14 z-10 pointer-events-auto">
        <div className="bg-gray-900/80 backdrop-blur-md border border-gray-700/50 rounded-xl p-3 min-w-[155px]">
          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Severity</h3>
          <div className="space-y-1">
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" /><span className="text-[11px] text-gray-300">Critical — pulse rings</span></div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /><span className="text-[11px] text-gray-300">High</span></div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /><span className="text-[11px] text-gray-300">Medium</span></div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-gray-500" /><span className="text-[11px] text-gray-300">Low</span></div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-700/30 space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-4 h-0 border-t border-dashed border-red-500" />
              <span className="text-[11px] text-gray-400">Attack vectors</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-500/30 border border-red-500/50 shrink-0" />
              <span className="text-[11px] text-gray-400">Risk overlay</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-[0_0_4px_rgba(168,85,247,0.6)] shrink-0" />
              <span className="text-[11px] text-gray-400">ISS (live)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 6. INTERACTION HINT — bottom-center */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="bg-gray-900/60 backdrop-blur border border-gray-700/30 rounded-lg px-3 py-1.5 text-[10px] text-gray-500 whitespace-nowrap">
          Click marker · Drag to rotate · Scroll to zoom
        </div>
      </div>

      {/* VIGNETTE */}
      <div className="absolute inset-0 z-[5] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.4) 100%)' }} />

      {/* 7. LOADING */}
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
