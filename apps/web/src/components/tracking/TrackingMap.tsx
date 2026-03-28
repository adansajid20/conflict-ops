'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

type Vessel = { mmsi?: number; ship_name?: string | null; ship_type?: number; latitude: number; longitude: number; speed?: number; flag?: string | null; last_seen?: string | null }
type Flight = { icao24?: string; callsign?: string | null; latitude: number; longitude: number; altitude?: number; is_military?: boolean; last_seen?: string | null }
type Thermal = { region: string; frp: number; lat: number; lon: number; detected_at: string }
type IntelEvent = {
  id: string; source: string; title: string; severity?: number | null
  region?: string | null; occurred_at?: string | null; location?: string | null
  country_code?: string | null; description?: string | null
}

// Default map view: Middle East + Africa + Eastern Europe visible
const DEFAULT_CENTER: [number, number] = [30, 20]
const DEFAULT_ZOOM = 3

// Country centroids for approximating events with only country_code
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  'US': [37.09, -95.71], 'RU': [61.52, 105.32], 'CN': [35.86, 104.19],
  'UA': [48.37, 31.16], 'SY': [34.80, 38.99], 'IQ': [33.22, 43.68],
  'AF': [33.93, 67.71], 'YE': [15.55, 48.52], 'SD': [12.86, 30.22],
  'SS': [6.88, 31.31], 'ML': [17.57, -3.99], 'NE': [17.61, 8.08],
  'CF': [6.61, 20.94], 'CD': [-4.04, 21.76], 'SO': [5.15, 46.20],
  'ET': [9.14, 40.49], 'NG': [9.08, 8.68], 'LY': [26.34, 17.23],
  'MM': [21.91, 95.96], 'PK': [30.37, 69.35], 'IN': [20.59, 78.96],
  'IR': [32.43, 53.69], 'IL': [31.05, 34.85], 'PS': [31.95, 35.23],
  'LB': [33.85, 35.86], 'TR': [38.96, 35.24], 'MX': [23.63, -102.55],
  'VE': [6.42, -66.59], 'CO': [4.57, -74.29], 'HT': [18.97, -72.29],
  'BR': [-14.24, -51.93], 'AR': [-38.42, -63.62], 'PE': [-9.19, -75.02],
  'KE': [-0.02, 37.91], 'TZ': [-6.37, 34.89], 'UG': [1.37, 32.29],
  'ZW': [-19.02, 29.15], 'ZA': [-30.56, 22.94], 'MZ': [-18.67, 35.53],
  'AO': [-11.20, 17.87], 'BF': [12.36, -1.56], 'GN': [9.95, -11.24],
  'CM': [3.85, 11.50], 'TD': [15.45, 18.73], 'ER': [15.18, 39.78],
  'MR': [21.01, -10.94], 'SN': [14.50, -14.45], 'GH': [7.95, -1.02],
  'CI': [7.54, -5.55], 'LR': [6.43, -9.43], 'SL': [8.46, -11.78],
  'MG': [-18.77, 46.87], 'RW': [-1.94, 29.87], 'BI': [-3.38, 29.92],
  'SA': [23.89, 45.08], 'AZ': [40.14, 47.58], 'AM': [40.07, 45.04],
  'GE': [42.32, 43.36], 'MD': [47.41, 28.37], 'BY': [53.71, 28.05],
  'RS': [44.02, 20.91], 'BA': [44.14, 17.68], 'XK': [42.57, 20.90],
  'MK': [41.61, 21.74], 'AL': [41.15, 20.17], 'LK': [7.87, 80.77],
  'BD': [23.68, 90.36], 'NP': [28.39, 84.12], 'KH': [12.57, 104.99],
  'LA': [19.86, 102.50], 'VN': [14.06, 108.28], 'PH': [12.88, 121.77],
  'ID': [-0.79, 113.92], 'GT': [15.78, -90.23], 'HN': [15.20, -86.24],
  'SV': [13.79, -88.90], 'NI': [12.86, -85.21], 'EC': [-1.83, -78.18],
  'BO': [-16.29, -63.59], 'PY': [-23.44, -58.44], 'UY': [-32.52, -55.77],
  'CL': [-35.68, -71.54], 'KP': [40.34, 127.51], 'TN': [33.89, 9.54],
  'DZ': [28.03, 1.66], 'MA': [31.79, -7.09], 'EG': [26.82, 30.80],
  'JO': [30.59, 36.24], 'KZ': [48.02, 66.92], 'UZ': [41.38, 63.97],
  'TJ': [38.86, 71.28], 'TM': [38.97, 59.56], 'KG': [41.20, 74.77],
}

function getEventCoords(event: IntelEvent): { lat: number; lng: number } | null {
  // Try exact coordinates first
  const coords = parseCoords(event.location)
  if (coords) return coords

  // Fall back to country centroid
  if (event.country_code) {
    const centroid = COUNTRY_CENTROIDS[event.country_code.toUpperCase()]
    if (centroid) {
      // Add small jitter to spread clustered country events
      const jitter = () => (Math.random() - 0.5) * 3
      return { lat: centroid[0] + jitter(), lng: centroid[1] + jitter() }
    }
  }
  return null
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
  layerToggles: { vessels: boolean; flights: boolean; thermal: boolean; intel?: boolean; heatmap?: boolean }
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

      // Restore saved AOI from localStorage or use URL params or default
      let initialCenter: [number, number] = DEFAULT_CENTER
      let initialZoom = DEFAULT_ZOOM

      const urlLat = searchParams?.get('lat')
      const urlLng = searchParams?.get('lng')
      if (urlLat && urlLng) {
        initialCenter = [parseFloat(urlLng), parseFloat(urlLat)]
        initialZoom = 6
      } else {
        try {
          const saved = localStorage.getItem('opmap_aoi')
          if (saved) {
            const parsed = JSON.parse(saved) as { center?: [number, number]; zoom?: number }
            if (parsed.center) initialCenter = parsed.center
            if (parsed.zoom) initialZoom = parsed.zoom
          }
        } catch { /* ignore */ }
      }

      const map = new maplibre.Map({
        container: containerRef.current,
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: initialCenter,
        zoom: initialZoom,
      })
      map.addControl(new maplibre.NavigationControl(), 'top-right')

      // Save AOI on move end
      map.on('moveend', () => {
        try {
          const c = map.getCenter()
          localStorage.setItem('opmap_aoi', JSON.stringify({ center: [c.lng, c.lat], zoom: map.getZoom() }))
        } catch { /* ignore */ }
      })

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

        // Intel events layer — severity-sized + colored markers
        map.addSource('intel', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({
          id: 'intel-halo',
          type: 'circle',
          source: 'intel',
          filter: ['==', ['get', 'severity'], 4],
          paint: {
            'circle-radius': 18,
            'circle-color': '#ef4444',
            'circle-opacity': ['interpolate', ['linear'], ['zoom'], 2, 0.15, 6, 0.08],
            'circle-stroke-width': 0,
          },
        })
        map.addLayer({
          id: 'intel',
          type: 'circle',
          source: 'intel',
          paint: {
            // Size: 8px base + 4px per severity level
            'circle-radius': [
              'match', ['get', 'severity'],
              1, 8,
              2, 12,
              3, 16,
              4, 20,
              8
            ] as any,
            'circle-color': [
              'match', ['get', 'severity'],
              1, '#6B7280',
              2, '#EAB308',
              3, '#F97316',
              4, '#ef4444',
              '#6B7280'
            ] as any,
            'circle-opacity': 0.9,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#fff',
            'circle-stroke-opacity': 0.7,
          },
        })

        // Heatmap layer (hidden by default)
        map.addLayer({
          id: 'intel-heatmap',
          type: 'heatmap',
          source: 'intel',
          layout: { visibility: 'none' },
          paint: {
            'heatmap-weight': ['interpolate', ['linear'], ['get', 'severity'], 1, 0.2, 4, 1.0],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, 'rgba(0,0,255,0)',
              0.2, '#3b82f6',
              0.4, '#eab308',
              0.6, '#f97316',
              1, '#ef4444'
            ],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 20, 9, 40],
            'heatmap-opacity': 0.75,
          },
        })

        // Intel labels (visible at zoom 5+)
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

        // Tooltips for vessel/flight/thermal
        const popup = new maplibre.Popup({ closeButton: false, closeOnClick: true })
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

        // If URL has eventId, trigger click after load
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

    // Build intel GeoJSON — use exact coords or country centroid
    const intelFeatures = intelEvents
      .map(e => {
        const coords = getEventCoords(e)
        if (!coords) return null
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [coords.lng, coords.lat] },
          properties: {
            id: e.id,
            title: e.title,
            severity: e.severity ?? 1,
            source: e.source,
            region: e.region || e.country_code || '',
            occurred_at: e.occurred_at,
            label: e.title.slice(0, 30),
          },
        }
      })
      .filter((f): f is NonNullable<typeof f> => f !== null)

    intelSource?.setData({ type: 'FeatureCollection', features: intelFeatures })

    // Layer visibility
    const showIntel = layerToggles.intel ?? true
    const showHeatmap = layerToggles.heatmap ?? false

    if (map.getLayer('vessels')) map.setLayoutProperty('vessels', 'visibility', layerToggles.vessels ? 'visible' : 'none')
    if (map.getLayer('flights')) map.setLayoutProperty('flights', 'visibility', layerToggles.flights ? 'visible' : 'none')
    if (map.getLayer('thermals')) map.setLayoutProperty('thermals', 'visibility', layerToggles.thermal ? 'visible' : 'none')

    if (showHeatmap) {
      // Show heatmap, hide dot markers
      if (map.getLayer('intel')) map.setLayoutProperty('intel', 'visibility', 'none')
      if (map.getLayer('intel-halo')) map.setLayoutProperty('intel-halo', 'visibility', 'none')
      if (map.getLayer('intel-labels')) map.setLayoutProperty('intel-labels', 'visibility', 'none')
      if (map.getLayer('intel-heatmap')) map.setLayoutProperty('intel-heatmap', 'visibility', showIntel ? 'visible' : 'none')
    } else {
      if (map.getLayer('intel-heatmap')) map.setLayoutProperty('intel-heatmap', 'visibility', 'none')
      if (map.getLayer('intel')) map.setLayoutProperty('intel', 'visibility', showIntel ? 'visible' : 'none')
      if (map.getLayer('intel-halo')) map.setLayoutProperty('intel-halo', 'visibility', showIntel ? 'visible' : 'none')
      if (map.getLayer('intel-labels')) map.setLayoutProperty('intel-labels', 'visibility', showIntel ? 'visible' : 'none')
    }
  }, [flights, intelEvents, layerToggles, thermals, vessels])

  return <div ref={containerRef} className="h-full min-h-[520px] w-full" />
}
