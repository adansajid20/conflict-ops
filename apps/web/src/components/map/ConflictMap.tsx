'use client'

import 'maplibre-gl/dist/maplibre-gl.css'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap, type MapLayerMouseEvent } from 'maplibre-gl'
import { EventDetailPanel } from '@/components/overview/EventDetailPanel'
import type { OverviewEvent } from '@/components/overview/types'
import { MapFilterPanel } from './MapFilterPanel'
import { MapLegend } from './MapLegend'
import { MapStatsBar } from './MapStatsBar'

export type MapFilters = {
  hours: number
  minSeverity: number | null
  query: string
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
}

type EventCollection = GeoJSON.FeatureCollection<GeoJSON.Point, EventFeatureProperties>

const DEFAULT_FILTERS: MapFilters = { hours: 168, minSeverity: null, query: '' }

function matchesFilters(properties: EventFeatureProperties, filters: MapFilters): boolean {
  if (filters.minSeverity !== null && properties.severity < filters.minSeverity) return false
  if (!filters.query.trim()) return true
  const haystack = `${properties.title} ${properties.region ?? ''} ${properties.event_type ?? ''}`.toLowerCase()
  return haystack.includes(filters.query.trim().toLowerCase())
}

export function ConflictMap() {
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const rotationRef = useRef<number | null>(null)

  const [rawData, setRawData] = useState<EventCollection | null>(null)
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_FILTERS)
  const [loading, setLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<OverviewEvent | null>(null)
  const [hasOrg, setHasOrg] = useState(false)

  const filteredData = useMemo<EventCollection>(() => {
    const features = (rawData?.features ?? []).filter((feature) => matchesFilters(feature.properties, filters))
    return { type: 'FeatureCollection', features }
  }, [rawData, filters])

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
    const eventId = feature?.properties?.id
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
          fetch(`/api/v1/map/events?hours=${filters.hours}`, { cache: 'no-store' }),
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
  }, [filters.hours])

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

    map.on('load', () => {
      ;(map as MapLibreMap & {
        setProjection?: (value: unknown) => void
        setFog?: (value: unknown) => void
      }).setProjection?.({ type: 'globe' })
      try {
        ;(map as MapLibreMap & { setFog?: (value: unknown) => void }).setFog?.({
          color: 'rgb(4, 8, 16)',
          'high-color': 'rgb(10, 18, 40)',
          'horizon-blend': 0.04,
          'space-color': 'rgb(4, 8, 16)',
          'star-intensity': 0.6,
        })
      } catch {
        // fine
      }

      map.addSource('events', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      map.addLayer({
        id: 'event-pulse',
        type: 'circle',
        source: 'events',
        filter: ['in', ['get', 'severity'], ['literal', [4, 3]]],
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            1, ['match', ['get', 'severity'], 4, 18, 3, 14, 10],
            6, ['match', ['get', 'severity'], 4, 28, 3, 22, 16],
          ],
          'circle-color': 'rgba(255,255,255,0)',
          'circle-stroke-color': [
            'match', ['get', 'severity'],
            4, 'rgba(239,68,68,0.35)',
            3, 'rgba(249,115,22,0.30)',
            'rgba(255,255,255,0)',
          ],
          'circle-stroke-width': [
            'match', ['get', 'severity'],
            4, 3,
            3, 2,
            0,
          ],
          'circle-opacity': 0.9,
        },
      })

      map.addLayer({
        id: 'event-points',
        type: 'circle',
        source: 'events',
        paint: {
          'circle-color': [
            'match', ['get', 'severity'],
            4, '#ef4444',
            3, '#f97316',
            2, '#eab308',
            '#6b7280',
          ],
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            1, ['match', ['get', 'severity'], 4, 5.5, 3, 5, 2, 4.5, 4],
            6, ['match', ['get', 'severity'], 4, 10, 3, 8.5, 2, 7, 5.5],
          ],
          'circle-stroke-width': [
            'match', ['get', 'severity'],
            4, 2.5,
            3, 2,
            2, 1.5,
            1,
          ],
          'circle-stroke-color': 'rgba(255,255,255,0.88)',
          'circle-opacity': [
            'interpolate', ['linear'], ['coalesce', ['get', 'age_min'], 10080],
            0, 0.95,
            180, 0.9,
            1440, 0.78,
            10080, 0.62,
          ],
        },
      })

      map.on('mouseenter', 'event-points', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'event-points', () => {
        map.getCanvas().style.cursor = ''
      })
      map.on('click', 'event-points', (event) => {
        void handleFeatureClick(event)
      })
      map.on('dragstart', stopRotation)
      map.on('zoomstart', stopRotation)
      map.on('pitchstart', stopRotation)

      setMapReady(true)
      startRotation()
    })

    return () => {
      stopRotation()
      map.remove()
      mapRef.current = null
    }
  }, [handleFeatureClick, startRotation, stopRotation])

  useEffect(() => {
    const source = mapRef.current?.getSource('events') as GeoJSONSource | undefined
    if (source) source.setData(filteredData)
  }, [filteredData])

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: 'linear-gradient(180deg, #040810 0%, #09101c 100%)' }}>
      <div ref={mapContainer} className="absolute inset-0" />

      {!mapReady && (
        <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: 'rgba(4,8,16,0.88)' }}>
          <div className="text-xs tracking-[0.3em]" style={{ color: 'var(--text-muted)' }}>
            {loading ? 'LOADING GLOBE' : 'INITIALIZING GLOBE'}
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4">
        <div className="space-y-3">
          <button
            onClick={() => setShowFilters((current) => !current)}
            className="pointer-events-auto rounded-2xl border px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em]"
            style={{ background: 'rgba(5,10,18,0.8)', borderColor: 'rgba(148,163,184,0.18)', color: 'var(--text-primary)' }}
          >
            Filters
          </button>
          {showFilters && (
            <MapFilterPanel filters={filters} onChange={setFilters} onClose={() => setShowFilters(false)} />
          )}
        </div>

        <MapStatsBar {...stats} />
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 z-10">
        <MapLegend />
      </div>

      {!loading && filteredData.features.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="rounded-3xl border px-6 py-4 text-center" style={{ background: 'rgba(5,10,18,0.8)', borderColor: 'rgba(148,163,184,0.18)' }}>
            <div className="text-xs uppercase tracking-[0.24em]" style={{ color: 'var(--text-muted)' }}>No mapped events</div>
            <div className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Adjust the filters or widen the time window.</div>
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
