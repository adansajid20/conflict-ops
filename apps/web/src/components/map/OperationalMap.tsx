'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

interface MapEvent {
  id: string
  title: string
  severity: string
  category: string
  country_region: string
  latitude: number
  longitude: number
  summary?: string
  created_at: string
  source_name?: string
}

interface FlightTrack {
  icao24: string
  callsign: string
  latitude: number
  longitude: number
  altitude: number
  heading: number
  is_military: boolean
  military_type?: string
  zone_name?: string
}

interface VesselTrack {
  mmsi: string
  name: string
  latitude: number
  longitude: number
  speed: number
  course: number
  is_dark: boolean
  zone_name?: string
}

// ═══════════════════════════════════════════════════
// STYLE — ESRI SATELLITE + DEEP SPACE
// ═══════════════════════════════════════════════════

// Cast through unknown to avoid sky/atmosphere TypeScript issues in maplibre v5
const ESRI_SATELLITE_STYLE = {
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
    { id: 'background', type: 'background', paint: { 'background-color': '#000000' } },
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
  sky: {
    'sky-color': '#000000',
    'sky-horizon-color': '#000510',
    'sky-horizon-blur': 0.5,
    'fog-color': '#000000',
    'fog-ground-blend': 0.5,
    'horizon-fog-blend': 0.1,
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
  },
} as unknown as maplibregl.StyleSpecification

// ═══════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════

export default function OperationalMap() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const animRef = useRef<number | null>(null)
  const issMarkerRef = useRef<maplibregl.Marker | null>(null)

  const [mapMode, setMapMode] = useState<'globe' | 'map'>('globe')
  const [events, setEvents] = useState<MapEvent[]>([])
  const [selectedEvent, setSelectedEvent] = useState<MapEvent | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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
    thermal: false,
  })

  // ─── ISS TRACKER ───────────────────────────────
  const updateISS = useCallback(async () => {
    if (!mapRef.current) return
    try {
      const res = await fetch('https://api.wheretheiss.at/v1/satellites/25544')
      const data = await res.json() as { longitude: number; latitude: number; altitude: number; velocity: number }
      if (!issMarkerRef.current) {
        const el = document.createElement('div')
        el.style.cssText = 'width:12px;height:12px;background:#a855f7;border-radius:50%;border:2px solid #c084fc;box-shadow:0 0 8px #a855f7;cursor:pointer;'
        issMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([data.longitude, data.latitude])
          .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(
            `<div style="background:#111;color:#e2e8f0;padding:8px 10px;border-radius:6px;font-size:11px;">
              <div style="font-weight:700;color:#c084fc;margin-bottom:4px">🛸 ISS — Live</div>
              <div>Alt: ${Math.round(data.altitude)} km</div>
              <div>Speed: ${Math.round(data.velocity).toLocaleString()} km/h</div>
            </div>`
          ))
          .addTo(mapRef.current)
      } else {
        issMarkerRef.current.setLngLat([data.longitude, data.latitude])
      }
    } catch { /* silent fail */ }
  }, [])

  useEffect(() => {
    if (!tracking.iss) {
      issMarkerRef.current?.remove()
      issMarkerRef.current = null
      return
    }
    void updateISS()
    const iv = setInterval(() => void updateISS(), 5000)
    return () => clearInterval(iv)
  }, [tracking.iss, updateISS])

  // ─── FETCH EVENTS ──────────────────────────────
  const fetchEvents = useCallback(async (currentFilters: typeof filters) => {
    try {
      const timeMap: Record<string, number> = { '24h': 24, '7d': 168, '30d': 720 }
      const hours = timeMap[currentFilters.timeWindow] ?? 168
      let url = `/api/v1/map/events?hours=${hours}&limit=500`
      if (currentFilters.severity !== 'all') url += `&severity=${currentFilters.severity}`
      if (currentFilters.category !== 'all') url += `&category=${currentFilters.category}`
      if (currentFilters.region) url += `&region=${encodeURIComponent(currentFilters.region)}`

      const res = await fetch(url)
      const data = await res.json() as { events?: MapEvent[] } | MapEvent[]
      const evts: MapEvent[] = (Array.isArray(data) ? data : (data as { events?: MapEvent[] }).events ?? [])
        .filter((e: MapEvent) => e.latitude && e.longitude)
      setEvents(evts)

      const map = mapRef.current
      if (!map) return
      const src = map.getSource('events-source') as maplibregl.GeoJSONSource | undefined
      if (!src) return
      src.setData({
        type: 'FeatureCollection',
        features: evts.map(e => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [e.longitude, e.latitude] },
          properties: { ...e },
        })),
      })
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    if (mapRef.current) void fetchEvents(filters)
  }, [filters, fetchEvents])

  // ─── LAYER VISIBILITY ──────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const setVis = (id: string, v: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v ? 'visible' : 'none')
    }
    setVis('events-layer', layers.conflictEvents)
    setVis('events-pulse', layers.conflictEvents)
    setVis('events-heatmap', layers.heatmap)
    setVis('risk-overlay-layer', layers.riskOverlay)
    setVis('attack-vectors-layer', layers.attackVectors)
  }, [layers])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const setVis = (id: string, v: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v ? 'visible' : 'none')
    }
    setVis('flights-layer', tracking.flights)
    setVis('vessels-layer', tracking.vessels)
  }, [tracking])

  // ─── GLOBE ↔ MAP ───────────────────────────────
  const toggleMapMode = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    if (mapMode === 'globe') {
      ;(map as unknown as { setProjection: (p: { type: string }) => void }).setProjection({ type: 'mercator' })
      map.easeTo({ zoom: 2, pitch: 0, duration: 1000 })
      setMapMode('map')
    } else {
      ;(map as unknown as { setProjection: (p: { type: string }) => void }).setProjection({ type: 'globe' })
      map.easeTo({ zoom: 1.8, pitch: 0, duration: 1000 })
      setMapMode('globe')
    }
  }, [mapMode])

  // ─── INIT MAP ──────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: ESRI_SATELLITE_STYLE,
      center: [30, 20],
      zoom: 1.8,
      minZoom: 1,
      maxZoom: 18,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    } as maplibregl.MapOptions)

    // Set globe projection after construction (v5 API)
    try {
      ;(map as unknown as { setProjection: (p: { type: string }) => void }).setProjection({ type: 'globe' })
    } catch { /* v5 might set it differently */ }

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'top-left')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')

    map.on('load', () => {
      mapRef.current = map
      setIsLoading(false)

      // ── SOURCES ──────────────────────────────
      const emptyFC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

      map.addSource('events-source', { type: 'geojson', data: emptyFC })
      map.addSource('attack-vectors-source', { type: 'geojson', data: emptyFC })
      map.addSource('risk-overlay-source', { type: 'geojson', data: emptyFC })
      map.addSource('flights-source', { type: 'geojson', data: emptyFC })
      map.addSource('vessels-source', { type: 'geojson', data: emptyFC })

      // ── LAYERS ───────────────────────────────
      // Heatmap
      map.addLayer({
        id: 'events-heatmap', type: 'heatmap', source: 'events-source', maxzoom: 8,
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': ['match', ['get', 'severity'], 'critical', 1.0, 'high', 0.7, 'medium', 0.4, 0.2],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.5, 8, 2],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 8, 8, 30],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.2, 'rgba(103,169,207,0.4)',
            0.6, 'rgba(253,219,93,0.6)',
            1.0, 'rgba(178,24,43,0.9)',
          ],
        },
      })

      // Risk overlay
      map.addLayer({
        id: 'risk-overlay-layer', type: 'fill', source: 'risk-overlay-source',
        paint: {
          'fill-color': ['match', ['get', 'risk_level'], 'critical', '#ef444440', 'high', '#f9731640', 'medium', '#eab30830', '#00000000'],
          'fill-opacity': 0.3,
        },
      })

      // Attack vectors
      map.addLayer({
        id: 'attack-vectors-layer', type: 'line', source: 'attack-vectors-source',
        paint: { 'line-color': '#ef4444', 'line-width': 1.5, 'line-opacity': 0.6, 'line-dasharray': [4, 4] },
      })

      // Pulse rings for critical
      map.addLayer({
        id: 'events-pulse', type: 'circle', source: 'events-source',
        filter: ['==', ['get', 'severity'], 'critical'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 12, 5, 20, 10, 30],
          'circle-color': '#ef4444', 'circle-opacity': 0.12,
          'circle-stroke-width': 1.5, 'circle-stroke-color': '#ef4444', 'circle-stroke-opacity': 0.3,
        },
      })

      // Event dots
      map.addLayer({
        id: 'events-layer', type: 'circle', source: 'events-source',
        paint: {
          'circle-radius': ['match', ['get', 'severity'], 'critical', 7, 'high', 5.5, 'medium', 4.5, 'low', 3.5, 4],
          'circle-color': ['match', ['get', 'severity'], 'critical', '#ef4444', 'high', '#f97316', 'medium', '#eab308', '#6b7280'],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': ['match', ['get', 'severity'], 'critical', '#fca5a5', 'high', '#fdba74', 'medium', '#fde047', '#9ca3af'],
          'circle-opacity': 0.9,
        },
      })

      // Flights
      map.addLayer({
        id: 'flights-layer', type: 'circle', source: 'flights-source',
        layout: { visibility: 'none' },
        paint: {
          'circle-radius': 4,
          'circle-color': ['case', ['boolean', ['get', 'is_military'], false], '#ef4444', '#60a5fa'],
          'circle-stroke-width': 1, 'circle-stroke-color': '#ffffff', 'circle-opacity': 0.9,
        },
      })

      // Vessels
      map.addLayer({
        id: 'vessels-layer', type: 'circle', source: 'vessels-source',
        layout: { visibility: 'none' },
        paint: {
          'circle-radius': 3,
          'circle-color': ['case', ['boolean', ['get', 'is_dark'], false], '#ef4444', '#34d399'],
          'circle-stroke-width': 1, 'circle-stroke-color': '#ffffff', 'circle-opacity': 0.8,
        },
      })

      // ── CLICK HANDLER ────────────────────────
      map.on('click', 'events-layer', e => {
        const features = e.features as maplibregl.MapGeoJSONFeature[] | undefined
        if (!features?.[0]) return
        const p = features[0].properties as MapEvent
        setSelectedEvent(p)
      })

      map.on('mouseenter', 'events-layer', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'events-layer', () => { map.getCanvas().style.cursor = '' })

      // ── AUTO-ROTATION ─────────────────────────
      let userInteracting = false
      map.on('mousedown', () => { userInteracting = true })
      map.on('mouseup', () => { userInteracting = false })
      map.on('dragend', () => { userInteracting = false })
      map.on('touchstart', () => { userInteracting = true })
      map.on('touchend', () => { userInteracting = false })

      const spin = () => {
        if (!mapRef.current) return
        const zoom = mapRef.current.getZoom()
        if (!userInteracting && zoom < 4) {
          const center = mapRef.current.getCenter()
          center.lng += 0.3
          mapRef.current.easeTo({ center, duration: 1000, easing: t => t })
        }
        animRef.current = requestAnimationFrame(spin)
      }
      spin()

      // Initial data load
      void fetchEvents(filters)
    })

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      issMarkerRef.current?.remove()
      issMarkerRef.current = null
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── HELPERS ───────────────────────────────────
  const getFreshness = (date: string) => {
    const mins = (Date.now() - new Date(date).getTime()) / 60000
    if (mins < 30) return 'BREAKING'
    if (mins < 120) return 'FRESH'
    if (mins < 1440) return '24H'
    if (mins < 2880) return '2D'
    return 'ARCHIVED'
  }

  // ═══════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════

  return (
    <div className="relative w-full h-full bg-black">
      {/* MAP */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* HEADER */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="flex items-center gap-3">
          <h1 className="text-white font-mono text-sm font-bold tracking-widest uppercase">OPERATIONAL MAP</h1>
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-600 text-white">β</span>
        </div>
        <p className="text-gray-400 text-xs mt-0.5">Real-time conflict intelligence overlay</p>
      </div>

      {/* GLOBE / MAP TOGGLE */}
      <div className="absolute top-4 right-[272px] z-10 flex items-center gap-2">
        <div className="flex bg-gray-900/90 border border-gray-700 rounded-lg overflow-hidden backdrop-blur-sm">
          <button
            onClick={() => { if (mapMode !== 'globe') toggleMapMode() }}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${mapMode === 'globe' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            🌐 Globe
          </button>
          <button
            onClick={() => { if (mapMode !== 'map') toggleMapMode() }}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${mapMode === 'map' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            🗺️ Map
          </button>
        </div>
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="absolute top-4 right-4 bottom-4 w-[256px] z-10 flex flex-col gap-2.5 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700">

        {/* LAYERS */}
        <div className="bg-gray-900/90 border border-gray-700 rounded-lg p-3 backdrop-blur-sm">
          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Layers</h3>
          {([
            { key: 'conflictEvents', label: 'Conflict Events', count: events.length },
            { key: 'heatmap', label: 'Heatmap View', count: null },
            { key: 'riskOverlay', label: '🟥 Risk Overlay', badge: 'threat' },
            { key: 'attackVectors', label: '✕ Attack Vectors', badge: 'live' },
            { key: 'shippingLanes', label: 'Shipping Lanes', count: null },
          ] as { key: string; label: string; count?: number | null; badge?: string }[]).map(({ key, label, count, badge }) => (
            <label key={key} className="flex items-center justify-between py-1 cursor-pointer group">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={layers[key as keyof typeof layers]}
                  onChange={() => setLayers(p => ({ ...p, [key]: !p[key as keyof typeof layers] }))}
                  className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-0"
                />
                <span className="text-xs text-gray-300 group-hover:text-white">{label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {count != null && <span className="text-[10px] font-mono text-red-400">{count}</span>}
                {badge === 'threat' && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-orange-600/30 text-orange-400 border border-orange-600/50">threat</span>}
                {badge === 'live' && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-green-600/30 text-green-400 border border-green-600/50">live</span>}
              </div>
            </label>
          ))}
        </div>

        {/* FILTERS */}
        <div className="bg-gray-900/90 border border-gray-700 rounded-lg p-3 backdrop-blur-sm">
          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Filters</h3>
          <div className="mb-2">
            <div className="text-[10px] text-gray-500 mb-1">Time window</div>
            <div className="flex gap-1">
              {['24h', '7d', '30d'].map(tw => (
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
              {[{ value: 'all', label: 'All' }, { value: 'high', label: 'High+' }, { value: 'critical', label: 'Crit' }].map(s => (
                <button key={s.value} onClick={() => setFilters(p => ({ ...p, severity: s.value }))}
                  className={`flex-1 px-2 py-1.5 text-xs rounded border ${filters.severity === s.value ? 'bg-blue-600/30 border-blue-500 text-blue-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}>
                  {s.label}
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
        <div className="bg-gray-900/90 border border-gray-700 rounded-lg p-3 backdrop-blur-sm">
          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Tracking Layers</h3>
          {([
            { key: 'iss', icon: '🛸', label: 'ISS Tracker', sub: tracking.iss ? '🟣 Live · updating every 5s' : 'International Space Station', badge: 'free' },
            { key: 'flights', icon: '✈️', label: 'Live Flights', sub: 'OpenSky Network' },
            { key: 'vessels', icon: '🚢', label: 'Vessel Tracking', setup: true },
            { key: 'thermal', icon: '🔥', label: 'Thermal Anomalies', setup: true },
          ] as { key: string; icon: string; label: string; sub?: string; badge?: string; setup?: boolean }[]).map(item => (
            <div key={item.key} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs">{item.icon}</span>
                <div>
                  <div className="text-xs text-gray-300">{item.label}</div>
                  {item.sub && <div className={`text-[10px] mt-0.5 ${item.key === 'iss' && tracking.iss ? 'text-purple-400' : 'text-gray-500'}`}>{item.sub}</div>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {item.badge && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-gray-700 text-gray-400">{item.badge}</span>}
                {item.setup && <button className="px-2 py-0.5 text-[10px] rounded border border-gray-700 text-gray-500 hover:text-white">Setup</button>}
                <button
                  onClick={() => setTracking(p => ({ ...p, [item.key]: !p[item.key as keyof typeof tracking] }))}
                  className={`w-8 h-4 rounded-full transition-colors relative ${tracking[item.key as keyof typeof tracking] ? 'bg-blue-600' : 'bg-gray-700'}`}
                >
                  <div className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all ${tracking[item.key as keyof typeof tracking] ? 'left-4' : 'left-0.5'}`} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* SELECTED EVENT */}
        <div className="bg-gray-900/90 border border-gray-700 rounded-lg p-3 backdrop-blur-sm">
          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Selected Event</h3>
          {selectedEvent ? (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-2 h-2 rounded-full ${selectedEvent.severity === 'critical' ? 'bg-red-500 animate-pulse' : selectedEvent.severity === 'high' ? 'bg-orange-500' : selectedEvent.severity === 'medium' ? 'bg-yellow-500' : 'bg-gray-500'}`} />
                <span className="text-[10px] font-bold uppercase text-gray-400">{selectedEvent.severity}</span>
                <span className="text-[10px] text-gray-500 ml-auto">{getFreshness(selectedEvent.created_at)}</span>
              </div>
              <p className="text-xs text-white font-medium leading-tight mb-1.5">{selectedEvent.title}</p>
              {selectedEvent.summary && <p className="text-[11px] text-gray-400 leading-relaxed mb-2">{selectedEvent.summary}</p>}
              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                <span>{selectedEvent.country_region}</span>
                <span>·</span>
                <span>{selectedEvent.category}</span>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="mt-2 text-[10px] text-gray-500 hover:text-white">✕ Dismiss</button>
            </div>
          ) : (
            <div className="flex flex-col items-center py-4 text-gray-500">
              <div className="text-2xl mb-1">🌐</div>
              <p className="text-xs">Click a marker to</p>
              <p className="text-xs">view event details</p>
            </div>
          )}
        </div>
      </div>

      {/* SEVERITY LEGEND */}
      <div className="absolute bottom-8 left-4 z-10 bg-gray-900/90 border border-gray-700 rounded-lg p-3 backdrop-blur-sm">
        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Severity</h3>
        {[
          { color: '#ef4444', label: 'Critical — pulse rings' },
          { color: '#f97316', label: 'High' },
          { color: '#eab308', label: 'Medium' },
          { color: '#6b7280', label: 'Low' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-2 py-0.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-[11px] text-gray-400">{s.label}</span>
          </div>
        ))}
        <div className="mt-1.5 pt-1.5 border-t border-gray-700">
          <div className="flex items-center gap-2 py-0.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
            <span className="text-[11px] text-gray-400">ISS (live)</span>
          </div>
        </div>
      </div>

      {/* BOTTOM HINT */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="bg-gray-900/70 border border-gray-700 rounded-lg px-3 py-1.5 text-[10px] text-gray-500 backdrop-blur-sm">
          Click marker · Drag to rotate · Scroll to zoom
        </div>
      </div>

      {/* INTEL CO-PILOT */}
      <div className="absolute bottom-8 right-[272px] z-10">
        <button className="flex items-center gap-2 px-4 py-2.5 bg-gray-900/90 border border-gray-700 rounded-lg text-white text-xs font-medium hover:bg-gray-800 backdrop-blur-sm transition-colors">
          🤖 Intel Co-pilot
        </button>
      </div>

      {/* VIGNETTE */}
      <div className="absolute inset-0 z-[5] pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)' }} />

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
