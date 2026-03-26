'use client'

import { useEffect, useRef } from 'react'

type Vessel = { mmsi?: number; ship_name?: string | null; ship_type?: number; latitude: number; longitude: number; speed?: number; flag?: string | null; last_seen?: string | null }
type Flight = { icao24?: string; callsign?: string | null; latitude: number; longitude: number; altitude?: number; is_military?: boolean; last_seen?: string | null }
type Thermal = { region: string; frp: number; lat: number; lon: number; detected_at: string }

export default function TrackingMap({ vessels, flights, thermals, layerToggles }: { vessels: Vessel[]; flights: Flight[]; thermals: Thermal[]; layerToggles: { vessels: boolean; flights: boolean; thermal: boolean } }) {
  const mapRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let mounted = true
    void import('maplibre-gl').then((mod) => {
      if (!mounted || !containerRef.current || mapRef.current) return
      const maplibre = mod.default
      const map = new maplibre.Map({
        container: containerRef.current,
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [30, 20],
        zoom: 2,
      })
      map.addControl(new maplibre.NavigationControl(), 'top-right')
      map.on('load', () => {
        map.addSource('vessels', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({ id: 'vessels', type: 'circle', source: 'vessels', paint: { 'circle-radius': 5, 'circle-color': ['case', ['==', ['get', 'ship_type'], 35], '#EF4444', '#3B82F6'], 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } })
        map.addSource('flights', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({ id: 'flights', type: 'symbol', source: 'flights', layout: { 'text-field': '▲', 'text-size': 14 }, paint: { 'text-color': '#FBBF24' } })
        map.addSource('thermals', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({ id: 'thermals', type: 'circle', source: 'thermals', paint: { 'circle-radius': 7, 'circle-color': '#F97316', 'circle-opacity': 0.75 } })

        const popup = new maplibre.Popup({ closeButton: false, closeOnClick: true })
        for (const layer of ['vessels', 'flights', 'thermals']) {
          map.on('click', layer, (e: any) => {
            const feature = e.features?.[0]
            if (!feature) return
            const props = feature.properties ?? {}
            popup.setLngLat(e.lngLat).setHTML(`<div style="font:12px Inter,sans-serif;color:#0f172a"><strong>${props.label || props.name || 'Track'}</strong><div>${props.meta || ''}</div></div>`).addTo(map)
          })
        }
      })
      mapRef.current = map
    })
    return () => { mounted = false; mapRef.current?.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const vesselSource = map.getSource('vessels') as any
    const flightSource = map.getSource('flights') as any
    const thermalSource = map.getSource('thermals') as any
    vesselSource?.setData({ type: 'FeatureCollection', features: vessels.map((v) => ({ type: 'Feature', properties: { ship_type: v.ship_type, label: v.ship_name || `MMSI ${v.mmsi}`, meta: `${v.flag || '--'} · ${v.speed || 0}kn` }, geometry: { type: 'Point', coordinates: [v.longitude, v.latitude] } })) })
    flightSource?.setData({ type: 'FeatureCollection', features: flights.map((f) => ({ type: 'Feature', properties: { label: f.callsign || f.icao24, meta: `${f.altitude || 0}m` }, geometry: { type: 'Point', coordinates: [f.longitude, f.latitude] } })) })
    thermalSource?.setData({ type: 'FeatureCollection', features: thermals.map((t) => ({ type: 'Feature', properties: { label: t.region, meta: `FRP ${t.frp}` }, geometry: { type: 'Point', coordinates: [t.lon, t.lat] } })) })
    if (map.getLayer('vessels')) map.setLayoutProperty('vessels', 'visibility', layerToggles.vessels ? 'visible' : 'none')
    if (map.getLayer('flights')) map.setLayoutProperty('flights', 'visibility', layerToggles.flights ? 'visible' : 'none')
    if (map.getLayer('thermals')) map.setLayoutProperty('thermals', 'visibility', layerToggles.thermal ? 'visible' : 'none')
  }, [flights, layerToggles, thermals, vessels])

  return <div ref={containerRef} className="h-full min-h-[520px] w-full" />
}
