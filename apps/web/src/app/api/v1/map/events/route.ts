export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCachedSnapshot, setCachedSnapshot } from '@/lib/cache/redis'

type MapEventRow = {
  id: string
  title: string | null
  occurred_at: string | null
  severity: number | null
  event_type: string | null
  region: string | null
  source: string | null
  source_id: string | null
  significance_score: number | null
  summary_short: string | null
}

// ── CITY-LEVEL COORDINATES (150+ conflict-relevant cities) ─────────────────
const CITY_COORDS: Record<string, [number, number]> = {
  // Ukraine front lines
  kyiv: [30.52, 50.45], kiev: [30.52, 50.45],
  kharkiv: [36.23, 49.99], kherson: [32.61, 46.64],
  mariupol: [37.54, 47.09], zaporizhzhia: [35.14, 47.84],
  odesa: [30.72, 46.48], odessa: [30.72, 46.48],
  dnipro: [35.04, 48.46], mykolaiv: [31.99, 46.97],
  donetsk: [37.80, 48.00], luhansk: [39.30, 48.57],
  bakhmut: [37.99, 48.59], avdiivka: [37.75, 48.14],
  sumy: [34.80, 50.91], pokrovsk: [37.18, 48.28],
  kurakhove: [37.27, 47.98], kostiantynivka: [37.70, 48.52],
  'chasiv yar': [37.86, 48.60],
  // Russia
  moscow: [37.62, 55.75], 'st petersburg': [30.32, 59.93],
  belgorod: [36.59, 50.60], kursk: [36.19, 51.73],
  bryansk: [34.36, 53.24], voronezh: [39.20, 51.67],
  rostov: [39.72, 47.23], ryazan: [39.73, 54.62],
  // Gaza / Israel / Lebanon
  gaza: [34.46, 31.50], 'gaza city': [34.46, 31.50],
  rafah: [34.24, 31.28], 'khan younis': [34.31, 31.34],
  jabalia: [34.49, 31.53], 'deir al-balah': [34.35, 31.41],
  'tel aviv': [34.78, 32.08], jerusalem: [35.22, 31.77],
  haifa: [34.99, 32.82], 'beer sheva': [34.79, 31.25],
  beirut: [35.50, 33.89], 'southern lebanon': [35.57, 33.27],
  // Iraq
  baghdad: [44.38, 33.34], mosul: [43.13, 36.34],
  basra: [47.78, 30.51], kirkuk: [44.40, 35.47], erbil: [44.01, 36.19],
  // Syria
  damascus: [36.29, 33.51], aleppo: [37.16, 36.20],
  idlib: [36.63, 35.93], homs: [36.72, 34.73],
  'deir ez-zor': [40.14, 35.33], raqqa: [39.02, 35.95],
  // Iran
  tehran: [51.39, 35.69], isfahan: [51.67, 32.66],
  ahvaz: [48.67, 31.32], mashhad: [59.57, 36.30],
  // Yemen
  sanaa: [44.20, 15.35], aden: [45.04, 12.78],
  hodeidah: [42.95, 14.80], marib: [45.32, 15.47],
  // Other Middle East
  riyadh: [46.68, 24.69], jeddah: [39.19, 21.54],
  kabul: [69.17, 34.52], kandahar: [65.71, 31.61],
  herat: [62.20, 34.34], jalalabad: [70.45, 34.43],
  amman: [35.93, 31.95],
  // South Asia
  islamabad: [73.05, 33.72], karachi: [67.01, 24.86],
  lahore: [74.34, 31.55], peshawar: [71.57, 34.01],
  quetta: [66.99, 30.19], rawalpindi: [73.05, 33.60],
  mumbai: [72.88, 19.08], delhi: [77.10, 28.70],
  'new delhi': [77.21, 28.63], dhaka: [90.41, 23.81],
  colombo: [79.86, 6.93], kathmandu: [85.32, 27.72],
  // East / Southeast Asia
  beijing: [116.40, 39.91], shanghai: [121.47, 31.23],
  taipei: [121.56, 25.04], 'hong kong': [114.17, 22.32],
  pyongyang: [125.73, 39.02], seoul: [126.97, 37.57],
  tokyo: [139.69, 35.69], yangon: [96.15, 16.87],
  mandalay: [96.07, 21.97], naypyidaw: [96.12, 19.75],
  manila: [120.98, 14.60], jakarta: [106.84, -6.21],
  'kuala lumpur': [101.69, 3.14], bangkok: [100.52, 13.75],
  hanoi: [105.85, 21.03], 'ho chi minh': [106.66, 10.82],
  // Africa
  khartoum: [32.53, 15.55], omdurman: [32.49, 15.65],
  'port sudan': [37.21, 19.61], 'el fasher': [25.35, 13.63],
  darfur: [24.90, 13.50], mogadishu: [45.34, 2.05],
  hargeisa: [44.07, 9.56], 'addis ababa': [38.75, 9.03],
  mekelle: [39.47, 13.50], nairobi: [36.82, -1.29],
  kampala: [32.58, 0.31], kinshasa: [15.32, -4.32],
  goma: [29.22, -1.67], bukavu: [28.85, -2.50],
  beni: [29.47, 0.49], bangui: [18.56, 4.36],
  bamako: [-7.99, 12.65], ouagadougou: [-1.52, 12.37],
  niamey: [2.11, 13.51], ndjamena: [15.04, 12.11],
  abuja: [7.49, 9.06], lagos: [3.38, 6.46],
  maiduguri: [13.16, 11.83],
  // North Africa
  tripoli: [13.18, 32.89], benghazi: [20.07, 32.12],
  cairo: [31.24, 30.04], alexandria: [29.92, 31.20],
  tunis: [10.18, 36.82], algiers: [3.05, 36.74],
  casablanca: [-7.59, 33.59], rabat: [-6.85, 34.02],
  dakar: [-17.44, 14.69], accra: [-0.19, 5.56],
  // Southern Africa
  maputo: [32.58, -25.96], harare: [31.05, -17.83],
  luanda: [13.23, -8.84], lusaka: [28.29, -15.42],
  'cape town': [18.42, -33.93], johannesburg: [28.05, -26.20],
  // Europe
  london: [-0.12, 51.51], paris: [2.35, 48.85],
  berlin: [13.40, 52.52], brussels: [4.36, 50.85],
  warsaw: [21.01, 52.23], budapest: [19.04, 47.50],
  belgrade: [20.46, 44.80], bucharest: [26.10, 44.44],
  sofia: [23.32, 42.70], athens: [23.73, 37.98],
  istanbul: [28.95, 41.01], ankara: [32.86, 39.93],
  pristina: [21.17, 42.67], sarajevo: [18.42, 43.85],
  tbilisi: [44.80, 41.69], baku: [49.87, 40.41],
  yerevan: [44.51, 40.18], minsk: [27.56, 53.90],
  chisinau: [28.86, 47.00], vilnius: [25.28, 54.69],
  // Americas
  washington: [-77.04, 38.91], 'new york': [-74.01, 40.71],
  caracas: [-66.90, 10.49], bogota: [-74.08, 4.71],
  havana: [-82.38, 23.14], 'port au prince': [-72.34, 18.54],
  'mexico city': [-99.13, 19.43], tegucigalpa: [-87.21, 14.10],
  managua: [-86.29, 12.13],
}

// Country name → centroid
const COUNTRY_COORDS: Record<string, [number, number]> = {
  ukraine: [31.0, 49.0], russia: [55.0, 61.0],
  israel: [34.9, 31.5], gaza: [34.3, 31.4],
  iran: [53.0, 32.5], syria: [38.3, 34.8],
  iraq: [43.7, 33.2], yemen: [47.6, 15.9],
  lebanon: [35.5, 33.9], turkey: [35.2, 39.0], turkiye: [35.2, 39.0],
  pakistan: [69.3, 30.4], afghanistan: [67.7, 33.9],
  india: [78.9, 20.6], myanmar: [96.0, 19.7],
  china: [104.2, 35.9], taiwan: [120.9, 23.6],
  'north korea': [127.5, 40.3], 'south korea': [127.8, 36.6],
  sudan: [30.2, 15.5], ethiopia: [40.5, 9.1],
  somalia: [45.3, 5.2], nigeria: [8.7, 9.1],
  mali: [-2.0, 17.6], niger: [8.0, 17.0],
  'burkina faso': [-1.6, 12.4], cameroon: [12.4, 3.9],
  congo: [24.0, -2.9], drc: [24.0, -2.9],
  libya: [17.2, 26.3], egypt: [30.8, 26.8],
  haiti: [-72.3, 18.9], venezuela: [-66.6, 8.0],
  colombia: [-74.3, 4.6], mexico: [-102.5, 23.6],
  philippines: [121.8, 12.9], indonesia: [113.9, -0.8],
  bangladesh: [90.4, 23.7], 'saudi arabia': [45.1, 23.9],
  saudi: [45.1, 23.9], georgia: [43.4, 42.3],
  azerbaijan: [49.87, 40.41], armenia: [44.51, 40.18],
  mozambique: [35.0, -18.7],
}

// Region slug → centroid (fallback)
const REGION_COORDS: Record<string, [number, number]> = {
  middle_east: [42.0, 29.0], eastern_europe: [32.0, 49.0],
  south_asia: [74.0, 25.0], east_asia: [115.0, 35.0],
  sub_saharan_africa: [20.0, 5.0], north_africa: [20.0, 27.0],
  southeast_asia: [110.0, 5.0], central_asia: [63.0, 42.0],
  west_africa: [-5.0, 12.0], east_africa: [37.0, 2.0],
  southern_africa: [25.0, -20.0], latin_america: [-65.0, -10.0],
  north_america: [-95.0, 40.0], western_europe: [10.0, 50.0],
  caucasus: [44.0, 42.0], horn_of_africa: [42.0, 8.0],
  balkans: [21.0, 44.0], sahel: [5.0, 15.0],
  global: [20.0, 20.0],
}

// Stable hash jitter — same event always gets same offset (no pin jumping on refresh)
function stableJitter(id: string, range: number): [number, number] {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i)
    hash |= 0
  }
  const x = ((hash & 0xffff) / 0xffff - 0.5) * range
  const y = (((hash >> 16) & 0xffff) / 0xffff - 0.5) * range
  return [x, y]
}

function inferCoordinates(event: MapEventRow): [number, number] | null {
  const [jx, jy] = stableJitter(event.id, 0.8)
  const titleLower = (event.title ?? '').toLowerCase()

  // 1. City match in title (best precision)
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (titleLower.includes(city)) {
      return [
        Math.max(-179.5, Math.min(179.5, coords[0] + jx * 0.3)),
        Math.max(-85, Math.min(85, coords[1] + jy * 0.3)),
      ]
    }
  }

  // 2. Country match in title
  for (const [country, coords] of Object.entries(COUNTRY_COORDS)) {
    if (titleLower.includes(country)) {
      return [
        Math.max(-179.5, Math.min(179.5, coords[0] + jx)),
        Math.max(-85, Math.min(85, coords[1] + jy)),
      ]
    }
  }

  // 3. Region field → normalise to slug
  if (event.region) {
    const regionKey = event.region.trim().toLowerCase().replace(/[\s-]+/g, '_')
    const coords = REGION_COORDS[regionKey] ?? REGION_COORDS[regionKey.replace('_', '')]
    if (coords) {
      return [
        Math.max(-179.5, Math.min(179.5, coords[0] + jx * 2)),
        Math.max(-85, Math.min(85, coords[1] + jy * 2)),
      ]
    }
    // Try partial match against region coords
    for (const [key, c] of Object.entries(REGION_COORDS)) {
      if (regionKey.includes(key) || key.includes(regionKey)) {
        return [Math.max(-179.5, Math.min(179.5, c[0] + jx * 2)), Math.max(-85, Math.min(85, c[1] + jy * 2))]
      }
    }
  }

  return null
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '1000') || 1000, 2000)
  const hours = Math.max(Number(url.searchParams.get('hours') ?? '168') || 168, 1)
  const severity = url.searchParams.get('severity')
  const region = url.searchParams.get('region')
  const eventType = url.searchParams.get('type')
  const windowLabel = `${hours}h`
  const cacheKey = `map:events:${windowLabel}:sev${severity ?? 'all'}:reg${region ?? 'all'}:type${eventType ?? 'all'}`

  const cached = await getCachedSnapshot<object>(cacheKey)
  if (cached) return NextResponse.json(cached)

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  let query = createServiceClient()
    .from('events')
    .select('id, title, occurred_at, severity, event_type, region, source, source_id, significance_score, summary_short')
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: false })
    .limit(limit)

  // NOTE: intentionally NOT filtering .not('region', 'is', null)
  // Events without region can still be geocoded from title keywords
  if (severity) query = query.gte('severity', Number(severity))
  if (region) query = query.ilike('region', `%${region}%`)
  if (eventType) query = query.eq('event_type', eventType)

  const { data, error } = await query

  console.log(`[map/events] DB returned ${data?.length ?? 0} events, error: ${error?.message ?? 'none'}`)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const now = Date.now()
  const features: Array<GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties>> = []

  for (const event of (data ?? []) as MapEventRow[]) {
    const coords = inferCoordinates(event)
    if (!coords) continue

    const occurredTime = event.occurred_at ? new Date(event.occurred_at).getTime() : null
    const ageMin = occurredTime ? Math.max(0, Math.floor((now - occurredTime) / 60000)) : null

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: coords },
      properties: {
        id: event.id,
        title: event.title ?? 'Untitled event',
        occurred_at: event.occurred_at,
        severity: typeof event.severity === 'number' ? event.severity : 1,
        event_type: event.event_type ?? 'general',
        region: event.region,
        outlet_name: event.source,
        source_id: event.source_id,
        significance_score: event.significance_score,
        summary_short: event.summary_short,
        age_min: ageMin,
      },
    })
  }

  console.log(`[map/events] Geocoded ${features.length} of ${data?.length ?? 0} events`)

  const responseObject: GeoJSON.FeatureCollection<GeoJSON.Point, GeoJSON.GeoJsonProperties> = {
    type: 'FeatureCollection',
    features,
  }

  await setCachedSnapshot(cacheKey, responseObject, 120)
  return NextResponse.json(responseObject, { headers: { 'Cache-Control': 'no-store' } })
}
