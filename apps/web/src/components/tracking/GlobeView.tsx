'use client'

import { useEffect, useRef, useState, useMemo } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Aircraft {
  icao24: string
  callsign: string
  latitude: number
  longitude: number
  altitude: number
  velocity: number
  heading: number
  on_ground: boolean
}

export interface GlobeIntelEvent {
  id: string
  source: string
  title: string
  description?: string | null
  severity?: number | null
  region?: string | null
  occurred_at?: string | null
  ingested_at?: string | null
  event_type?: string | null
  country_code?: string | null
  provenance_raw?: Record<string, unknown> | null
  location?: string | null
}

interface GlobeViewProps {
  events: GlobeIntelEvent[]
  onEventClick: (event: GlobeIntelEvent) => void
  showAircraft: boolean
  showShippingLanes: boolean
  showHeatmap: boolean
  timeWindow: string
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SEVERITY_COLORS: Record<number, string> = {
  4: '#ef4444',
  3: '#f97316',
  2: '#eab308',
  1: '#6b7280',
}

const SEVERITY_ALTITUDE: Record<number, number> = {
  4: 0.04,
  3: 0.03,
  2: 0.02,
  1: 0.01,
}

const SHIPPING_LANES = [
  { start: [31.2, 121.5], end: [51.5, 0.1] },
  { start: [37.8, -122.4], end: [31.2, 121.5] },
  { start: [40.7, -74.0], end: [51.5, 0.1] },
  { start: [25.2, 55.3], end: [1.3, 103.8] },
  { start: [31.2, 121.5], end: [-33.9, 18.4] },
  { start: [-33.9, 18.4], end: [51.5, 0.1] },
]

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
  'MZ': [-18.67, 35.53], 'ZA': [-30.56, 22.94], 'KE': [-0.02, 37.91],
  'TZ': [-6.37, 34.89], 'CM': [3.85, 11.50], 'GH': [7.95, -1.02],
  'SN': [14.50, -14.45], 'CI': [7.54, -5.55], 'KH': [12.57, 104.99],
  'TH': [15.87, 100.99], 'PH': [12.88, 121.77], 'ID': [-0.79, 113.92],
  'VN': [14.06, 108.28], 'JP': [36.20, 138.25], 'KR': [35.91, 127.77],
  'SA': [23.89, 45.08], 'JO': [30.59, 36.24], 'EG': [26.82, 30.80],
  'MA': [31.79, -7.09], 'TN': [33.89, 9.54], 'DZ': [28.03, 1.66],
  'GT': [15.78, -90.23], 'SV': [13.79, -88.90], 'HN': [15.20, -86.24],
  'NI': [12.87, -85.21], 'AO': [-11.20, 17.87], 'BF': [12.36, -1.56],
  'TD': [15.45, 18.73], 'ER': [15.18, 39.78], 'UG': [1.37, 32.29],
  'RW': [-1.94, 29.87], 'BI': [-3.38, 29.92], 'AZ': [40.14, 47.58],
  'GE': [42.32, 43.36], 'BY': [53.71, 28.05], 'RS': [44.02, 20.91],
  'LK': [7.87, 80.77], 'BD': [23.68, 90.36], 'NP': [28.39, 84.12],
  'LA': [19.86, 102.50], 'KP': [40.34, 127.51], 'KZ': [48.02, 66.92],
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

function getEventCoords(event: GlobeIntelEvent): [number, number] | null {
  const coords = parseCoords(event.location)
  if (coords) return [coords.lat, coords.lng]
  if (event.country_code) {
    const centroid = COUNTRY_CENTROIDS[event.country_code.toUpperCase()]
    if (centroid) {
      return [centroid[0] + (Math.random() - 0.5) * 2, centroid[1] + (Math.random() - 0.5) * 2]
    }
  }
  return null
}

// ─── GlobeView Component ──────────────────────────────────────────────────────
export default function GlobeView({
  events,
  onEventClick,
  showAircraft,
  showShippingLanes,
}: GlobeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null)
  const [aircraft, setAircraft] = useState<Aircraft[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [aircraftError, setAircraftError] = useState<string | null>(null)

  // Build event points
  const eventPoints = useMemo(() => {
    return events
      .map(e => {
        const coords = getEventCoords(e)
        if (!coords) return null
        return {
          lat: coords[0],
          lng: coords[1],
          altitude: SEVERITY_ALTITUDE[e.severity ?? 1] ?? 0.01,
          radius: 0.4 + (e.severity ?? 1) * 0.15,
          color: SEVERITY_COLORS[e.severity ?? 1] ?? '#6b7280',
          event: e,
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
  }, [events])

  // Build aircraft points
  const aircraftPoints = useMemo(() => {
    return aircraft.map(a => ({
      lat: a.latitude,
      lng: a.longitude,
      altitude: Math.min((a.altitude ?? 0) / 100000, 0.08),
      color: '#38bdf8',
      size: 0.25,
    }))
  }, [aircraft])

  // ── Initialize globe ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let globe: any = null
    let destroyed = false

    const init = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const GlobeLib = (await import('globe.gl')).default as any
      if (destroyed || !containerRef.current) return

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      globe = (GlobeLib as any)()(containerRef.current)
        .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
        .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
        .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
        .width(containerRef.current.offsetWidth)
        .height(containerRef.current.offsetHeight)
        .pointOfView({ lat: 20, lng: 30, altitude: 2.5 })
        .enablePointerInteraction(true)
        // Event points
        .pointsData([])
        .pointLat('lat')
        .pointLng('lng')
        .pointAltitude('altitude')
        .pointRadius('radius')
        .pointColor('color')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .pointLabel((d: any) => {
          const e = d.event as GlobeIntelEvent
          const color = d.color as string
          return `<div style="background:rgba(0,0,0,0.85);padding:8px 12px;border-radius:6px;max-width:260px;font-size:12px;font-family:Inter,sans-serif;border-left:3px solid ${color}">
            <strong style="color:#f1f5f9">${e.title}</strong><br/>
            <span style="color:#94a3b8;font-size:11px">${e.region ?? e.country_code ?? 'Unknown location'}</span>
          </div>`
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .onPointClick((d: any) => {
          onEventClick(d.event as GlobeIntelEvent)
          // Stop rotation for 5s then resume
          if (globe?.controls) {
            globe.controls().autoRotate = false
            setTimeout(() => {
              if (globe?.controls) globe.controls().autoRotate = true
            }, 5000)
          }
        })
        // Rings layer (aircraft)
        .ringsData([])
        .ringLat('lat')
        .ringLng('lng')
        .ringColor(() => '#38bdf8')
        .ringMaxRadius(0.5)
        .ringPropagationSpeed(0.5)
        .ringRepeatPeriod(3000)
        // Arcs layer (shipping lanes)
        .arcsData([])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .arcStartLat((d: any) => d.start[0])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .arcStartLng((d: any) => d.start[1])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .arcEndLat((d: any) => d.end[0])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .arcEndLng((d: any) => d.end[1])
        .arcColor(() => 'rgba(59,130,246,0.3)')
        .arcStroke(() => 0.5)
        .arcDashLength(0.4)
        .arcDashGap(0.2)
        .arcDashAnimateTime(3000)

      // Auto-rotate
      globe.controls().autoRotate = true
      globe.controls().autoRotateSpeed = 0.3

      globeRef.current = globe
      setIsLoading(false)
    }

    init().catch(console.error)

    return () => {
      destroyed = true
      try { globe?._destructor?.() } catch { /* ignore */ }
      globeRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Resize handler ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => {
      if (globeRef.current && containerRef.current) {
        globeRef.current
          .width(containerRef.current.offsetWidth)
          .height(containerRef.current.offsetHeight)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // ── Update event points ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!globeRef.current) return
    globeRef.current.pointsData(eventPoints)
  }, [eventPoints])

  // ── Update aircraft rings ────────────────────────────────────────────────────
  useEffect(() => {
    if (!globeRef.current) return
    globeRef.current.ringsData(showAircraft && aircraftPoints.length > 0 ? aircraftPoints : [])
  }, [aircraftPoints, showAircraft])

  // ── Update shipping lanes ────────────────────────────────────────────────────
  useEffect(() => {
    if (!globeRef.current) return
    globeRef.current.arcsData(showShippingLanes ? SHIPPING_LANES : [])
  }, [showShippingLanes])

  // ── Fetch aircraft from OpenSky ──────────────────────────────────────────────
  useEffect(() => {
    if (!showAircraft) {
      setAircraft([])
      return
    }

    const fetchAircraft = async () => {
      try {
        const res = await fetch(
          'https://opensky-network.org/api/states/all?lamin=-60&lomin=-180&lamax=85&lomax=180',
          { signal: AbortSignal.timeout(15000) }
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json() as { states: unknown[][] | null }

        if (!data.states) { setAircraft([]); return }

        const parsed: Aircraft[] = data.states
          .filter((s: unknown[]) => s[5] != null && s[6] != null)
          .slice(0, 2000)
          .map((s: unknown[]) => ({
            icao24: String(s[0] ?? ''),
            callsign: String(s[1] ?? '').trim(),
            latitude: Number(s[6]),
            longitude: Number(s[5]),
            altitude: Number(s[7] ?? s[13] ?? 0),
            velocity: Number(s[9] ?? 0),
            heading: Number(s[10] ?? 0),
            on_ground: Boolean(s[8]),
          }))
          .filter((a: Aircraft) => !isNaN(a.latitude) && !isNaN(a.longitude) && !a.on_ground)

        setAircraft(parsed)
        setAircraftError(null)
      } catch (err) {
        console.warn('[OpenSky] fetch failed:', err)
        setAircraftError('Flight data temporarily unavailable')
      }
    }

    void fetchAircraft()
    const interval = setInterval(() => { void fetchAircraft() }, 15000)
    return () => clearInterval(interval)
  }, [showAircraft])

  return (
    <div className="relative w-full h-full bg-black">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-gray-400">Initializing globe...</p>
          </div>
        </div>
      )}

      {/* Globe canvas */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Aircraft badge */}
      {showAircraft && !aircraftError && aircraft.length > 0 && (
        <div className="absolute top-4 left-4 bg-black/70 border border-sky-500/30 rounded-lg px-3 py-1.5 text-xs text-sky-400 backdrop-blur-sm pointer-events-none">
          ✈ {aircraft.length.toLocaleString()} aircraft tracked
        </div>
      )}
      {aircraftError && showAircraft && (
        <div className="absolute top-4 left-4 bg-black/70 border border-red-500/30 rounded-lg px-3 py-1.5 text-xs text-red-400 backdrop-blur-sm pointer-events-none">
          ✈ {aircraftError}
        </div>
      )}

      {/* Incident count badge */}
      {eventPoints.length > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 backdrop-blur-sm pointer-events-none">
          ● {eventPoints.length} active incidents
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-black/80 border border-gray-700 rounded-lg p-3 text-xs text-gray-400 backdrop-blur-sm space-y-1.5 pointer-events-none">
        <div className="text-gray-300 font-semibold mb-2 text-[11px] uppercase tracking-wider">Severity</div>
        {[
          { color: '#ef4444', label: 'Critical' },
          { color: '#f97316', label: 'High' },
          { color: '#eab308', label: 'Medium' },
          { color: '#6b7280', label: 'Low' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <span>{label}</span>
          </div>
        ))}
        {showAircraft && (
          <div className="flex items-center gap-2 pt-1.5 border-t border-gray-700/60 mt-1">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-sky-400" />
            <span>Aircraft (live)</span>
          </div>
        )}
        {showShippingLanes && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 flex-shrink-0 bg-blue-400/50 rounded" />
            <span>Shipping lanes</span>
          </div>
        )}
      </div>

      {/* Hint */}
      {!isLoading && (
        <div className="absolute bottom-4 right-4 bg-black/60 border border-gray-700/50 rounded-lg px-2.5 py-1.5 text-[10px] text-gray-500 backdrop-blur-sm pointer-events-none">
          Click marker · Drag to rotate · Scroll to zoom
        </div>
      )}
    </div>
  )
}
