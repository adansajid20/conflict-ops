'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

type Vessel = { mmsi?: number; ship_name?: string | null; ship_type?: number; latitude: number; longitude: number; speed?: number; flag?: string | null; last_seen?: string | null }
type Flight = { icao24?: string; callsign?: string | null; latitude: number; longitude: number; altitude?: number; is_military?: boolean; last_seen?: string | null }
type Thermal = { region: string; frp: number; lat: number; lon: number; detected_at: string }
type IntelEvent = {
  id: string; source: string; title: string; severity?: number | null
  region?: string | null; occurred_at?: string | null; location?: string | null
}

const SEVERITY_COLORS: Record<number, string> = {
  1: '#3b82f6',
  2: '#f59e0b',
  3: '#f97316',
  4: '#ef4444',
}

function parseCoords(location: unknown): { lat: number; lng: number } | null {
  if (!location) return null
  if (typeof location === 'string') {
    const wkt = location.includes(';') ? (location.split(';')[1] ?? '') : location
    const m = wkt.match(/POINT\(([-.0-9]+)\s+([-.0-9]+)\)/)
    if (!m) return null
    const lng = parseFloat(m[1] ?? '')
    const lat = parseFloat(m[2] ?? '')
    return isNaN(lng) || isNaN(lat) ? null : { lng, lat }
  }
  if (typeof location === 'object' && location !== null) {
    const loc = location as { type?: string; coordinates?: number[] }
    if (loc.type === 'Point' && Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
      const lng = loc.coordinates[0] ?? NaN
      const lat = loc.coordinates[1] ?? NaN
      return isNaN(lng) || isNaN(lat) ? null : { lng, lat }
    }
  }
  return null
}

interface TrackingMapProps {
  vessels: Vessel[]
  flights: Flight[]
  thermals: Thermal[]
  intelEvents?: IntelEvent[]
  layerToggles: { vessels: boolean; flights: boolean; thermal: boolean; intel?: boolean }
  onIntelClick?: (event: IntelEvent) => void
}

export default function TrackingMap({ vessels, flights, thermals, intelEvents = [], layerToggles, onIntelClick }: TrackingMapProps) {
  const mapRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const onIntelClickRef = useRef(onIntelClick)
  const intelEventsRef = useRef(intelEvents)
  const searchParams = useSearchParams()

  onIntelClickRef.current = onIntelClick
  intelEventsRef.current = intelEvents

  useEffect(() => {
    let mounted = true
    void import('maplibre-gl').then(mod => {
      if (!mounted || !containerRef.current || mapRef.current) return
      const maplibre = mod.default

      // Read initial URL params
      const urlLat = searchParams?.get('lat')
      const urlLng = searchParams?.get('lng')
      const initialCenter: [number, number] = urlLat && urlLng
        ? [parseFloat(urlLng), parseFloat(urlLat)]
        : [30, 20]
      const initialZoom = urlLat ? 6 : 2

      const map = new maplibre.Map({
        container: containerRef.current,
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: initialCenter,
        zoom: initialZoom,
      })
      map.addControl(new maplibre.NavigationControl(), 'top-right')

      map.on('load', () => {
        // Vessel layer
        map.addSource('vessels', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({ id: 'vessels', type: 'circle', source: 'vessels', paint: { 'circle-radius': 5, 'circle-color': ['case', ['==', ['get', 'ship_type'], 35], '#EF4444', '#3B82F6'], 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } })

        // Flight layer
        map.addSource('flights', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({ id: 'flights', type: 'symbol', source: 'flights', layout: { 'text-field': '▲', 'text-size': 14 }, paint: { 'text-color': '#FBBF24' } })

        // Thermal layer
        map.addSource('thermals', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({ id: 'thermals', type: 'circle', source: 'thermals', paint: { 'circle-radius': 7, 'circle-color': '#F97316', 'circle-opacity': 0.75 } })

        // Intel events layer
        map.addSource('intel', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({
          id: 'intel',
          type: 'circle',
          source: 'intel',
          paint: {
            'circle-radius': 6,
            'circle-color': ['match', ['get', 'severity'], 1, '#3b82f6', 2, '#f59e0b', 3, '#f97316', 4, '#ef4444', '#3b82f6'] as any,
            'circle-opacity': 0.85,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#fff',
            'circle-stroke-opacity': 0.6,
          },
        })

        // Intel label layer
        map.addLayer({
          id: 'intel-labels',
          type: 'symbol',
          source: 'intel',
          layout: {
            'text-field': ['step', ['zoom'], '', 5, ['get', 'label']],
            'text-size': 10,
            'text-offset': [0, 1.2],
            'text-anchor': 'top',
            'text-max-width': 10,
          },
          paint: {
            'text-color': '#e2e8f0',
            'text-halo-color': '#070B11',
            'text-halo-width': 1,
          },
        })

        const popup = new maplibre.Popup({ closeButton: false, closeOnClick: true })

        // Tooltips for vessel/flight/thermal
        for (const layer of ['vessels', 'flights', 'thermals']) {
          map.on('click', layer, (e: any) => {
            const feature = e.features?.[0]
            if (!feature) return
            const props = feature.properties ?? {}
            popup.setLngLat(e.lngLat)
              .setHTML(`<div style="font:12px Inter,sans-serif;color:#0f172a;max-width:200px"><strong>${props.label || 'Track'}</strong><div>${props.meta || ''}</div></div>`)
              .addTo(map)
          })
          map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer' })
          map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '' })
        }

        // Click handler for intel events
        map.on('click', 'intel', (e: any) => {
          const feature = e.features?.[0]
          if (!feature) return
          const eventId = feature.properties?.id
          const event = intelEventsRef.current.find(ev => ev.id === eventId)
          if (event && onIntelClickRef.current) {
            onIntelClickRef.current(event)
          }
        })
        map.on('mouseenter', 'intel', () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', 'intel', () => { map.getCanvas().style.cursor = '' })

        // If URL has eventId, open drawer after map loads
        const urlEventId = searchParams?.get('eventId')
        if (urlEventId) {
          setTimeout(() => {
            const event = intelEventsRef.current.find(ev => ev.id === urlEventId)
            if (event && onIntelClickRef.current) {
              onIntelClickRef.current(event)
            }
          }, 500)
        }
      })
      mapRef.current = map
    })
    return () => { mounted = false; mapRef.current?.remove(); mapRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update data layers when props change
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    const vesselSource = map.getSource('vessels') as any
    const flightSource = map.getSource('flights') as any
    const thermalSource = map.getSource('thermals') as any
    const intelSource = map.getSource('intel') as any

    vesselSource?.setData({
      type: 'FeatureCollection',
      features: vessels.map(v => ({
        type: 'Feature',
        properties: { ship_type: v.ship_type, label: v.ship_name || `MMSI ${v.mmsi}`, meta: `${v.flag || '--'} · ${v.speed || 0}kn` },
        geometry: { type: 'Point', coordinates: [v.longitude, v.latitude] },
      })),
    })

    flightSource?.setData({
      type: 'FeatureCollection',
      features: flights.map(f => ({
        type: 'Feature',
        properties: { label: f.callsign || f.icao24, meta: `${f.altitude || 0}m` },
        geometry: { type: 'Point', coordinates: [f.longitude, f.latitude] },
      })),
    })

    thermalSource?.setData({
      type: 'FeatureCollection',
      features: thermals.map(t => ({
        type: 'Feature',
        properties: { label: t.region, meta: `FRP ${t.frp}` },
        geometry: { type: 'Point', coordinates: [t.lon, t.lat] },
      })),
    })

    // Build intel GeoJSON
    const intelFeatures = intelEvents
      .map(e => {
        const coords = parseCoords(e.location)
        if (!coords) return null
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [coords.lng, coords.lat] },
          properties: {
            id: e.id,
            title: e.title,
            severity: e.severity ?? 1,
            source: e.source,
            region: e.region,
            occurred_at: e.occurred_at,
            label: e.title.slice(0, 30),
          },
        }
      })
      .filter((f): f is NonNullable<typeof f> => f !== null)

    intelSource?.setData({ type: 'FeatureCollection', features: intelFeatures })

    // Layer visibility
    if (map.getLayer('vessels')) map.setLayoutProperty('vessels', 'visibility', layerToggles.vessels ? 'visible' : 'none')
    if (map.getLayer('flights')) map.setLayoutProperty('flights', 'visibility', layerToggles.flights ? 'visible' : 'none')
    if (map.getLayer('thermals')) map.setLayoutProperty('thermals', 'visibility', layerToggles.thermal ? 'visible' : 'none')
    if (map.getLayer('intel')) map.setLayoutProperty('intel', 'visibility', (layerToggles.intel ?? true) ? 'visible' : 'none')
    if (map.getLayer('intel-labels')) map.setLayoutProperty('intel-labels', 'visibility', (layerToggles.intel ?? true) ? 'visible' : 'none')
  }, [flights, intelEvents, layerToggles, thermals, vessels])

  return <div ref={containerRef} className="h-full min-h-[520px] w-full" />
}
