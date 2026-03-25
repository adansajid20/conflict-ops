'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// MapLibre loaded dynamically — never SSR
let maplibregl: typeof import('maplibre-gl') | null = null

const SEVERITY_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#FF0000']

type RawEvent = {
  id: string
  title: string
  event_type: string
  severity: number | null
  status: string
  country_code: string | null
  region: string | null
  occurred_at: string
  source: string
  location: unknown // PostGIS returns various formats
}

function parseLocation(location: unknown): [number, number] | null {
  if (!location) return null
  // PostGIS via Supabase REST → GeoJSON object
  if (typeof location === 'object' && location !== null) {
    const geo = location as Record<string, unknown>
    if (Array.isArray(geo.coordinates) && geo.coordinates.length >= 2) {
      const [lng, lat] = geo.coordinates as [number, number]
      if (isFinite(lng) && isFinite(lat)) return [lng, lat]
    }
  }
  // WKB hex string fallback (rare)
  if (typeof location === 'string' && location.startsWith('0101')) {
    // Can't parse WKB in browser without a library — skip
    return null
  }
  return null
}

function buildGeoJSON(events: RawEvent[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  for (const event of events) {
    const coords = parseLocation(event.location)
    if (!coords) continue
    const severity = event.severity ?? 1
    const color = SEVERITY_COLORS[(severity - 1)] ?? SEVERITY_COLORS[0]
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: coords },
      properties: {
        id: event.id,
        title: event.title,
        severity,
        color,
        event_type: event.event_type,
        country_code: event.country_code ?? '',
        region: event.region ?? '',
        source: event.source,
        occurred_at: event.occurred_at,
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

interface ConflictMapProps {
  className?: string
}

export function ConflictMap({ className = '' }: ConflictMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('maplibre-gl').Map | null>(null)
  const isInitialized = useRef(false)
  const [events, setEvents] = useState<RawEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [count, setCount] = useState(0)
  const [popup, setPopup] = useState<{ title: string; source: string; severity: number; region: string } | null>(null)

  // Fetch events from geo API (returns proper GeoJSON coordinates)
  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/events/geo', { cache: 'no-store' })
      if (!res.ok) return
      const d = await res.json() as { success: boolean; data?: RawEvent[] }
      const evts = d.data ?? []
      setEvents(evts)
      const withCoords = evts.filter(e => parseLocation(e.location) !== null)
      setCount(withCoords.length)
    } catch {
      // Network error — keep existing events
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchEvents()
    const id = setInterval(() => void fetchEvents(), 60_000)
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
          sources: {
            'osm-tiles': {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors',
            },
          },
          layers: [
            {
              id: 'osm-tiles',
              type: 'raster',
              source: 'osm-tiles',
              paint: {
                'raster-saturation': -0.85,
                'raster-brightness-min': 0.08,
                'raster-brightness-max': 0.35,
              },
            },
          ],
        },
        center: [20, 15],
        zoom: 2,
        attributionControl: false,
      })

      mapRef.current = map

      map.on('load', () => {
        map.addSource('events', {
          type: 'geojson',
          data: buildGeoJSON([]),
          cluster: true,
          clusterMaxZoom: 8,
          clusterRadius: 50,
        })

        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'events',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#00FF88',
            'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 30],
            'circle-opacity': 0.75,
          },
        })

        map.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'events',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['Open Sans Bold'],
            'text-size': 11,
          },
          paint: { 'text-color': '#080A0E' },
        })

        map.addLayer({
          id: 'unclustered-point',
          type: 'circle',
          source: 'events',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': ['get', 'color'],
            'circle-radius': 6,
            'circle-stroke-width': 1,
            'circle-stroke-color': 'rgba(0,0,0,0.5)',
            'circle-opacity': 0.9,
          },
        })

        map.on('mouseenter', 'unclustered-point', () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', 'unclustered-point', () => { map.getCanvas().style.cursor = '' })

        map.on('click', 'unclustered-point', (e) => {
          const f = e.features?.[0]
          if (!f?.properties) return
          setPopup({
            title: String(f.properties.title ?? ''),
            source: String(f.properties.source ?? ''),
            severity: Number(f.properties.severity ?? 1),
            region: String(f.properties.region ?? f.properties.country_code ?? ''),
          })
        })

        map.on('click', (e) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ['unclustered-point'] })
          if (!features.length) setPopup(null)
        })
      })
    }

    void initMap()
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        isInitialized.current = false
      }
    }
  }, [])

  // Update map data when events change
  useEffect(() => {
    if (!mapRef.current) return
    const waitForSource = () => {
      const source = mapRef.current?.getSource('events') as import('maplibre-gl').GeoJSONSource | undefined
      if (source) {
        source.setData(buildGeoJSON(events))
      } else {
        // Map not fully loaded yet — wait
        setTimeout(waitForSource, 300)
      }
    }
    waitForSource()
  }, [events])

  return (
    <div className="relative w-full h-full" style={{ backgroundColor: 'var(--bg-base)' }}>
      <div ref={mapContainer} className={`w-full h-full ${className}`} />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(8,10,14,0.7)', pointerEvents: 'none' }}>
          <div className="text-xs mono" style={{ color: 'var(--text-muted)' }}>LOADING MAP DATA...</div>
        </div>
      )}

      {/* Event count badge */}
      {!loading && (
        <div className="absolute top-3 right-3 text-xs mono px-2 py-1 rounded"
          style={{ backgroundColor: 'rgba(8,10,14,0.8)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          {count} EVENTS PLOTTED
        </div>
      )}

      {/* Popup */}
      {popup && (
        <div className="absolute bottom-6 left-4 max-w-xs rounded p-3 shadow-lg"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <button className="absolute top-2 right-2 text-xs" style={{ color: 'var(--text-muted)' }}
            onClick={() => setPopup(null)}>✕</button>
          <div className="text-xs mono font-bold mb-1" style={{ color: 'var(--primary)', fontSize: 10 }}>
            SEV {popup.severity} · {popup.source.toUpperCase()}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-primary)', lineHeight: 1.4 }}>
            {popup.title}
          </div>
          {popup.region && (
            <div className="text-xs mt-1 mono" style={{ color: 'var(--text-muted)' }}>{popup.region}</div>
          )}
        </div>
      )}
    </div>
  )
}
