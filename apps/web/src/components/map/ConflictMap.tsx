'use client'

import 'maplibre-gl/dist/maplibre-gl.css'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap, type MapLayerMouseEvent } from 'maplibre-gl'
import { EventDetailPanel } from '@/components/overview/EventDetailPanel'
import type { OverviewEvent } from '@/components/overview/types'
import { MapFilterPanel } from './MapFilterPanel'
import { MapLegend } from './MapLegend'
import { MapStatsBar } from './MapStatsBar'

// Waits for MapLibre style to be fully loaded — with timeout fallback so it never hangs
function waitForStyle(map: MapLibreMap, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve) => {
    if (map.isStyleLoaded()) { resolve(); return }
    let done = false
    const finish = () => { if (!done) { done = true; resolve() } }
    const t = window.setTimeout(finish, timeoutMs)
    map.once('style.load', () => { clearTimeout(t); finish() })
  })
}

function createSVGIcon(svgContent: string, bgColor: string | null, size = 32): string {
  const bg = bgColor ? `<circle cx="12" cy="12" r="11" fill="${bgColor}" opacity="0.9"/>` : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">${bg}${svgContent}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

async function loadMapIcons(map: maplibregl.Map): Promise<void> {
  const icons: Record<string, string> = {
    'icon-plane': createSVGIcon('<path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" fill="white"/>', '#60a5fa'),
    'icon-ship': createSVGIcon('<path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-1 2.5 1.3 5.5 1.3 8 0 1.26.65 2.62 1 4 1h2v-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.9-6.68c.08-.26.05-.54-.06-.78s-.29-.42-.52-.55L20 11V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v5l-1.37.86c-.23.13-.41.32-.52.55s-.15.52-.06.78z" fill="white"/>', '#34d399'),
    'icon-nuclear': createSVGIcon('<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" fill="white"/>', '#a78bfa'),
    'icon-seismic': createSVGIcon('<path d="M3.5 18.99l11 .01c.67 0 1.27-.33 1.63-.84L20.5 12l-4.37-6.16C15.77 5.33 15.17 5 14.5 5l-11 .01L7.34 12z" fill="white"/>', '#f59e0b'),
    'icon-fire': createSVGIcon('<path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z" fill="white"/>', '#ff4500'),
    'icon-wifi-off': createSVGIcon('<path d="M1 1l22 22-1.41 1.41-2.5-2.5A13.87 13.87 0 0 1 12 24C8.62 24 5.57 22.7 3.27 20.54L4.7 19.1A11.89 11.89 0 0 0 12 22c2.94 0 5.63-1.07 7.71-2.83L18.3 17.73A9.94 9.94 0 0 1 12 20a9.93 9.93 0 0 1-5.42-1.6L8 17c1.13.63 2.42 1 3.79 1 2.34 0 4.47-.83 6.12-2.2l-1.43-1.42A7.93 7.93 0 0 1 12 16a7.94 7.94 0 0 1-4.38-1.31L9 13.25A5.97 5.97 0 0 0 12 14a5.97 5.97 0 0 0 3.21-.93l-1.44-1.44A3.99 3.99 0 0 1 12 12a4 4 0 0 1-2.27-.71L7.83 9.39A5.99 5.99 0 0 0 6 14H4a7.97 7.97 0 0 1 2.09-5.33L4.7 7.28A9.94 9.94 0 0 0 2 14H0a11.9 11.9 0 0 1 3.07-7.93L1.41 4.41 2.83 3l18.38 18.38L20 22.83 1 1z" fill="white"/>', '#8b5cf6'),
  }
  for (const [name, dataUrl] of Object.entries(icons)) {
    try {
      const image = await map.loadImage(dataUrl)
      if (image && !map.hasImage(name)) map.addImage(name, image.data)
    } catch {
      // ignore icon load failures
    }
  }
}

const LIVE_LAYER_CONFIG = {
  seismic: { color: '#f59e0b', radius: 8 },
  flights: { color: '#60a5fa', radius: 5 },
  nuclear: { color: '#a78bfa', radius: 10 },
  outages: { color: '#8b5cf6', radius: 6 },
  vessels: { color: '#34d399', radius: 6 },
  fires: { color: '#ff4500', radius: 6 },
} as const

const ICON_MAP: Record<string, string> = {
  seismic: 'icon-seismic',
  flights: 'icon-plane',
  nuclear: 'icon-nuclear',
  outages: 'icon-wifi-off',
  vessels: 'icon-ship',
  fires: 'icon-fire',
}

const LAYER_LABELS: Record<string, string> = {
  flights: '✈️ MILITARY FLIGHT',
  vessels: '🚢 VESSEL',
  nuclear: '☢️ NUCLEAR FACILITY',
  seismic: '💥 SEISMIC EVENT',
  fires: '🔥 ACTIVE FIRE',
  outages: '🌐 INTERNET OUTAGE',
}

type LiveLayerName = keyof typeof LIVE_LAYER_CONFIG

type BaseFilterState = {
  hours: number
  minSeverity: number | null
  query: string
  activeLayers: Set<string>
}

type EventFeatureProperties = {
  id: string
  title: string
  occurred_at: string | null
  severity: number
  event_type: string | null
  region: string | null
  outlet_name: string | null
  source_id: string | null
  significance_score: number | null
  summary_short: string | null
  age_min: number | null
  layer?: string | null
  name?: string | null
}

type EventCollection = GeoJSON.FeatureCollection<GeoJSON.Point, EventFeatureProperties>

type LiveFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Point, GeoJSON.GeoJsonProperties>

type WindowValue = '24h' | '72h' | '7d' | '30d'
type SeverityValue = 'all' | 'critical' | 'high' | 'medium'

const DEFAULT_FILTER_STATE: BaseFilterState = {
  hours: 168,
  minSeverity: null,
  query: '',
  activeLayers: new Set(['events']),
}

function matchesFilters(properties: EventFeatureProperties, filters: BaseFilterState): boolean {
  if (filters.minSeverity !== null && properties.severity < filters.minSeverity) return false
  if (!filters.query.trim()) return true
  const haystack = `${properties.title} ${properties.region ?? ''} ${properties.event_type ?? ''}`.toLowerCase()
  return haystack.includes(filters.query.trim().toLowerCase())
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function hoursToWindow(hours: number): WindowValue {
  if (hours === 24) return '24h'
  if (hours === 72) return '72h'
  if (hours === 720) return '30d'
  return '7d'
}

function windowToHours(value: WindowValue): number {
  if (value === '24h') return 24
  if (value === '72h') return 72
  if (value === '30d') return 720
  return 168
}

function minSeverityToValue(value: number | null): SeverityValue {
  if (value === 4) return 'critical'
  if (value === 3) return 'high'
  if (value === 2) return 'medium'
  return 'all'
}

function valueToMinSeverity(value: SeverityValue): number | null {
  if (value === 'critical') return 4
  if (value === 'high') return 3
  if (value === 'medium') return 2
  return null
}

export function ConflictMap() {
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const rotationRef = useRef<number | null>(null)
  const [rawData, setRawData] = useState<EventCollection | null>(null)
  const [filterState, setFilterState] = useState<BaseFilterState>(DEFAULT_FILTER_STATE)
  const [loading, setLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<OverviewEvent | null>(null)
  const [hasOrg, setHasOrg] = useState(false)

  const filteredData = useMemo<EventCollection>(() => {
    const features = (rawData?.features ?? []).filter((feature) => matchesFilters(feature.properties, filterState))
    return { type: 'FeatureCollection', features }
  }, [rawData, filterState])

  const stats = useMemo(() => {
    return filteredData.features.reduce(
      (acc, feature) => {
        const severity = feature.properties.severity
        acc.total += 1
        if (severity >= 4) acc.critical += 1
        else if (severity >= 3) acc.high += 1
        else if (severity >= 2) acc.medium += 1
        else acc.low += 1
        return acc
      },
      { total: 0, critical: 0, high: 0, medium: 0, low: 0 }
    )
  }, [filteredData])

  const stopRotation = useCallback(() => {
    if (rotationRef.current !== null) {
      window.clearInterval(rotationRef.current)
      rotationRef.current = null
    }
  }, [])

  const startRotation = useCallback(() => {
    stopRotation()
    const map = mapRef.current
    if (!map) return
    rotationRef.current = window.setInterval(() => {
      if (!mapRef.current) return
      if (mapRef.current.isMoving()) return
      const center = mapRef.current.getCenter()
      mapRef.current.easeTo({ center: [center.lng + 8, center.lat], duration: 6000, easing: (t) => t, essential: true })
    }, 7000)
  }, [stopRotation])

  const handleClose = useCallback(() => setSelectedEvent(null), [])

  const handleFeatureClick = useCallback(async (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0]
    const featureLayer = feature?.properties?.layer
    const eventId = feature?.properties?.id
    if (featureLayer && featureLayer !== 'events') return
    if (!eventId || typeof eventId !== 'string') return

    try {
      const response = await fetch(`/api/v1/events/${eventId}`, { cache: 'no-store' })
      if (!response.ok) return
      const data = await response.json() as { event: OverviewEvent | null }
      if (data.event) setSelectedEvent(data.event)
    } catch {
      // ignore transient click-fetch failures
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadData() {
      try {
        setLoading(true)
        const [eventsResponse, meResponse] = await Promise.all([
          fetch(`/api/v1/map/events?hours=${filterState.hours}`, { cache: 'no-store' }),
          fetch('/api/v1/me', { cache: 'no-store' }).catch(() => null),
        ])

        if (!active) return

        if (eventsResponse.ok) {
          const data = await eventsResponse.json() as EventCollection
          if (active) setRawData(data)
        }

        if (meResponse?.ok) {
          const me = await meResponse.json() as { data?: { org_id?: string | null } }
          if (active) setHasOrg(Boolean(me.data?.org_id))
        } else if (active) {
          setHasOrg(false)
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadData()
    const intervalId = window.setInterval(() => void loadData(), 120000)
    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [filterState.hours])

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [20, 20],
      zoom: 1.8,
      minZoom: 1,
      maxZoom: 12,
      attributionControl: false,
    })

    mapRef.current = map

    map.on('load', () => { void (async () => {
      const mapAny = map as MapLibreMap & {
        setProjection: (p: { type: string }) => void
        setFog: (f: Record<string, unknown>) => void
      }
      try { mapAny.setProjection({ type: 'globe' }) } catch {}
      try {
        mapAny.setFog({
          color: 'rgb(15, 30, 60)',
          'high-color': 'rgb(20, 60, 120)',
          'horizon-blend': 0.03,
          'space-color': 'rgb(4, 8, 20)',
          'star-intensity': 0.8,
        })
      } catch {}

      // setProjection triggers a style reload in MapLibre v5 — must wait before addSource/addLayer
      await waitForStyle(map)
      await loadMapIcons(map)

      map.addSource('events', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })

      map.addLayer({
        id: 'event-pulse',
        type: 'circle',
        source: 'events',
        filter: ['in', ['get', 'severity'], ['literal', [4, 3]]],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, ['match', ['get', 'severity'], 4, 12, 3, 10, 8], 6, ['match', ['get', 'severity'], 4, 20, 3, 16, 12]],
          'circle-color': 'rgba(255,255,255,0)',
          'circle-stroke-color': ['match', ['get', 'severity'], 4, 'rgba(239,68,68,0.35)', 3, 'rgba(249,115,22,0.30)', 'rgba(255,255,255,0)'],
          'circle-stroke-width': ['match', ['get', 'severity'], 4, 2, 3, 1.5, 0],
          'circle-stroke-opacity': 0.4,
          'circle-opacity': 0.9,
        },
      })

      map.addLayer({
        id: 'event-points',
        type: 'circle',
        source: 'events',
        layout: { visibility: 'visible' },
        paint: {
          'circle-color': ['match', ['get', 'severity'], 4, '#ef4444', 3, '#f97316', 2, '#eab308', '#6b7280'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'],
            1, ['match', ['get', 'severity'], 4, 4, 3, 3.5, 2, 3, 2.5],
            6, ['match', ['get', 'severity'], 4, 7, 3, 6, 2, 5, 4],
          ],
          'circle-stroke-width': ['match', ['get', 'severity'], 4, 2, 3, 1.5, 2, 1, 0.8],
          'circle-stroke-color': 'rgba(255,255,255,0.88)',
          'circle-opacity': ['interpolate', ['linear'], ['coalesce', ['get', 'age_min'], 10080], 0, 0.95, 180, 0.9, 1440, 0.78, 10080, 0.62],
        },
      })

      ;(Object.entries(LIVE_LAYER_CONFIG) as [LiveLayerName, (typeof LIVE_LAYER_CONFIG)[LiveLayerName]][]).forEach(([name]) => {
        map.addSource(name, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({
          id: `${name}-layer`,
          type: 'symbol',
          source: name,
          layout: {
            'icon-image': ICON_MAP[name] ?? 'icon-seismic',
            'icon-size': name === 'nuclear' ? 0.9 : name === 'fires' ? 0.55 : 0.7,
            'icon-allow-overlap': true,
            'icon-anchor': 'center',
            visibility: 'none',
          },
          paint: { 'icon-opacity': 0.9 },
        })
      })

      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: '300px', className: 'cr-tooltip' })

      const handleMouseEnter = (e: MapLayerMouseEvent) => {
        map.getCanvas().style.cursor = 'pointer'
        const feature = e.features?.[0]
        if (!feature) return
        const props = feature.properties as Record<string, unknown>
        const coords = ((feature.geometry as unknown) as { coordinates: [number, number] }).coordinates.slice() as [number, number]
        const layer = typeof props.layer === 'string' ? props.layer : 'events'
        const title = typeof props.title === 'string' ? props.title : typeof props.name === 'string' ? props.name : typeof props.callsign === 'string' ? props.callsign : `${layer} layer item`
        const region = typeof props.region === 'string' ? props.region : typeof props.zone === 'string' ? props.zone : typeof props.country === 'string' ? props.country : ''
        const source = typeof props.outlet_name === 'string' ? props.outlet_name : typeof props.type === 'string' ? props.type : ''
        const meta = [region, source].filter(Boolean).join(' · ')
        const borderColor = typeof props.color === 'string'
          ? props.color
          : layer === 'events'
            ? (typeof props.severity === 'number' && props.severity >= 4 ? '#ef4444' : typeof props.severity === 'number' && props.severity >= 3 ? '#f97316' : typeof props.severity === 'number' && props.severity >= 2 ? '#eab308' : '#6b7280')
            : LIVE_LAYER_CONFIG[layer as LiveLayerName]?.color ?? '#60a5fa'
        const layerLabel = layer === 'events'
          ? (typeof props.severity === 'number' && props.severity >= 4 ? '🔴 CRITICAL EVENT' : typeof props.severity === 'number' && props.severity >= 3 ? '🟠 HIGH PRIORITY EVENT' : typeof props.severity === 'number' && props.severity >= 2 ? '🟡 MEDIUM PRIORITY EVENT' : '⚪ LOW PRIORITY EVENT')
          : (LAYER_LABELS[layer] ?? escapeHtml(layer.toUpperCase()))

        popup.setLngLat(coords).setHTML(`
          <div style="border-left:3px solid ${borderColor};padding-left:2px;max-width:280px;">
            <div style="color:${borderColor};font-size:10px;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;font-weight:700;">${escapeHtml(layerLabel)}</div>
            ${meta ? `<div style="color:#9ca3af;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">${escapeHtml(meta)}</div>` : ''}
            <div style="color:#f9fafb;font-size:13px;font-weight:600;line-height:1.4;">${escapeHtml(title)}</div>
            <div style="color:#6b7280;font-size:11px;margin-top:4px;">${layer === 'events' ? 'Click to open brief' : 'Live layer feed'}</div>
          </div>
        `).addTo(map)
      }

      const handleMouseLeave = () => {
        map.getCanvas().style.cursor = ''
        popup.remove()
      }

      const interactiveLayers = ['event-points', ...(Object.keys(LIVE_LAYER_CONFIG).map((name) => `${name}-layer`))]
      interactiveLayers.forEach((layerId) => {
        map.on('mouseenter', layerId, handleMouseEnter)
        map.on('mouseleave', layerId, handleMouseLeave)
      })
      map.on('click', 'event-points', (event) => {
        void handleFeatureClick(event)
      })
      map.on('dragstart', stopRotation)
      map.on('zoomstart', stopRotation)
      map.on('pitchstart', stopRotation)

      setMapReady(true)
      startRotation()
    })() })

    return () => {
      stopRotation()
      setMapReady(false)
      map.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Map is created once on mount — activeLayers/visibility handled by separate useEffects

  useEffect(() => {
    if (!mapReady) return
    const source = mapRef.current?.getSource('events') as GeoJSONSource | undefined
    if (source) source.setData(filteredData)
  }, [filteredData, mapReady])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    map.setLayoutProperty('event-points', 'visibility', filterState.activeLayers.has('events') ? 'visible' : 'none')
    map.setLayoutProperty('event-pulse', 'visibility', filterState.activeLayers.has('events') ? 'visible' : 'none')

    ;(Object.keys(LIVE_LAYER_CONFIG) as LiveLayerName[]).forEach((layer) => {
      map.setLayoutProperty(`${layer}-layer`, 'visibility', filterState.activeLayers.has(layer) ? 'visible' : 'none')
    })
  }, [filterState.activeLayers, mapReady])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const controllers: AbortController[] = []

    ;(Object.keys(LIVE_LAYER_CONFIG) as LiveLayerName[]).forEach((layer) => {
      const source = map.getSource(layer) as GeoJSONSource | undefined
      if (!source) return
      if (!filterState.activeLayers.has(layer)) {
        source.setData({ type: 'FeatureCollection', features: [] })
        return
      }

      const controller = new AbortController()
      controllers.push(controller)
      void fetch(`/api/v1/live/${layer}`, { cache: 'no-store', signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error(`${layer} failed with ${response.status}`)
          return await response.json() as LiveFeatureCollection
        })
        .then((geojson) => {
          if (!map.isStyleLoaded()) return
          const currentSource = map.getSource(layer) as GeoJSONSource | undefined
          currentSource?.setData(geojson)
        })
        .catch(() => {
          if (controller.signal.aborted) return
          if (!map.isStyleLoaded()) return
          const currentSource = map.getSource(layer) as GeoJSONSource | undefined
          currentSource?.setData({ type: 'FeatureCollection', features: [] })
        })
    })

    return () => {
      controllers.forEach((controller) => controller.abort())
    }
  }, [filterState.activeLayers, mapReady])

  const windowValue = hoursToWindow(filterState.hours)
  const severityValue = minSeverityToValue(filterState.minSeverity)

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: 'linear-gradient(180deg, #040810 0%, #09101c 100%)' }}>
      <div ref={mapContainer} className="absolute inset-0" />

      {!mapReady && (
        <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: 'rgba(4,8,16,0.88)' }}>
          <div className="w-56 overflow-hidden rounded-full border border-white/10 bg-white/5">
            <div className="h-1 bg-blue-500" style={{ animation: 'cr-loading 1.6s linear infinite' }} />
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 p-4">
        <div className="space-y-3">
          <button
            onClick={() => setShowFilters((current) => !current)}
            className="pointer-events-auto rounded-2xl border border-white/10 bg-[#0d1117]/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-100 backdrop-blur-sm"
          >
            {showFilters ? 'Hide filters' : 'Show filters'}
          </button>
          {showFilters && (
            <MapFilterPanel
              window={windowValue}
              severity={severityValue}
              activeLayers={filterState.activeLayers}
              onWindowChange={(value) => setFilterState((current) => ({ ...current, hours: windowToHours(value) }))}
              onSeverityChange={(value) => setFilterState((current) => ({ ...current, minSeverity: valueToMinSeverity(value) }))}
              onLayerToggle={(layer) => {
                setFilterState((current) => {
                  const nextLayers = new Set(current.activeLayers)
                  if (nextLayers.has(layer)) nextLayers.delete(layer)
                  else nextLayers.add(layer)
                  return { ...current, activeLayers: nextLayers }
                })
              }}
              onReset={() => setFilterState(DEFAULT_FILTER_STATE)}
            />
          )}
        </div>

        <MapStatsBar {...stats} />
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 z-10">
        <MapLegend activeLayers={filterState.activeLayers} />
      </div>

      {!loading && filteredData.features.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="rounded-3xl border border-white/10 bg-[#0d1117]/80 px-6 py-4 text-center backdrop-blur-sm">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">No mapped events</div>
            <div className="mt-1 text-sm text-slate-300">Adjust the filters or widen the time window.</div>
          </div>
        </div>
      )}

      {selectedEvent && (
        <EventDetailPanel
          event={selectedEvent}
          onClose={handleClose}
          onSelect={setSelectedEvent}
          hasOrg={hasOrg}
        />
      )}
    </div>
  )
}
