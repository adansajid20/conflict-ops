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

const SEV_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
}

function getMapStyle(key: string | undefined): string {
  if (key && key.length > 8) return `https://api.maptiler.com/maps/satellite/style.json?key=${key}`
  return 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
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

export default function GlobeMap({
  timeWindow, severity, activeLayers, autoRotate, onStatsUpdate, onEventClick,
}: GlobeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const rotationRef = useRef<number | null>(null)
  const [mapReady, setMapReady] = useState(false)

  // ── Initialize map ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const key = process.env.NEXT_PUBLIC_MAPTILER_KEY
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyle(key),
      center: [35, 25],
      zoom: 2.0,
      minZoom: 1.5,
      maxZoom: 16,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
      fadeDuration: 200,
    })

    map.on('style.load', () => {
      try {
        ;(map as unknown as { setProjection: (p: unknown) => void }).setProjection({ type: 'globe' })
      } catch { /* not supported by fallback style */ }

      if (key && key.length > 8) {
        try {
          ;(map as unknown as { setFog: (f: unknown) => void }).setFog({
            'color': 'rgb(10, 14, 20)',
            'high-color': 'rgb(20, 30, 60)',
            'horizon-blend': 0.08,
            'space-color': 'rgb(3, 5, 18)',
            'star-intensity': 0.9,
          })
        } catch { /* ignore */ }
      }

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

  // ── Auto-rotate (controlled by parent, OFF by default) ───────────────────
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
          m.setCenter([c.lng - delta * 2, c.lat])
        }
        lastTime = ts
      }
      rotationRef.current = requestAnimationFrame(rotate)
    }
    rotationRef.current = requestAnimationFrame(rotate)

    const pause = () => { paused = true }
    const resume = () => { setTimeout(() => { paused = false; lastTime = 0 }, 8000) }

    map.on('mousedown', pause)
    map.on('touchstart', pause)
    map.on('wheel', pause)
    map.on('mouseup', resume)
    map.on('touchend', resume)

    return () => {
      if (rotationRef.current) { cancelAnimationFrame(rotationRef.current); rotationRef.current = null }
      map.off('mousedown', pause)
      map.off('touchstart', pause)
      map.off('wheel', pause)
      map.off('mouseup', resume)
      map.off('touchend', resume)
    }
  }, [autoRotate])

  // ── Load events (static pins) ─────────────────────────────────────────────
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

      for (const id of ['event-pulse', 'event-points', 'cluster-count', 'event-clusters']) safeRemoveLayer(map, id)
      safeRemoveSource(map, 'events')

      map.addSource('events', {
        type: 'geojson',
        data,
        cluster: true,
        clusterMaxZoom: 10,
        clusterRadius: 50,
      })

      map.addLayer({
        id: 'event-clusters', type: 'circle', source: 'events',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#3b82f6', 10, '#f97316', 50, '#ef4444'],
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 30],
          'circle-opacity': 0.85,
          'circle-stroke-width': 2,
          'circle-stroke-color': 'rgba(255,255,255,0.25)',
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

      map.addLayer({
        id: 'event-points', type: 'circle', source: 'events',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': ['match', ['get', 'severity'], 'critical', 8, 'high', 7, 'medium', 6, 'low', 5, 5],
          'circle-color': ['match', ['get', 'severity'], 'critical', '#ef4444', 'high', '#f97316', 'medium', '#eab308', 'low', '#22c55e', '#6b7280'],
          'circle-opacity': 0.9,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'rgba(255,255,255,0.4)',
        },
      })

      map.addLayer({
        id: 'event-pulse', type: 'circle', source: 'events',
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'isBreaking'], true]],
        paint: {
          'circle-radius': 16,
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

  // ── Load flights (live, smooth update via setData) ────────────────────────
  const loadFlights = useCallback(async () => {
    const map = mapRef.current
    if (!map || !mapReady) return
    await waitForStyle(map)

    try {
      const res = await fetch('/api/v1/live/flights', { signal: AbortSignal.timeout(12000) })
      if (!res.ok) return
      const data = await res.json()

      const srcId = 'live-flights'
      const existing = map.getSource(srcId) as maplibregl.GeoJSONSource | undefined
      if (existing) { existing.setData(data); return } // smooth position update

      map.addSource(srcId, { type: 'geojson', data })

      map.addLayer({
        id: 'live-flights-layer', type: 'circle', source: srcId,
        paint: {
          'circle-radius': ['case', ['==', ['get', 'is_military'], true], 7, 4],
          'circle-color': ['case', ['==', ['get', 'is_military'], true], '#ef4444', '#60a5fa'],
          'circle-opacity': 0.9,
          'circle-stroke-width': ['case', ['==', ['get', 'is_military'], true], 2, 1],
          'circle-stroke-color': ['case', ['==', ['get', 'is_military'], true], '#fca5a5', 'rgba(255,255,255,0.3)'],
        },
      })

      map.addLayer({
        id: 'live-flights-labels', type: 'symbol', source: srcId,
        filter: ['==', ['get', 'is_military'], true],
        layout: {
          'text-field': ['get', 'callsign'],
          'text-size': 9,
          'text-offset': [0, 1.5],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#ef4444',
          'text-halo-color': 'rgba(0,0,0,0.9)',
          'text-halo-width': 1,
        },
      })
    } catch (err) {
      console.warn('[GlobeMap] loadFlights error:', err)
    }
  }, [mapReady])

  // ── Load vessels (live, smooth update via setData) ────────────────────────
  const loadVessels = useCallback(async () => {
    const map = mapRef.current
    if (!map || !mapReady) return
    await waitForStyle(map)

    try {
      const res = await fetch('/api/v1/live/vessels', { signal: AbortSignal.timeout(12000) })
      if (!res.ok) return
      const data = await res.json()

      const srcId = 'live-vessels'
      const existing = map.getSource(srcId) as maplibregl.GeoJSONSource | undefined
      if (existing) { existing.setData(data); return }

      map.addSource(srcId, { type: 'geojson', data })

      map.addLayer({
        id: 'live-vessels-layer', type: 'circle', source: srcId,
        paint: {
          'circle-radius': ['case', ['==', ['get', 'is_dark'], true], 7, 4],
          'circle-color': ['case', ['==', ['get', 'is_dark'], true], '#ef4444', '#34d399'],
          'circle-opacity': 0.85,
          'circle-stroke-width': 1,
          'circle-stroke-color': ['case', ['==', ['get', 'is_dark'], true], '#fca5a5', 'rgba(255,255,255,0.2)'],
        },
      })

      map.addLayer({
        id: 'live-vessels-dark-pulse', type: 'circle', source: srcId,
        filter: ['==', ['get', 'is_dark'], true],
        paint: {
          'circle-radius': 14,
          'circle-color': 'transparent',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ef4444',
          'circle-stroke-opacity': 0.4,
        },
      })
    } catch (err) {
      console.warn('[GlobeMap] loadVessels error:', err)
    }
  }, [mapReady])

  // ── Load seismic (live, smooth update via setData) ────────────────────────
  const loadSeismic = useCallback(async () => {
    const map = mapRef.current
    if (!map || !mapReady) return
    await waitForStyle(map)

    try {
      const res = await fetch('/api/v1/live/seismic', { signal: AbortSignal.timeout(12000) })
      if (!res.ok) return
      const data = await res.json()

      const srcId = 'live-seismic'
      const existing = map.getSource(srcId) as maplibregl.GeoJSONSource | undefined
      if (existing) { existing.setData(data); return }

      map.addSource(srcId, { type: 'geojson', data })

      map.addLayer({
        id: 'live-seismic-layer', type: 'circle', source: srcId,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'magnitude'], 2.5, 4, 4.0, 8, 5.0, 14, 6.0, 22, 7.0, 32],
          'circle-color': ['case', ['==', ['get', 'is_conflict_zone'], true], '#ef4444', '#f59e0b'],
          'circle-opacity': 0.45,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#f59e0b',
        },
      })

      map.addLayer({
        id: 'live-seismic-labels', type: 'symbol', source: srcId,
        filter: ['>=', ['get', 'magnitude'], 4.5],
        layout: {
          'text-field': ['concat', 'M', ['to-string', ['get', 'magnitude']]],
          'text-size': 10,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-offset': [0, 1.2],
        },
        paint: {
          'text-color': '#fff',
          'text-halo-color': 'rgba(0,0,0,0.8)',
          'text-halo-width': 1,
        },
      })
    } catch (err) {
      console.warn('[GlobeMap] loadSeismic error:', err)
    }
  }, [mapReady])

  // ── Remove a live layer group ─────────────────────────────────────────────
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

  // ── React to filter changes ───────────────────────────────────────────────
  useEffect(() => { void loadEvents() }, [loadEvents])

  // ── React to layer toggles ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return
    const loaders: Record<string, () => Promise<void>> = {
      flights: loadFlights,
      vessels: loadVessels,
      seismic: loadSeismic,
    }
    const all = ['flights', 'vessels', 'seismic', 'nuclear', 'outages', 'fires']
    for (const layer of all) {
      if (activeLayers.has(layer) && loaders[layer]) {
        void loaders[layer]()
      } else {
        void removeLiveLayer(layer)
      }
    }
  }, [activeLayers, mapReady, loadFlights, loadVessels, loadSeismic, removeLiveLayer])

  // ── Refresh intervals ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return
    const evtInt = setInterval(() => { void loadEvents() }, 60000)
    const fltInt = setInterval(() => { if (activeLayers.has('flights')) void loadFlights() }, 30000)
    const vslInt = setInterval(() => { if (activeLayers.has('vessels')) void loadVessels() }, 60000)
    const seisInt = setInterval(() => { if (activeLayers.has('seismic')) void loadSeismic() }, 120000)
    return () => { clearInterval(evtInt); clearInterval(fltInt); clearInterval(vslInt); clearInterval(seisInt) }
  }, [mapReady, activeLayers, loadEvents, loadFlights, loadVessels, loadSeismic])

  // ── Hover popup + click handlers ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const popup = new maplibregl.Popup({
      closeButton: false, closeOnClick: false, className: 'cr-popup', maxWidth: '300px',
    })
    popupRef.current = popup

    function buildHtml(props: Record<string, unknown>, layerId: string): string {
      // Flight
      if (props.callsign !== undefined || props.icao24 !== undefined) {
        const isMil = props.is_military === true || props.is_military === 'true'
        return `<div style="font-family:-apple-system,sans-serif;min-width:180px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <span style="font-size:14px">${isMil ? '🎖️' : '✈️'}</span>
            <span style="font-size:10px;font-weight:700;color:${isMil ? '#ef4444' : '#60a5fa'};text-transform:uppercase">${isMil ? 'Military Aircraft' : 'Aircraft'}</span>
          </div>
          <div style="font-size:13px;font-weight:600;color:#e2e8f0;margin-bottom:6px">${String(props.callsign ?? props.icao24 ?? '')}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px">
            <span style="color:#64748b">Country</span><span style="color:#94a3b8">${String(props.origin_country ?? 'Unknown')}</span>
            <span style="color:#64748b">Altitude</span><span style="color:#94a3b8">${props.altitude ? Number(props.altitude).toLocaleString() + ' ft' : 'N/A'}</span>
            <span style="color:#64748b">Speed</span><span style="color:#94a3b8">${Math.round(Number(props.velocity ?? 0))} kts</span>
            <span style="color:#64748b">Zone</span><span style="color:#94a3b8">${String(props.zone_name ?? 'N/A')}</span>
          </div>
          ${isMil ? '<div style="margin-top:6px;padding:4px 8px;background:rgba(239,68,68,0.12);border-radius:4px;font-size:10px;color:#ef4444;font-weight:600">⚠ Military zone activity</div>' : ''}
        </div>`
      }
      // Vessel
      if (props.mmsi !== undefined) {
        const isDark = props.is_dark === true || props.is_dark === 'true'
        return `<div style="font-family:-apple-system,sans-serif;min-width:180px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <span style="font-size:14px">${isDark ? '⚠️' : '🚢'}</span>
            <span style="font-size:10px;font-weight:700;color:${isDark ? '#ef4444' : '#34d399'};text-transform:uppercase">${isDark ? 'Dark Ship' : 'Vessel'}</span>
          </div>
          <div style="font-size:13px;font-weight:600;color:#e2e8f0;margin-bottom:6px">${String(props.name ?? 'Unknown')}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px">
            <span style="color:#64748b">Type</span><span style="color:#94a3b8;text-transform:capitalize">${String(props.ship_type ?? 'Unknown')}</span>
            <span style="color:#64748b">Flag</span><span style="color:#94a3b8">${String(props.flag ?? 'Unknown')}</span>
            <span style="color:#64748b">Speed</span><span style="color:#94a3b8">${Math.round(Number(props.speed ?? 0))} kts</span>
            <span style="color:#64748b">Zone</span><span style="color:#94a3b8">${String(props.zone_name ?? 'N/A')}</span>
          </div>
          ${isDark ? '<div style="margin-top:6px;padding:4px 8px;background:rgba(239,68,68,0.12);border-radius:4px;font-size:10px;color:#ef4444;font-weight:600">⚠ AIS silent — possible ops or evasion</div>' : ''}
        </div>`
      }
      // Seismic (via magnitude, mag, or is_suspicious)
      if (props.magnitude !== undefined || props.mag !== undefined || layerId.includes('seismic')) {
        const mag = props.magnitude ?? props.mag
        const isConflict = props.is_conflict_zone === true || props.is_conflict_zone === 'true' ||
          props.is_suspicious === true || props.is_suspicious === 'true'
        return `<div style="font-family:-apple-system,sans-serif;min-width:160px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <span style="font-size:14px">${isConflict ? '⚠️' : '🌍'}</span>
            <span style="font-size:10px;font-weight:700;color:${isConflict ? '#ef4444' : '#f59e0b'};text-transform:uppercase">${isConflict ? 'Conflict Zone Seismic' : 'Seismic Event'}</span>
          </div>
          <div style="font-size:20px;font-weight:700;color:#e2e8f0;margin-bottom:4px">M${mag}</div>
          <div style="font-size:11px;color:#94a3b8">Depth: ${String(props.depth ?? '?')}km</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:2px">${String(props.place ?? '')}</div>
          ${isConflict ? '<div style="margin-top:6px;padding:4px 8px;background:rgba(239,68,68,0.12);border-radius:4px;font-size:10px;color:#ef4444;font-weight:600">⚠ Possible explosion or weapons test</div>' : ''}
        </div>`
      }
      // Event
      if (props.title) {
        const sev = String(props.severity ?? 'low')
        const col = SEV_COLORS[sev] ?? '#6b7280'
        const isBreaking = props.isBreaking === true || props.isBreaking === 'true'
        return `<div style="font-family:-apple-system,sans-serif;min-width:200px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <span style="width:8px;height:8px;border-radius:50%;background:${col}"></span>
            <span style="font-size:10px;font-weight:700;color:${col};text-transform:uppercase">${sev}</span>
            ${isBreaking ? '<span style="font-size:9px;font-weight:700;color:#ef4444;background:rgba(239,68,68,0.15);padding:1px 6px;border-radius:3px">BREAKING</span>' : ''}
          </div>
          <div style="font-size:12px;font-weight:600;color:#e2e8f0;line-height:1.4;margin-bottom:6px">${String(props.title).substring(0, 120)}</div>
          <div style="font-size:10px;color:#64748b">${String(props.region ?? '').replace(/_/g, ' ')} ${props.source ? '· ' + String(props.source) : ''}</div>
          <div style="margin-top:6px;font-size:10px;color:#3b82f6">Click for intel brief →</div>
        </div>`
      }
      return ''
    }

    const handleHover = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const m = mapRef.current
      if (!m) return
      m.getCanvas().style.cursor = 'pointer'
      const f = e.features?.[0]
      if (!f) return
      const props = (f.properties ?? {}) as Record<string, unknown>
      const geom = f.geometry as GeoJSON.Point
      const html = buildHtml(props, (f.layer?.id as string) ?? '')
      if (html) popup.setLngLat(geom.coordinates as [number, number]).setHTML(html).addTo(m)
    }

    const handleLeave = () => {
      const m = mapRef.current
      if (m) m.getCanvas().style.cursor = ''
      popup.remove()
    }

    const handleEventClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const m = mapRef.current
      if (!m) return
      const f = e.features?.[0]
      if (!f) return
      const p = (f.properties ?? {}) as Record<string, unknown>
      if (!p.title) return

      const eventData: MapEvent = {
        id: String(p.id ?? ''),
        title: String(p.title ?? ''),
        severity: String(p.severity ?? 'low'),
        event_type: String(p.event_type ?? ''),
        category: String(p.event_type ?? 'general'),
        region: p.region ? String(p.region) : undefined,
        publishedAt: p.publishedAt ? String(p.publishedAt) : undefined,
        sourceUrl: p.sourceUrl ? String(p.sourceUrl) : undefined,
        summary: p.summary ? String(p.summary) : undefined,
        isBreaking: p.isBreaking === true || p.isBreaking === 'true',
        source: p.source ? String(p.source) : undefined,
      }
      onEventClick(eventData)

      const geom = f.geometry as GeoJSON.Point
      m.flyTo({ center: geom.coordinates as [number, number], zoom: Math.max(m.getZoom(), 5), duration: 800 })
    }

    const handleClusterClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const m = mapRef.current
      if (!m) return
      const f = e.features?.[0]
      if (!f) return
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
    for (const layer of hoverLayers) {
      map.on('mouseenter', layer, handleHover)
      map.on('mouseleave', layer, handleLeave)
    }
    map.on('click', 'event-points', handleEventClick)
    map.on('click', 'event-clusters', handleClusterClick)

    return () => {
      for (const layer of hoverLayers) {
        map.off('mouseenter', layer, handleHover)
        map.off('mouseleave', layer, handleLeave)
      }
      map.off('click', 'event-points', handleEventClick)
      map.off('click', 'event-clusters', handleClusterClick)
      popup.remove()
    }
  }, [mapReady, onEventClick])

  return (
    <>
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />
      <style>{`
        .cr-popup .maplibregl-popup-content {
          background: rgba(13,17,23,0.96) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 12px !important;
          padding: 12px 14px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
          backdrop-filter: blur(16px) !important;
        }
        .cr-popup .maplibregl-popup-tip { border-top-color: rgba(13,17,23,0.96) !important; }
        .maplibregl-ctrl-group { background: rgba(13,17,23,0.85) !important; border: 1px solid rgba(255,255,255,0.1) !important; border-radius: 8px !important; overflow: hidden !important; }
        .maplibregl-ctrl-group button { background: transparent !important; border-color: rgba(255,255,255,0.05) !important; }
        .maplibregl-ctrl-group button span { filter: invert(1) !important; }
        .maplibregl-ctrl-attrib { background: rgba(0,0,0,0.4) !important; color: rgba(255,255,255,0.3) !important; font-size: 9px !important; }
      `}</style>
    </>
  )
}
