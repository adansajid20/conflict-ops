import { createServiceClient } from '@/lib/supabase/server'

type Chokepoint = {
  name: string
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
}

type VesselTrack = {
  latitude: number | null
  longitude: number | null
  last_seen: string | null
}

type EventPoint = {
  severity: number | null
  occurred_at: string | null
  location: string | null
}

const CHOKEPOINTS: Chokepoint[] = [
  { name: 'Strait of Hormuz', minLat: 24.0, maxLat: 27.5, minLon: 55.0, maxLon: 58.8 },
  { name: 'Suez Canal', minLat: 29.7, maxLat: 31.5, minLon: 32.1, maxLon: 32.7 },
  { name: 'Malacca Strait', minLat: 1.0, maxLat: 6.0, minLon: 98.0, maxLon: 104.5 },
  { name: 'Bab-el-Mandeb', minLat: 11.0, maxLat: 14.8, minLon: 42.0, maxLon: 45.5 },
  { name: 'Bosphorus', minLat: 40.8, maxLat: 41.3, minLon: 28.8, maxLon: 29.3 },
  { name: 'Panama Canal', minLat: 8.7, maxLat: 9.5, minLon: -80.3, maxLon: -79.5 },
  { name: 'Gibraltar', minLat: 35.8, maxLat: 36.4, minLon: -5.7, maxLon: -4.7 },
  { name: 'Taiwan Strait', minLat: 21.5, maxLat: 27.0, minLon: 117.0, maxLon: 122.5 },
]

function parsePointWkt(input: string | null): { lat: number; lon: number } | null {
  if (!input) return null
  const match = input.match(/POINT\(([-.0-9]+)\s+([-.0-9]+)\)/)
  if (!match) return null
  const lon = Number(match[1])
  const lat = Number(match[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return { lat, lon }
}

function inBounds(point: { lat: number; lon: number }, box: Chokepoint): boolean {
  return point.lat >= box.minLat && point.lat <= box.maxLat && point.lon >= box.minLon && point.lon <= box.maxLon
}

export async function ChokepointDashboard() {
  const supabase = createServiceClient()
  const recentWindow = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const conflictWindow = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: vessels }, { data: events }] = await Promise.all([
    supabase.from('maritime_tracks').select('latitude, longitude, last_seen').gte('last_seen', recentWindow),
    supabase.from('events').select('severity, occurred_at, location::text').gte('occurred_at', conflictWindow).not('location', 'is', null).limit(400),
  ])

  const vesselRows = (vessels ?? []) as VesselTrack[]
  const eventRows = (events ?? []) as EventPoint[]

  const cards = CHOKEPOINTS.map((point) => {
    const vesselCount = vesselRows.filter((row) => {
      if (row.latitude == null || row.longitude == null) return false
      return inBounds({ lat: row.latitude, lon: row.longitude }, point)
    }).length

    const nearbyEvents = eventRows.filter((row) => {
      const parsed = parsePointWkt(row.location)
      return parsed ? inBounds(parsed, point) : false
    })

    const riskScore = nearbyEvents.reduce((sum, row) => sum + Math.max(1, row.severity ?? 1), 0)
    const latestSeen = vesselRows
      .filter((row) => {
        if (row.latitude == null || row.longitude == null) return false
        return inBounds({ lat: row.latitude, lon: row.longitude }, point)
      })
      .map((row) => row.last_seen)
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null

    return {
      ...point,
      vesselCount,
      riskScore,
      lastUpdated: latestSeen,
    }
  })

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.name} className="rounded-lg border border-white/[0.05] bg-white/[0.015] p-4">
          <div className="text-xs uppercase tracking-[0.16em] text-white/30">Chokepoint</div>
          <div className="mt-1 text-lg font-semibold text-white">{card.name}</div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-white/30">Live vessels</div>
              <div className="font-semibold text-white">{card.vesselCount}</div>
            </div>
            <div>
              <div className="text-white/30">Risk score</div>
              <div className="font-semibold" style={{ color: card.riskScore >= 10 ? '#EF4444' : card.riskScore >= 5 ? '#F97316' : '#ffffff' }}>{card.riskScore}</div>
            </div>
          </div>
          <div className="mt-4 text-xs text-white/30">
            Last updated: {card.lastUpdated ? new Date(card.lastUpdated).toLocaleString() : 'No recent vessel hits'}
          </div>
        </div>
      ))}
    </div>
  )
}
