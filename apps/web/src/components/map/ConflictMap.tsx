'use client'

import { useEffect, useRef } from 'react'
import type { ConflictEvent } from '@conflict-ops/shared'

// MapLibre loaded dynamically — never SSR
let maplibregl: typeof import('maplibre-gl') | null = null

const SEVERITY_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#FF0000']

interface ConflictMapProps {
  events?: ConflictEvent[]
  className?: string
}

export function ConflictMap({ events = [], className = '' }: ConflictMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('maplibre-gl').Map | null>(null)
  const isInitialized = useRef(false)

  useEffect(() => {
    if (isInitialized.current || !mapContainer.current) return

    const initMap = async () => {
      // Dynamic import — never SSR
      maplibregl = await import('maplibre-gl')
      await import('maplibre-gl/dist/maplibre-gl.css')

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
                'raster-saturation': -0.8,
                'raster-brightness-min': 0.1,
                'raster-brightness-max': 0.4,
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
        // Add events as GeoJSON source
        const geojsonData = buildGeoJSON(events)

        map.addSource('events', {
          type: 'geojson',
          data: geojsonData,
          cluster: true,
          clusterMaxZoom: 8,
          clusterRadius: 50,
        })

        // Cluster circles
        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'events',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#00FF88',
            'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 30],
            'circle-opacity': 0.8,
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
            'text-font': ['Open Sans Bold'],
            'text-size': 11,
          },
          paint: { 'text-color': '#080A0E' },
        })

        // Individual event points
        map.addLayer({
          id: 'unclustered-point',
          type: 'circle',
          source: 'events',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': ['get', 'color'],
            'circle-radius': 6,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#000',
            'circle-opacity': 0.9,
          },
        })
      })

      // Cursor pointer on hover
      map.on('mouseenter', 'unclustered-point', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'unclustered-point', () => {
        map.getCanvas().style.cursor = ''
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
  }, []) // Only init once

  // Update map data when events change
  useEffect(() => {
    if (!mapRef.current || !isInitialized.current) return

    const source = mapRef.current.getSource('events') as import('maplibre-gl').GeoJSONSource | undefined
    if (source) {
      source.setData(buildGeoJSON(events))
    }
  }, [events])

  return (
    <div
      ref={mapContainer}
      className={`w-full h-full relative ${className}`}
      style={{ backgroundColor: 'var(--bg-base)' }}
    />
  )
}

function buildGeoJSON(events: ConflictEvent[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = events
    .filter(e => e.location !== null)
    .map(event => {
      const loc = event.location as { coordinates: [number, number] } | null
      if (!loc) return null

      const severity = event.severity ?? 1
      const color = SEVERITY_COLORS[(severity - 1)] ?? SEVERITY_COLORS[0]

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: loc.coordinates,
        },
        properties: {
          id: event.id,
          title: event.title,
          severity,
          color,
          event_type: event.eventType,
          country_code: event.countryCode,
          occurred_at: event.occurredAt,
        },
      }
    })
    .filter((f): f is GeoJSON.Feature => f !== null)

  return { type: 'FeatureCollection', features }
}
