'use client'

import { useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

export interface MapEvent {
  id: string
  title: string
  severity: string
  event_type?: string
  country_region?: string
  published_at: string
  source_url?: string
  summary_short?: string
  is_breaking?: boolean
}

interface GlobeMapProps {
  window?: string
  severity?: string
  activeLayers?: Set<string>
  onEventClick?: (event: MapEvent) => void
  onStatsUpdate?: (stats: { total: number; critical: number; high: number; medium: number; low: number }) => void
}

const LAYER_COLORS: Record<string, string> = {
  flights: '#60a5fa',
  vessels: '#34d399',
  seismic: '#f59e0b',
  fires: '#ff4500',
  nuclear: '#a78bfa',
  outages: '#8b5cf6',
}

function waitForStyle(map: maplibregl.Map, timeoutMs = 5000): Promise<void> {
  return new Promise(resolve => {
    if (map.isStyleLoaded()) { resolve(); return }
    let done = false
    const finish = () => { if (!done) { done = true; resolve() } }
    const t = window.setTimeout(finish, timeoutMs)
    map.once('style.load', () => { clearTimeout(t); finish() })
  })
}

function severityColor(severity: string): string {
  const m: Record<string, string> = {
    critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e',
  }
  return m[severity?.toLowerCase()] ?? '#22c55e'
}

function getMapStyle(maptilerKey: string | undefined): string {
  if (maptilerKey && maptilerKey !== 'get_your_free_key_at_maptiler.com') {
    return `https://api.maptiler.com/maps/satellite/style.json?key=${maptilerKey}`
  }
  // Free fallback — CARTO dark matter (no key required)
  return 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
}

export default function GlobeMap({
  window: timeWindow = '7d',
  severity = 'all',
  activeLayers = new Set(['events']),
  onEventClick,
  onStatsUpdate,
}: GlobeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const rotateRef = useRef<number | null>(null)
  const interactingRef = useRef(false)
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadLayer = useCallback(async (layerName: string) => {
    const map = mapRef.current
    if (!map) return
    await waitForStyle(map)

    const endpoint = layerName === 'events'
      ? `/api/v1/map/events?window=${timeWindow}${severity !== 'all' ? `&severity=${severity}` : ''}`
      : `/api/v1/live/${layerName}`

    try {
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(12000) })
      if (!res.ok) return
      const geojson = await res.json()

      if (!map || !map.isStyleLoaded()) return

      const existing = map.getSource(layerName) as maplibregl.GeoJSONSource | undefined
      if (existing) {
        existing.setData(geojson)
      } else {
        map.addSource(layerName, {
          type: 'geojson',
          data: geojson,
          ...(layerName === 'events' ? { cluster: true, clusterMaxZoom: 5, clusterRadius: 45 } : {}),
        })
        renderLayer(map, layerName)
      }

      if (layerName === 'events' && onStatsUpdate && geojson.features) {
        const features = (geojson.features as Array<{ properties: Record<string, unknown> }>).filter(f => !f.properties?.cluster)
        onStatsUpdate({
          total: features.length,
          critical: features.filter(f => f.properties?.severity === 'critical').length,
          high: features.filter(f => f.properties?.severity === 'high').length,
          medium: features.filter(f => f.properties?.severity === 'medium').length,
          low: features.filter(f => f.properties?.severity === 'low').length,
        })
      }
    } catch (err) {
      console.warn(`[Globe] Layer "${layerName}" failed:`, err)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeWindow, severity, onStatsUpdate])

  function renderLayer(map: maplibregl.Map, layerName: string) {
    if (layerName === 'events') renderEventsLayer(map)
    else renderLiveLayer(map, layerName)
    setupLayerInteraction(map, layerName)
  }

  function renderEventsLayer(map: maplibregl.Map) {
    map.addLayer({
      id: 'events-cluster',
      type: 'circle',
      source: 'events',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#6366f1',
        'circle-radius': ['step', ['get', 'point_count'], 14, 5, 20, 20, 26],
        'circle-opacity': 0.85,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': 'rgba(129,140,248,0.6)',
      },
    })

    map.addLayer({
      id: 'events-cluster-count',
      type: 'symbol',
      source: 'events',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-size': 11,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      },
      paint: { 'text-color': '#fff' },
    })

    map.addLayer({
      id: 'events-circle',
      type: 'circle',
      source: 'events',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': ['match', ['get', 'severity'], 'critical', 8, 'high', 7, 'medium', 6, 5],
        'circle-color': ['match', ['get', 'severity'], 'critical', '#ef4444', 'high', '#f97316', 'medium', '#eab308', '#22c55e'],
        'circle-opacity': 0.92,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': ['match', ['get', 'severity'],
          'critical', 'rgba(254,202,202,0.6)',
          'high', 'rgba(254,215,170,0.6)',
          'medium', 'rgba(254,240,138,0.6)',
          'rgba(187,247,208,0.6)',
        ],
      },
    })

    map.addLayer({
      id: 'events-pulse',
      type: 'circle',
      source: 'events',
      filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'is_breaking'], true]],
      paint: {
        'circle-radius': 14,
        'circle-color': 'transparent',
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#ef4444',
        'circle-stroke-opacity': 0.5,
      },
    })
  }

  function renderLiveLayer(map: maplibregl.Map, layerName: string) {
    const color = LAYER_COLORS[layerName] ?? '#94a3b8'
    const radius: maplibregl.ExpressionSpecification | number =
      layerName === 'seismic'
        ? ['interpolate', ['linear'], ['get', 'mag'], 1.5, 5, 4, 10, 7, 18]
        : layerName === 'nuclear' ? 8
        : layerName === 'fires' ? 5
        : 7

    const circleColor: maplibregl.ExpressionSpecification | string =
      layerName === 'seismic'
        ? ['case', ['==', ['get', 'is_suspicious'], true], '#ef4444', color]
        : color

    map.addLayer({
      id: `${layerName}-circle`,
      type: 'circle',
      source: layerName,
      paint: {
        'circle-radius': radius,
        'circle-color': circleColor,
        'circle-opacity': 0.88,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': `${color}60`,
      },
    })
  }

  function setupLayerInteraction(map: maplibregl.Map, layerName: string) {
    const layerId = layerName === 'events' ? 'events-circle' : `${layerName}-circle`
    if (!map.getLayer(layerId)) return

    map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = '' })

    const layerLabel: Record<string, string> = {
      events: '', flights: '✈️ FLIGHT', vessels: '🚢 VESSEL',
      seismic: '💥 SEISMIC', fires: '🔥 FIRE', nuclear: '☢️ NUCLEAR', outages: '🌐 OUTAGE',
    }

    map.on('mouseenter', layerId, (e) => {
      if (!e.features?.[0]) return
      const props = e.features[0].properties as Record<string, unknown>
      const geom = e.features[0].geometry as GeoJSON.Point
      const coords = geom.coordinates as [number, number]

      popupRef.current?.remove()
      popupRef.current = new maplibregl.Popup({
        closeButton: false, closeOnClick: false, maxWidth: '260px', className: 'cr-popup',
      })
        .setLngLat(coords)
        .setHTML(`
          <div style="font-family:system-ui,sans-serif;padding:2px 0">
            ${layerLabel[layerName] ? `<div style="font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#6b7280;margin-bottom:4px">${layerLabel[layerName]}</div>` : ''}
            <div style="font-size:12px;font-weight:600;color:#f9fafb;line-height:1.4;margin-bottom:6px">
              ${String(props.title ?? props.name ?? props.callsign ?? props.place ?? 'Unknown')}
            </div>
            ${props.country_region ? `<div style="font-size:10px;color:#9ca3af;margin-bottom:4px">${props.country_region}</div>` : ''}
            ${props.severity ? `<span style="background:${severityColor(String(props.severity))};color:#fff;padding:2px 7px;border-radius:4px;font-size:9px;font-weight:700;text-transform:uppercase">${props.severity}</span>` : ''}
            ${props.mag ? `<div style="font-size:10px;color:#9ca3af;margin-top:4px">M${props.mag} · ${props.depth}km depth${props.is_suspicious ? ' · ⚠️ Suspicious' : ''}</div>` : ''}
            ${props.speed_knots ? `<div style="font-size:10px;color:#9ca3af;margin-top:4px">${String(props.flag ?? '')} ${Math.round(Number(props.speed_knots))} kts → ${String(props.destination ?? 'Unknown')}</div>` : ''}
            ${props.altitude_ft ? `<div style="font-size:10px;color:#9ca3af;margin-top:4px">${Number(props.altitude_ft).toLocaleString()}ft</div>` : ''}
          </div>
        `)
        .addTo(map)
    })

    map.on('mouseleave', layerId, () => { popupRef.current?.remove() })

    map.on('click', layerId, (e) => {
      if (!e.features?.[0] || layerName !== 'events') return
      if (onEventClick) onEventClick(e.features[0].properties as MapEvent)
    })

    if (layerName === 'events') {
      map.on('click', 'events-cluster', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['events-cluster'] })
        const clusterId = features[0]?.properties?.cluster_id as number | undefined
        if (!clusterId) return
        ;(map.getSource('events') as maplibregl.GeoJSONSource).getClusterExpansionZoom(clusterId).then(zoom => {
          const f0 = features[0]
          if (!f0) return
          const geom = f0.geometry as GeoJSON.Point
          map.easeTo({ center: geom.coordinates as [number, number], zoom: zoom + 0.5 })
        }).catch(() => null)
      })
      map.on('mouseenter', 'events-cluster', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'events-cluster', () => { map.getCanvas().style.cursor = '' })
    }
  }

  async function removeLayer(map: maplibregl.Map, layerName: string) {
    await waitForStyle(map)
    const layerIds = layerName === 'events'
      ? ['events-pulse', 'events-circle', 'events-cluster-count', 'events-cluster']
      : [`${layerName}-circle`]
    for (const id of layerIds) {
      try { if (map.getLayer(id)) map.removeLayer(id) } catch { /* ignore */ }
    }
    try { if (map.getSource(layerName)) map.removeSource(layerName) } catch { /* ignore */ }
  }

  function startRotate(map: maplibregl.Map) {
    function frame() {
      if (!interactingRef.current && map.isStyleLoaded()) {
        map.setCenter([map.getCenter().lng + 0.10, map.getCenter().lat])
      }
      rotateRef.current = requestAnimationFrame(frame)
    }
    rotateRef.current = requestAnimationFrame(frame)
  }

  function stopRotate() {
    if (rotateRef.current != null) {
      cancelAnimationFrame(rotateRef.current)
      rotateRef.current = null
    }
  }

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY
    const mapStyle = getMapStyle(maptilerKey)

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: [20, 25],
      zoom: 1.8,
      attributionControl: false,
      fadeDuration: 200,
    })

    mapRef.current = map

    map.on('style.load', async () => {
      // Globe projection
      try { (map as maplibregl.Map & { setProjection: (p: unknown) => void }).setProjection({ type: 'globe' }) } catch {
        try { (map as maplibregl.Map & { setProjection: (p: string) => void }).setProjection('globe') } catch { /* not supported */ }
      }

      // Atmosphere (MapTiler only)
      if (maptilerKey) {
        try {
          (map as maplibregl.Map & { setFog: (f: unknown) => void }).setFog({
            'color': 'rgb(8, 15, 35)',
            'high-color': 'rgb(15, 40, 100)',
            'horizon-blend': 0.04,
            'space-color': 'rgb(3, 5, 18)',
            'star-intensity': 0.9,
          })
        } catch { /* ignore */ }
      }

      await loadLayer('events')
    })

    const pauseRotate = () => {
      interactingRef.current = true
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    }
    const resumeRotate = () => {
      resumeTimerRef.current = setTimeout(() => { interactingRef.current = false }, 3000)
    }

    map.on('mousedown', pauseRotate)
    map.on('mouseup', resumeRotate)
    map.on('touchstart', pauseRotate)
    map.on('touchend', resumeRotate)
    map.on('load', () => startRotate(map))

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }),
      'bottom-right',
    )

    return () => {
      stopRotate()
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
      popupRef.current?.remove()
      map.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // React to filter changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    loadLayer('events')
  }, [timeWindow, severity, loadLayer])

  // React to layer toggles
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const liveLayerNames = ['flights', 'vessels', 'seismic', 'fires', 'nuclear', 'outages'];
    (async () => {
      for (const name of liveLayerNames) {
        if (activeLayers.has(name)) {
          if (!map.getSource(name)) await loadLayer(name)
        } else {
          if (map.getSource(name)) await removeLayer(map, name)
        }
      }
    })()
  }, [activeLayers, loadLayer])

  return (
    <>
      <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#030512' }} />
      <style>{`
        .cr-popup .maplibregl-popup-content {
          background: rgba(8,13,25,0.96);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 10px 13px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.6);
          backdrop-filter: blur(12px);
        }
        .cr-popup .maplibregl-popup-tip { border-top-color: rgba(8,13,25,0.96); }
        .maplibregl-ctrl-attrib { background: rgba(0,0,0,0.5) !important; color: rgba(255,255,255,0.3) !important; font-size: 9px !important; }
        .maplibregl-ctrl-group { background: rgba(13,17,23,0.9) !important; border: 1px solid rgba(255,255,255,0.1) !important; border-radius: 8px !important; overflow: hidden; }
        .maplibregl-ctrl-group button { background: transparent !important; color: #9ca3af !important; }
        .maplibregl-ctrl-group button:hover { background: rgba(255,255,255,0.08) !important; color: white !important; }
      `}</style>
    </>
  )
}
