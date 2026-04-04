'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

export interface MapEvent {
  id: string
  title: string
  severity: string
  event_type?: string
  category?: string
  region?: string
  publishedAt?: string
  sourceUrl?: string
  summary?: string
  isBreaking?: boolean
  source?: string
}

interface Stats {
  tracked: number
  critical: number
  high: number
  medium: number
  low: number
}

interface GlobeMapProps {
  timeWindow: string
  severity: string
  activeLayers: Set<string>
  autoRotate: boolean
  onStatsUpdate: (stats: Stats) => void
  onEventClick: (event: MapEvent) => void
}

// ── Free Esri satellite tiles — no API key needed ─────────────────────────
const SATELLITE_STYLE = {
  version: 8,
  name: 'ConflictRadar',
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
      id: 'satellite',
      type: 'raster',
      source: 'esri-satellite',
      paint: {
        'raster-brightness-min': 0.04,
        'raster-brightness-max': 0.55,
        'raster-contrast': 0.12,
        'raster-saturation': -0.35,
      },
    },
  ],
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
} as unknown as maplibregl.StyleSpecification

const SEV_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
}

function waitForStyle(map: maplibregl.Map, ms = 5000): Promise<void> {
  return new Promise(resolve => {
    if (map.isStyleLoaded()) { resolve(); return }
    let done = false
    const finish = () => { if (!done) { done = true; resolve() } }
    const t = window.setTimeout(finish, ms)
    map.once('style.load', () => { clearTimeout(t); finish() })
  })
}

function safeRemoveLayer(map: maplibregl.Map, id: string) {
  try { if (map.getLayer(id)) map.removeLayer(id) } catch { /* ignore */ }
}
function safeRemoveSource(map: maplibregl.Map, id: string) {
  try { if (map.getSource(id)) map.removeSource(id) } catch { /* ignore */ }
}

export default function GlobeMap({ timeWindow, severity, activeLayers, autoRotate, onStatsUpdate, onEventClick }: GlobeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const rotationRef = useRef<number | null>(null)
  const [mapReady, setMapReady] = useState(false)

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: SATELLITE_STYLE,
      center: [42, 20],
      zoom: 2.2,
      minZoom: 1.5,
      maxZoom: 16,
      attributionControl: false,
      fadeDuration: 0,
    })

    map.on('style.load', () => {
      // Globe projection
      try {
        ;(map as unknown as { setProjection: (p: unknown) => void }).setProjection({ type: 'globe' })
      } catch { /* flat map is fine */ }

      // Dark space atmosphere + stars
      try {
        ;(map as unknown as { setFog: (f: unknown) => void }).setFog({
          'color': 'rgb(8, 12, 18)',
          'high-color': 'rgb(15, 25, 55)',
          'horizon-blend': 0.06,
          'space-color': 'rgb(2, 3, 12)',
          'star-intensity': 1.0,
        })
      } catch { /* ignore if not supported */ }

      setMapReady(true)
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'bottom-right')
    mapRef.current = map

    return () => {
      if (rotationRef.current) cancelAnimationFrame(rotationRef.current)
      popupRef.current?.remove()
      map.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auto-rotate (OFF by default) ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (rotationRef.current) { cancelAnimationFrame(rotationRef.current); rotationRef.current = null }
    if (!autoRotate) return

    let lastTime = 0
    let paused = false

    function rotate(ts: number) {
      const m = mapRef.current
      if (!m) return
      if (!paused && !m.isMoving()) {
        if (lastTime) {
          const delta = (ts - lastTime) / 1000
          const c = m.getCenter()
          m.setCenter([c.lng - delta * 1.8, c.lat])
        }
        lastTime = ts
      }
      rotationRef.current = requestAnimationFrame(rotate)
    }
    rotationRef.current = requestAnimationFrame(rotate)

    const pause = () => { paused = true }
    const resume = () => { setTimeout(() => { paused = false; lastTime = 0 }, 8000) }
    map.on('mousedown', pause); map.on('touchstart', pause); map.on('wheel', pause)
    map.on('mouseup', resume); map.on('touchend', resume)

    return () => {
      if (rotationRef.current) { cancelAnimationFrame(rotationRef.current); rotationRef.current = null }
      map.off('mousedown', pause); map.off('touchstart', pause); map.off('wheel', pause)
      map.off('mouseup', resume); map.off('touchend', resume)
    }
  }, [autoRotate])

  // ── Load events ───────────────────────────────────────────────────────────
  const loadEvents = useCallback(async () => {
    const map = mapRef.current
    if (!map || !mapReady) return
    await waitForStyle(map)

    try {
      const res = await fetch(`/api/v1/map/events?window=${timeWindow}&severity=${severity}`, {
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) return
      const data = await res.json()

      if (data.meta) {
        onStatsUpdate({
          tracked: data.meta.total ?? 0,
          critical: data.meta.critical ?? 0,
          high: data.meta.high ?? 0,
          medium: data.meta.medium ?? 0,
          low: data.meta.low ?? 0,
        })
      }

      for (const id of ['event-pulse', 'event-points', 'event-glow', 'cluster-count', 'event-clusters']) safeRemoveLayer(map, id)
      safeRemoveSource(map, 'events')

      map.addSource('events', {
        type: 'geojson',
        data,
        cluster: true,
        clusterMaxZoom: 10,
        clusterRadius: 45,
        clusterProperties: {
          maxSev: ['max', ['get', 'severityInt']],
        },
      })

      // Clusters — colored by worst severity inside
      map.addLayer({
        id: 'event-clusters', type: 'circle', source: 'events',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'case',
            ['>=', ['get', 'maxSev'], 4], '#ef4444',
            ['>=', ['get', 'maxSev'], 3], '#f97316',
            ['>=', ['get', 'maxSev'], 2], '#eab308',
            '#22c55e',
          ],
          'circle-radius': ['step', ['get', 'point_count'], 15, 10, 20, 30, 26, 75, 34],
          'circle-opacity': 0.75,
          'circle-stroke-width': 2.5,
          'circle-stroke-color': [
            'case',
            ['>=', ['get', 'maxSev'], 4], 'rgba(239,68,68,0.5)',
            ['>=', ['get', 'maxSev'], 3], 'rgba(249,115,22,0.4)',
            ['>=', ['get', 'maxSev'], 2], 'rgba(234,179,8,0.3)',
            'rgba(34,197,94,0.3)',
          ],
        },
      })

      map.addLayer({
        id: 'cluster-count', type: 'symbol', source: 'events',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-size': 12,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        },
        paint: { 'text-color': '#fff' },
      })

      // Outer glow on critical/high events (placed UNDER dots)
      map.addLayer({
        id: 'event-glow', type: 'circle', source: 'events',
        filter: ['all', ['!', ['has', 'point_count']], ['in', ['get', 'severity'], ['literal', ['critical', 'high']]]],
        paint: {
          'circle-radius': ['match', ['get', 'severity'], 'critical', 18, 'high', 14, 10],
          'circle-color': ['match', ['get', 'severity'], 'critical', 'rgba(239,68,68,0.12)', 'high', 'rgba(249,115,22,0.08)', 'transparent'],
          'circle-blur': 0.8,
        },
      })

      // Individual event dots
      map.addLayer({
        id: 'event-points', type: 'circle', source: 'events',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': ['match', ['get', 'severity'], 'critical', 7, 'high', 6, 'medium', 5, 'low', 4, 4],
          'circle-color': ['match', ['get', 'severity'], 'critical', '#ef4444', 'high', '#f97316', 'medium', '#eab308', 'low', '#22c55e', '#6b7280'],
          'circle-opacity': 0.9,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'rgba(255,255,255,0.5)',
        },
      })

      // Pulse ring for breaking events
      map.addLayer({
        id: 'event-pulse', type: 'circle', source: 'events',
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'isBreaking'], true]],
        paint: {
          'circle-radius': 20,
          'circle-color': 'transparent',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ef4444',
          'circle-stroke-opacity': 0.5,
        },
      })
    } catch (err) {
      console.warn('[GlobeMap] loadEvents error:', err)
    }
  }, [timeWindow, severity, mapReady, onStatsUpdate])

  // ── Load live layer ───────────────────────────────────────────────────────
  const loadLiveLayer = useCallback(async (type: string) => {
    const map = mapRef.current
    if (!map || !mapReady) return
    await waitForStyle(map)

    const endpoints: Record<string, string> = {
      flights: '/api/v1/live/flights',
      vessels: '/api/v1/live/vessels',
      seismic: '/api/v1/live/seismic',
    }
    const endpoint = endpoints[type]
    if (!endpoint) return

    try {
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(12000) })
      if (!res.ok) return
      const data = await res.json()

      const srcId = `live-${type}`
      const lyrId = `live-${type}-layer`
      const lblId = `live-${type}-labels`

      // Smooth position update (no layer flicker)
      const existing = map.getSource(srcId) as maplibregl.GeoJSONSource | undefined
      if (existing) { existing.setData(data); return }

      map.addSource(srcId, { type: 'geojson', data })

      if (type === 'flights') {
        map.addLayer({
          id: lyrId, type: 'circle', source: srcId,
          paint: {
            'circle-radius': ['case', ['==', ['get', 'is_military'], true], 6, 3.5],
            'circle-color': ['case', ['==', ['get', 'is_military'], true], '#ef4444', '#60a5fa'],
            'circle-opacity': 0.9,
            'circle-stroke-width': ['case', ['==', ['get', 'is_military'], true], 2, 0.5],
            'circle-stroke-color': ['case', ['==', ['get', 'is_military'], true], '#fca5a5', 'rgba(255,255,255,0.3)'],
          },
        })
        map.addLayer({
          id: lblId, type: 'symbol', source: srcId,
          filter: ['==', ['get', 'is_military'], true],
          layout: {
            'text-field': ['get', 'callsign'], 'text-size': 9, 'text-offset': [0, 1.4],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-allow-overlap': false,
          },
          paint: { 'text-color': '#ef4444', 'text-halo-color': 'rgba(0,0,0,0.9)', 'text-halo-width': 1 },
        })
      } else if (type === 'vessels') {
        map.addLayer({
          id: lyrId, type: 'circle', source: srcId,
          paint: {
            'circle-radius': ['case', ['==', ['get', 'is_dark'], true], 6, 3.5],
            'circle-color': ['case', ['==', ['get', 'is_dark'], true], '#ef4444', '#34d399'],
            'circle-opacity': 0.85,
            'circle-stroke-width': 1,
            'circle-stroke-color': ['case', ['==', ['get', 'is_dark'], true], '#fca5a5', 'rgba(255,255,255,0.2)'],
          },
        })
      } else if (type === 'seismic') {
        map.addLayer({
          id: lyrId, type: 'circle', source: srcId,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'magnitude'], 2.5, 4, 4.0, 8, 5.0, 14, 6.0, 22, 7.0, 32],
            'circle-color': ['case', ['==', ['get', 'is_conflict_zone'], true], '#ef4444', '#f59e0b'],
            'circle-opacity': 0.4,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#f59e0b',
          },
        })
        map.addLayer({
          id: lblId, type: 'symbol', source: srcId,
          filter: ['>=', ['get', 'magnitude'], 4.5],
          layout: {
            'text-field': ['concat', 'M', ['to-string', ['get', 'magnitude']]],
            'text-size': 10, 'text-offset': [0, 1.2],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          },
          paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1 },
        })
      }
    } catch (err) {
      console.warn(`[GlobeMap] loadLiveLayer(${type}) error:`, err)
    }
  }, [mapReady])

  const removeLiveLayer = useCallback(async (type: string) => {
    const map = mapRef.current
    if (!map || !mapReady) return
    await waitForStyle(map)
    const prefix = `live-${type}`
    const style = map.getStyle()
    if (style?.layers) {
      for (const layer of style.layers) {
        if ((layer.id as string).startsWith(prefix)) safeRemoveLayer(map, layer.id as string)
      }
    }
    safeRemoveSource(map, prefix)
  }, [mapReady])

  // ── Effect hooks ──────────────────────────────────────────────────────────
  useEffect(() => { void loadEvents() }, [loadEvents])

  useEffect(() => {
    if (!mapReady) return
    const loaders: Record<string, () => Promise<void>> = { flights: loadFlights, vessels: loadVessels, seismic: loadSeismic }
    const all = ['flights', 'vessels', 'seismic', 'nuclear', 'outages', 'fires']
    for (const l of all) {
      if (activeLayers.has(l) && loaders[l]) void loaders[l]()
      else void removeLiveLayer(l)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayers, mapReady])

  useEffect(() => {
    if (!mapReady) return
    const t1 = setInterval(() => { void loadEvents() }, 60000)
    const t2 = setInterval(() => { if (activeLayers.has('flights')) void loadLiveLayer('flights') }, 30000)
    const t3 = setInterval(() => { if (activeLayers.has('vessels')) void loadLiveLayer('vessels') }, 60000)
    const t4 = setInterval(() => { if (activeLayers.has('seismic')) void loadLiveLayer('seismic') }, 120000)
    return () => { clearInterval(t1); clearInterval(t2); clearInterval(t3); clearInterval(t4) }
  }, [mapReady, activeLayers, loadEvents, loadLiveLayer])

  // Separate callbacks for flight/vessel (referenced in layer toggle effect)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadFlights = useCallback(() => loadLiveLayer('flights'), [loadLiveLayer])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadVessels = useCallback(() => loadLiveLayer('vessels'), [loadLiveLayer])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadSeismic = useCallback(() => loadLiveLayer('seismic'), [loadLiveLayer])

  // ── Hover + click ─────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'cr-popup', maxWidth: '300px' })
    popupRef.current = popup

    const showPopup = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const m = mapRef.current
      if (!m || !e.features?.length) return
      m.getCanvas().style.cursor = 'pointer'
      const f = (e.features as maplibregl.MapGeoJSONFeature[])[0] as maplibregl.MapGeoJSONFeature
      const p = (f.properties ?? {}) as Record<string, unknown>
      const geom = f.geometry as GeoJSON.Point
      const coords = geom.coordinates as [number, number]

      let html = ''
      if (p.callsign !== undefined || p.icao24 !== undefined) {
        const isMil = p.is_military === true || p.is_military === 'true'
        html = `<div style="font-family:-apple-system,sans-serif"><div style="font-size:10px;font-weight:700;color:${isMil ? '#ef4444' : '#60a5fa'};text-transform:uppercase;margin-bottom:4px">${isMil ? '🎖️ Military' : '✈️ Aircraft'}</div><div style="font-size:13px;font-weight:600;color:#e2e8f0">${String(p.callsign ?? p.icao24 ?? '')}</div><div style="font-size:10px;color:#94a3b8;margin-top:4px">${String(p.origin_country ?? '')} · ${Math.round(Number(p.altitude ?? 0)).toLocaleString()}ft · ${Math.round(Number(p.velocity ?? 0))}kts</div></div>`
      } else if (p.mmsi !== undefined) {
        const isDark = p.is_dark === true || p.is_dark === 'true'
        html = `<div style="font-family:-apple-system,sans-serif"><div style="font-size:10px;font-weight:700;color:${isDark ? '#ef4444' : '#34d399'};text-transform:uppercase;margin-bottom:4px">${isDark ? '⚠️ Dark Ship' : '🚢 Vessel'}</div><div style="font-size:13px;font-weight:600;color:#e2e8f0">${String(p.name ?? p.mmsi ?? '')}</div><div style="font-size:10px;color:#94a3b8;margin-top:4px">${String(p.ship_type ?? '')} · ${Math.round(Number(p.speed ?? 0))}kts${p.destination ? ' · → ' + String(p.destination) : ''}</div></div>`
      } else if (p.magnitude !== undefined || p.mag !== undefined) {
        const mag = p.magnitude ?? p.mag
        const isConflict = p.is_conflict_zone === true || p.is_conflict_zone === 'true' || p.is_suspicious === true || p.is_suspicious === 'true'
        html = `<div style="font-family:-apple-system,sans-serif"><div style="font-size:10px;font-weight:700;color:${isConflict ? '#ef4444' : '#f59e0b'};text-transform:uppercase;margin-bottom:4px">${isConflict ? '⚠️ Conflict Zone Seismic' : '🌍 Seismic Event'}</div><div style="font-size:18px;font-weight:700;color:#e2e8f0">M${mag}</div><div style="font-size:10px;color:#94a3b8">${String(p.depth ?? '?')}km · ${String(p.place ?? '')}</div></div>`
      } else if (p.title) {
        const sev = String(p.severity ?? 'low')
        const col = SEV_COLORS[sev] ?? '#6b7280'
        const isBreaking = p.isBreaking === true || p.isBreaking === 'true'
        html = `<div style="font-family:-apple-system,sans-serif;max-width:260px"><div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><span style="width:8px;height:8px;border-radius:50%;background:${col}"></span><span style="font-size:10px;font-weight:700;color:${col};text-transform:uppercase">${sev}</span>${isBreaking ? '<span style="font-size:9px;font-weight:700;color:#ef4444;background:rgba(239,68,68,0.15);padding:1px 6px;border-radius:3px">BREAKING</span>' : ''}</div><div style="font-size:12px;font-weight:600;color:#e2e8f0;line-height:1.35">${String(p.title).substring(0, 120)}</div><div style="font-size:10px;color:#64748b;margin-top:4px">${String(p.region ?? '').replace(/_/g, ' ')} ${p.source ? '· ' + String(p.source) : ''}</div><div style="font-size:10px;color:#3b82f6;margin-top:6px">Click for intel →</div></div>`
      }

      if (html) popup.setLngLat(coords).setHTML(html).addTo(m)
    }

    const hidePopup = () => {
      const m = mapRef.current
      if (m) m.getCanvas().style.cursor = ''
      popup.remove()
    }

    const handleEventClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const m = mapRef.current
      if (!m || !e.features?.length) return
      const f = (e.features as maplibregl.MapGeoJSONFeature[])[0] as maplibregl.MapGeoJSONFeature
      const p = (f.properties ?? {}) as Record<string, unknown>
      if (!p.title) return

      onEventClick({
        id: String(p.id ?? ''),
        title: String(p.title ?? ''),
        severity: String(p.severity ?? 'low'),
        event_type: String(p.event_type ?? ''),
        category: String(p.category ?? p.event_type ?? 'general'),
        region: p.region ? String(p.region) : undefined,
        publishedAt: p.publishedAt ? String(p.publishedAt) : undefined,
        sourceUrl: p.sourceUrl ? String(p.sourceUrl) : undefined,
        summary: p.summary ? String(p.summary) : undefined,
        isBreaking: p.isBreaking === true || p.isBreaking === 'true',
        source: p.source ? String(p.source) : undefined,
      })

      const geom = f.geometry as GeoJSON.Point
      m.flyTo({ center: geom.coordinates as [number, number], zoom: Math.max(m.getZoom(), 5), duration: 800 })
    }

    const handleClusterClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const m = mapRef.current
      if (!m || !e.features?.length) return
      const f = (e.features as maplibregl.MapGeoJSONFeature[])[0] as maplibregl.MapGeoJSONFeature
      const clusterId = (f.properties as Record<string, unknown>)?.cluster_id as number | undefined
      if (!clusterId) return
      ;(m.getSource('events') as maplibregl.GeoJSONSource)
        .getClusterExpansionZoom(clusterId)
        .then(zoom => {
          const geom = f.geometry as GeoJSON.Point
          m.flyTo({ center: geom.coordinates as [number, number], zoom: zoom + 1, duration: 500 })
        })
        .catch(() => null)
    }

    const hoverLayers = ['event-points', 'event-clusters', 'live-flights-layer', 'live-vessels-layer', 'live-seismic-layer']
    for (const l of hoverLayers) { map.on('mouseenter', l, showPopup); map.on('mouseleave', l, hidePopup) }
    map.on('click', 'event-points', handleEventClick)
    map.on('click', 'event-clusters', handleClusterClick)

    return () => {
      for (const l of hoverLayers) { map.off('mouseenter', l, showPopup); map.off('mouseleave', l, hidePopup) }
      map.off('click', 'event-points', handleEventClick)
      map.off('click', 'event-clusters', handleClusterClick)
      popup.remove()
    }
  }, [mapReady, onEventClick])

  return (
    <>
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />
      <style>{`
        .cr-popup .maplibregl-popup-content { background: rgba(10,14,20,0.96) !important; border: 1px solid rgba(255,255,255,0.1) !important; border-radius: 12px !important; padding: 12px 14px !important; box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important; backdrop-filter: blur(16px) !important; }
        .cr-popup .maplibregl-popup-tip { border-top-color: rgba(10,14,20,0.96) !important; }
        .maplibregl-ctrl-group { background: rgba(10,14,20,0.85) !important; border: 1px solid rgba(255,255,255,0.1) !important; border-radius: 8px !important; overflow: hidden !important; }
        .maplibregl-ctrl-group button { background: transparent !important; border-color: rgba(255,255,255,0.05) !important; }
        .maplibregl-ctrl-group button span { filter: invert(1) !important; }
        .maplibregl-ctrl-attrib { display: none !important; }
      `}</style>
    </>
  )
}
