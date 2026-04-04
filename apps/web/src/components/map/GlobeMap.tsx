'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

export interface MapEvent {
  id: string
  title: string
  severity: string
  event_type?: string
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
  onStatsUpdate: (stats: Stats) => void
  onEventClick?: (event: MapEvent) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getMapStyle(key: string | undefined): string {
  if (key && key.length > 8) {
    return `https://api.maptiler.com/maps/satellite/style.json?key=${key}`
  }
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

export default function GlobeMap({ timeWindow, severity, activeLayers, onStatsUpdate, onEventClick }: GlobeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const rotateRef = useRef<number | null>(null)
  const [mapReady, setMapReady] = useState(false)

  // ── Init ─────────────────────────────────────────────────────────────────
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
      attributionControl: false,
      fadeDuration: 200,
    })

    map.on('style.load', () => {
      // Globe projection
      try {
        ;(map as unknown as { setProjection: (p: unknown) => void }).setProjection({ type: 'globe' })
      } catch { /* not supported in fallback style */ }

      // Atmosphere (MapTiler only)
      if (key && key.length > 8) {
        try {
          ;(map as unknown as { setFog: (f: unknown) => void }).setFog({
            'color': 'rgb(8, 15, 35)',
            'high-color': 'rgb(15, 40, 100)',
            'horizon-blend': 0.06,
            'space-color': 'rgb(3, 5, 18)',
            'star-intensity': 0.9,
          })
        } catch { /* ignore */ }
      }

      setMapReady(true)
    })

    // Smooth auto-rotate
    let lastTs = 0
    function rotate(ts: number) {
      if (!map.isMoving() && map.isStyleLoaded()) {
        const delta = lastTs ? (ts - lastTs) / 1000 : 0
        if (delta > 0 && delta < 0.2) {
          const c = map.getCenter()
          map.setCenter([c.lng - delta * 2.5, c.lat])
        }
      }
      lastTs = ts
      rotateRef.current = requestAnimationFrame(rotate)
    }
    rotateRef.current = requestAnimationFrame(rotate)

    const stopRotate = () => {
      if (rotateRef.current) { cancelAnimationFrame(rotateRef.current); rotateRef.current = null }
    }
    const resumeRotate = () => {
      if (!rotateRef.current) { lastTs = 0; rotateRef.current = requestAnimationFrame(rotate) }
    }

    map.on('mousedown', stopRotate)
    map.on('touchstart', stopRotate)
    map.on('mouseup', () => setTimeout(resumeRotate, 5000))
    map.on('touchend', () => setTimeout(resumeRotate, 5000))
    map.on('wheel', () => { stopRotate(); setTimeout(resumeRotate, 5000) })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

    mapRef.current = map

    return () => {
      stopRotate()
      popupRef.current?.remove()
      map.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Load events ──────────────────────────────────────────────────────────
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

      // Update stats from meta
      if (data.meta) {
        onStatsUpdate({
          tracked: data.meta.total ?? 0,
          critical: data.meta.critical ?? 0,
          high: data.meta.high ?? 0,
          medium: data.meta.medium ?? 0,
          low: data.meta.low ?? 0,
        })
      }

      // Remove old layers/sources
      const layerIds = ['event-pulse', 'event-points', 'cluster-count', 'event-clusters']
      for (const id of layerIds) safeRemoveLayer(map, id)
      safeRemoveSource(map, 'events')

      // Add source
      map.addSource('events', {
        type: 'geojson',
        data: data,
        cluster: true,
        clusterMaxZoom: 10,
        clusterRadius: 50,
      })

      // Cluster circles — color by count
      map.addLayer({
        id: 'event-clusters',
        type: 'circle',
        source: 'events',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step', ['get', 'point_count'],
            '#3b82f6', 10, '#f97316', 50, '#ef4444',
          ],
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 30],
          'circle-opacity': 0.85,
          'circle-stroke-width': 2,
          'circle-stroke-color': 'rgba(255,255,255,0.3)',
        },
      })

      // Cluster count labels
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'events',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-size': 12,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        },
        paint: { 'text-color': '#ffffff' },
      })

      // Individual event points — colored by severity string
      map.addLayer({
        id: 'event-points',
        type: 'circle',
        source: 'events',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': ['match', ['get', 'severity'], 'critical', 8, 'high', 7, 'medium', 6, 5],
          'circle-color': [
            'match', ['get', 'severity'],
            'critical', '#ef4444',
            'high', '#f97316',
            'medium', '#eab308',
            '#22c55e',
          ],
          'circle-opacity': 0.92,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': [
            'match', ['get', 'severity'],
            'critical', 'rgba(254,202,202,0.6)',
            'high', 'rgba(254,215,170,0.6)',
            'medium', 'rgba(254,240,138,0.5)',
            'rgba(187,247,208,0.5)',
          ],
        },
      })

      // Pulse ring for breaking events
      map.addLayer({
        id: 'event-pulse',
        type: 'circle',
        source: 'events',
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'isBreaking'], true]],
        paint: {
          'circle-radius': 16,
          'circle-color': 'transparent',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ef4444',
          'circle-stroke-opacity': 0.55,
        },
      })

    } catch (err) {
      console.warn('[GlobeMap] loadEvents error:', err)
    }
  }, [timeWindow, severity, mapReady, onStatsUpdate])

  // ── Load live layer ───────────────────────────────────────────────────────
  const loadLiveLayer = useCallback(async (layerId: string) => {
    const map = mapRef.current
    if (!map || !mapReady) return
    await waitForStyle(map)

    const endpoints: Record<string, string> = {
      flights: '/api/v1/live/flights',
      vessels: '/api/v1/live/vessels',
      seismic: '/api/v1/live/seismic',
      fires: '/api/v1/live/fires',
      nuclear: '/api/v1/live/nuclear',
      outages: '/api/v1/live/outages',
    }
    const colors: Record<string, string> = {
      flights: '#60a5fa', vessels: '#34d399', seismic: '#f59e0b',
      fires: '#ff4500', nuclear: '#a78bfa', outages: '#8b5cf6',
    }

    const endpoint = endpoints[layerId]
    if (!endpoint) return

    try {
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(12000) })
      if (!res.ok) return
      const data = await res.json()

      const srcId = `live-${layerId}`
      const lyrId = `live-${layerId}-layer`
      const lblId = `live-${layerId}-label`

      safeRemoveLayer(map, lblId)
      safeRemoveLayer(map, lyrId)
      safeRemoveSource(map, srcId)

      map.addSource(srcId, { type: 'geojson', data })
      const col = colors[layerId] ?? '#94a3b8'

      if (layerId === 'flights') {
        map.addLayer({
          id: lyrId, type: 'circle', source: srcId,
          paint: {
            'circle-radius': ['case', ['==', ['get', 'is_military'], true], 6, 4],
            'circle-color': ['case', ['==', ['get', 'is_military'], true], '#ef4444', col],
            'circle-opacity': 0.85,
            'circle-stroke-width': 1,
            'circle-stroke-color': 'rgba(255,255,255,0.3)',
          },
        })
        map.addLayer({
          id: lblId, type: 'symbol', source: srcId,
          filter: ['==', ['get', 'is_military'], true],
          layout: {
            'text-field': ['get', 'callsign'],
            'text-size': 9,
            'text-offset': [0, 1.4],
            'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          },
          paint: {
            'text-color': '#ef4444',
            'text-halo-color': 'rgba(0,0,0,0.8)',
            'text-halo-width': 1,
          },
        })
      } else if (layerId === 'vessels') {
        map.addLayer({
          id: lyrId, type: 'circle', source: srcId,
          paint: {
            'circle-radius': ['case', ['==', ['get', 'is_dark'], true], 6, 4],
            'circle-color': ['case', ['==', ['get', 'is_dark'], true], '#ef4444', col],
            'circle-opacity': 0.8,
            'circle-stroke-width': ['case', ['==', ['get', 'is_dark'], true], 2, 1],
            'circle-stroke-color': ['case', ['==', ['get', 'is_dark'], true], '#fca5a5', 'rgba(255,255,255,0.2)'],
          },
        })
      } else if (layerId === 'seismic') {
        map.addLayer({
          id: lyrId, type: 'circle', source: srcId,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 2.5, 4, 4.0, 8, 5.0, 14, 6.0, 22, 7.0, 32],
            'circle-color': ['case', ['==', ['get', 'is_suspicious'], true], '#ef4444', col],
            'circle-opacity': 0.5,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': col,
          },
        })
        map.addLayer({
          id: lblId, type: 'symbol', source: srcId,
          filter: ['>=', ['get', 'mag'], 4.5],
          layout: {
            'text-field': ['concat', 'M', ['to-string', ['get', 'mag']]],
            'text-size': 10,
            'text-offset': [0, 1.2],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          },
          paint: {
            'text-color': '#fff',
            'text-halo-color': 'rgba(0,0,0,0.8)',
            'text-halo-width': 1,
          },
        })
      } else {
        // fires, nuclear, outages — simple circles
        map.addLayer({
          id: lyrId, type: 'circle', source: srcId,
          paint: {
            'circle-radius': 5,
            'circle-color': col,
            'circle-opacity': 0.8,
            'circle-stroke-width': 1,
            'circle-stroke-color': `${col}60`,
          },
        })
      }

      // Setup interaction for live layer
      map.on('mouseenter', lyrId, () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', lyrId, () => { map.getCanvas().style.cursor = '' })
    } catch (err) {
      console.warn(`[GlobeMap] loadLiveLayer(${layerId}) error:`, err)
    }
  }, [mapReady])

  const removeLiveLayer = useCallback(async (layerId: string) => {
    const map = mapRef.current
    if (!map || !mapReady) return
    await waitForStyle(map)
    safeRemoveLayer(map, `live-${layerId}-label`)
    safeRemoveLayer(map, `live-${layerId}-layer`)
    safeRemoveSource(map, `live-${layerId}`)
  }, [mapReady])

  // ── React to filter changes ───────────────────────────────────────────────
  useEffect(() => { void loadEvents() }, [loadEvents])

  // ── React to layer toggles ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return
    const allLayers = ['flights', 'vessels', 'seismic', 'nuclear', 'outages', 'fires']
    for (const layer of allLayers) {
      if (activeLayers.has(layer)) {
        void loadLiveLayer(layer)
      } else {
        void removeLiveLayer(layer)
      }
    }
  }, [activeLayers, mapReady, loadLiveLayer, removeLiveLayer])

  // ── Auto-refresh every 60s ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return
    const t = setInterval(() => {
      void loadEvents()
      activeLayers.forEach(l => { if (l !== 'events') void loadLiveLayer(l) })
    }, 60000)
    return () => clearInterval(t)
  }, [mapReady, activeLayers, loadEvents, loadLiveLayer])

  // ── Hover popup + click handlers ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const popup = new maplibregl.Popup({
      closeButton: false, closeOnClick: false, className: 'cr-popup', maxWidth: '280px',
    })
    popupRef.current = popup

    function buildHtml(props: Record<string, unknown>, layerId: string): string {
      const sevColors: Record<string, string> = {
        critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e',
      }
      if (props.title) {
        const sev = String(props.severity ?? 'low')
        const col = sevColors[sev] ?? '#6b7280'
        return `<div style="font-family:system-ui,sans-serif">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span style="width:8px;height:8px;border-radius:50%;background:${col};display:inline-block"></span>
            <span style="font-size:10px;font-weight:700;color:${col};text-transform:uppercase">${sev}</span>
          </div>
          <div style="font-size:12px;font-weight:600;color:#e2e8f0;line-height:1.3;margin-bottom:4px">${String(props.title).substring(0, 100)}</div>
          <div style="font-size:10px;color:#94a3b8">${props.region ? String(props.region).replace(/_/g, ' ') : ''} ${props.source ? '· ' + String(props.source) : ''}</div>
        </div>`
      }
      if (layerId.includes('flights')) {
        const isMil = props.is_military === true || props.is_military === 'true'
        return `<div style="font-family:system-ui,sans-serif">
          <div style="font-size:10px;font-weight:700;color:${isMil ? '#ef4444' : '#60a5fa'};text-transform:uppercase;margin-bottom:2px">${isMil ? '🎖 MILITARY' : '✈️ FLIGHT'}</div>
          <div style="font-size:12px;font-weight:600;color:#e2e8f0">${String(props.callsign ?? props.icao24 ?? '')}</div>
          <div style="font-size:10px;color:#94a3b8;margin-top:2px">${String(props.origin_country ?? '')} · ${Math.round(Number(props.altitude ?? 0)).toLocaleString()}ft</div>
        </div>`
      }
      if (layerId.includes('vessels')) {
        const isDark = props.is_dark === true || props.is_dark === 'true'
        return `<div style="font-family:system-ui,sans-serif">
          <div style="font-size:10px;font-weight:700;color:${isDark ? '#ef4444' : '#34d399'};text-transform:uppercase;margin-bottom:2px">${isDark ? '⚠️ DARK SHIP' : '🚢 VESSEL'}</div>
          <div style="font-size:12px;font-weight:600;color:#e2e8f0">${String(props.name ?? props.mmsi ?? '')}</div>
          <div style="font-size:10px;color:#94a3b8;margin-top:2px">${String(props.ship_type ?? '')} · ${Math.round(Number(props.speed ?? 0))} kts</div>
        </div>`
      }
      if (layerId.includes('seismic')) {
        const isConflict = props.is_suspicious === true || props.is_suspicious === 'true'
        return `<div style="font-family:system-ui,sans-serif">
          <div style="font-size:10px;font-weight:700;color:${isConflict ? '#ef4444' : '#f59e0b'};text-transform:uppercase;margin-bottom:2px">${isConflict ? '⚠️ CONFLICT SEISMIC' : '🌍 SEISMIC'}</div>
          <div style="font-size:16px;font-weight:700;color:#e2e8f0">M${props.mag ?? props.magnitude ?? '?'}</div>
          <div style="font-size:10px;color:#94a3b8;margin-top:2px">${String(props.place ?? '')} · ${Math.round(Number(props.depth ?? 0))}km depth</div>
        </div>`
      }
      return ''
    }

    const interactiveLayers = ['event-points', 'live-flights-layer', 'live-vessels-layer', 'live-seismic-layer']

    function onMouseEnter(e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) {
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
    function onMouseLeave() {
      const m = mapRef.current
      if (m) m.getCanvas().style.cursor = ''
      popup.remove()
    }
    function onClick(e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) {
      const m = mapRef.current
      if (!m) return
      const f = e.features?.[0]
      if (!f) return
      const props = (f.properties ?? {}) as Record<string, unknown>
      if (props.title && onEventClick) {
        onEventClick(props as unknown as MapEvent)
      }
      if (props.cluster_id) {
        ;(m.getSource('events') as maplibregl.GeoJSONSource)
          .getClusterExpansionZoom(props.cluster_id as number)
          .then(zoom => {
            const geom = f.geometry as GeoJSON.Point
            m.easeTo({ center: geom.coordinates as [number, number], zoom: zoom + 1, duration: 400 })
          })
          .catch(() => null)
      }
    }

    for (const lyr of interactiveLayers) {
      map.on('mouseenter', lyr, onMouseEnter)
      map.on('mouseleave', lyr, onMouseLeave)
    }
    map.on('click', 'event-points', onClick)
    map.on('click', 'event-clusters', onClick)

    return () => {
      for (const lyr of interactiveLayers) {
        map.off('mouseenter', lyr, onMouseEnter)
        map.off('mouseleave', lyr, onMouseLeave)
      }
      map.off('click', 'event-points', onClick)
      map.off('click', 'event-clusters', onClick)
      popup.remove()
    }
  }, [mapReady, onEventClick])

  return (
    <>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0, background: '#060a10' }} />
      <style>{`
        .cr-popup .maplibregl-popup-content {
          background: rgba(10,13,20,0.96) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 10px !important;
          padding: 10px 13px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
          backdrop-filter: blur(12px) !important;
        }
        .cr-popup .maplibregl-popup-tip { border-top-color: rgba(10,13,20,0.96) !important; }
        .maplibregl-ctrl-attrib { background: rgba(0,0,0,0.5) !important; color: rgba(255,255,255,0.3) !important; font-size: 9px !important; }
        .maplibregl-ctrl-group { background: rgba(10,13,20,0.9) !important; border: 1px solid rgba(255,255,255,0.1) !important; border-radius: 8px !important; overflow: hidden; }
        .maplibregl-ctrl-group button { background: transparent !important; color: #9ca3af !important; }
        .maplibregl-ctrl-group button:hover { background: rgba(255,255,255,0.08) !important; color: #fff !important; }
      `}</style>
    </>
  )
}
