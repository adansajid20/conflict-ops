export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Severity integer (1-4) → string
function sevToStr(n: number | null): string {
  switch (n) {
    case 4: return 'critical'
    case 3: return 'high'
    case 2: return 'medium'
    case 1: return 'low'
    default: return 'low'
  }
}

// String severity filter → minimum integer
function sevFilterToMin(s: string): number | null {
  switch (s) {
    case 'critical': return 4
    case 'high': return 3
    case 'medium': return 2
    case 'low': return 1
    default: return null
  }
}

// Window string → hours
function windowToHours(w: string): number {
  switch (w.toLowerCase()) {
    case '24h': return 24
    case '72h': return 72
    case '7d': return 168
    case '30d': return 720
    default: {
      const h = parseInt(w, 10)
      return Number.isFinite(h) && h > 0 ? h : 168
    }
  }
}

// ── REGION CENTROIDS ─────────────────────────────────────────────────────────
const REGION_CENTROIDS: Record<string, [number, number]> = {
  'middle east': [42.0, 29.0],
  'eastern europe': [28.0, 49.0],
  'western europe': [5.0, 48.0],
  'north america': [-95.0, 40.0],
  'latin america': [-70.0, -15.0],
  'south america': [-60.0, -20.0],
  'central america': [-85.0, 13.0],
  'south asia': [78.0, 20.0],
  'southeast asia': [110.0, 5.0],
  'east asia': [115.0, 35.0],
  'sub saharan africa': [20.0, 0.0],
  'sub_saharan_africa': [20.0, 0.0],
  'north africa': [15.0, 27.0],
  'west africa': [-5.0, 12.0],
  'east africa': [37.0, 0.0],
  'central africa': [20.0, 0.0],
  'southern africa': [25.0, -20.0],
  'horn of africa': [43.0, 8.0],
  'sahel': [5.0, 14.0],
  'caucasus': [43.0, 42.0],
  'central asia': [63.0, 42.0],
  'balkans': [20.0, 44.0],
  'asia pacific': [130.0, 15.0],
  'indo pacific': [130.0, 15.0],
  'south china sea': [114.0, 12.0],
  'east china sea': [123.0, 28.0],
  'korean peninsula': [127.5, 37.5],
  'taiwan strait': [120.5, 24.5],
  'caribbean': [-70.0, 18.0],
  'persian gulf': [52.0, 27.0],
  'red sea': [40.0, 16.0],
  'black sea': [35.0, 43.0],
  'baltic': [20.0, 57.0],
  'arctic': [30.0, 70.0],
  'global': [0.0, 20.0],
  'international': [0.0, 20.0],
  'europe': [10.0, 50.0],
  'africa': [20.0, 5.0],
  'asia': [100.0, 30.0],
  // Countries
  'ukraine': [31.2, 48.4], 'russia': [60.0, 60.0],
  'israel': [34.9, 31.5], 'palestine': [35.2, 31.9],
  'iran': [53.7, 32.4], 'iraq': [44.4, 33.2],
  'syria': [38.5, 35.0], 'lebanon': [35.9, 33.9],
  'yemen': [47.5, 15.5], 'afghanistan': [67.7, 33.9],
  'pakistan': [69.3, 30.4], 'india': [78.9, 20.6],
  'china': [104.2, 35.9], 'taiwan': [120.9, 23.7],
  'north korea': [127.5, 40.3], 'south korea': [127.8, 36.6],
  'myanmar': [96.0, 19.7], 'turkey': [35.2, 39.0],
  'sudan': [30.2, 15.5], 'ethiopia': [40.5, 9.1],
  'somalia': [45.3, 5.2], 'nigeria': [8.7, 9.1],
  'mali': [-2.0, 17.6], 'niger': [8.0, 17.0],
  'libya': [17.2, 26.3], 'egypt': [30.8, 26.8],
  'venezuela': [-66.6, 8.0], 'haiti': [-72.3, 18.9],
  'colombia': [-74.3, 4.6], 'mexico': [-102.5, 23.6],
  'united states': [-95.7, 37.1], 'usa': [-95.7, 37.1],
  'georgia': [43.4, 42.3], 'azerbaijan': [49.9, 40.4],
  'armenia': [44.5, 40.2], 'israel/palestine': [35.2, 31.8],
  'drc': [21.8, -4.0], 'congo': [15.3, -4.3],
  'mozambique': [35.5, -18.7], 'eritrea': [39.8, 15.2],
}

// ── CITY COORDINATES ─────────────────────────────────────────────────────────
const CITY_COORDS: Record<string, [number, number]> = {
  kyiv: [30.52, 50.45], kiev: [30.52, 50.45],
  kharkiv: [36.23, 49.99], kherson: [32.61, 46.64],
  mariupol: [37.54, 47.09], zaporizhzhia: [35.14, 47.84],
  odesa: [30.72, 46.48], odessa: [30.72, 46.48],
  donetsk: [37.80, 48.00], luhansk: [39.30, 48.57],
  bakhmut: [37.99, 48.59], avdiivka: [37.75, 48.14],
  moscow: [37.62, 55.75], belgorod: [36.59, 50.60],
  kursk: [36.19, 51.73], bryansk: [34.36, 53.24],
  'st petersburg': [30.32, 59.93],
  gaza: [34.46, 31.50], 'gaza city': [34.46, 31.50],
  rafah: [34.24, 31.28], 'khan younis': [34.31, 31.34],
  jabalia: [34.49, 31.53],
  'tel aviv': [34.78, 32.08], jerusalem: [35.22, 31.77],
  haifa: [34.99, 32.82], beirut: [35.50, 33.89],
  damascus: [36.29, 33.51], aleppo: [37.16, 36.20],
  idlib: [36.63, 35.93], homs: [36.72, 34.73],
  baghdad: [44.38, 33.34], mosul: [43.13, 36.34],
  basra: [47.78, 30.51], erbil: [44.01, 36.19],
  tehran: [51.39, 35.69], isfahan: [51.67, 32.66],
  sanaa: [44.20, 15.35], aden: [45.04, 12.78],
  hodeidah: [42.95, 14.80],
  riyadh: [46.68, 24.69], jeddah: [39.19, 21.54],
  kabul: [69.17, 34.52], kandahar: [65.71, 31.61],
  islamabad: [73.05, 33.72], karachi: [67.01, 24.86],
  lahore: [74.34, 31.55], peshawar: [71.57, 34.01],
  mumbai: [72.88, 19.08], 'new delhi': [77.21, 28.63],
  delhi: [77.10, 28.70],
  beijing: [116.40, 39.91], shanghai: [121.47, 31.23],
  taipei: [121.56, 25.04], 'hong kong': [114.17, 22.32],
  pyongyang: [125.73, 39.02], seoul: [126.97, 37.57],
  tokyo: [139.69, 35.69],
  yangon: [96.15, 16.87], naypyidaw: [96.12, 19.75],
  manila: [120.98, 14.60], jakarta: [106.84, -6.21],
  'kuala lumpur': [101.69, 3.14], bangkok: [100.52, 13.75],
  hanoi: [105.85, 21.03],
  khartoum: [32.53, 15.55], 'port sudan': [37.21, 19.61],
  'el fasher': [25.35, 13.63],
  mogadishu: [45.34, 2.05], 'addis ababa': [38.75, 9.03],
  mekelle: [39.47, 13.50], nairobi: [36.82, -1.29],
  kinshasa: [15.32, -4.32], goma: [29.22, -1.67],
  bamako: [-7.99, 12.65], ouagadougou: [-1.52, 12.37],
  niamey: [2.11, 13.51], abuja: [7.49, 9.06],
  lagos: [3.38, 6.46], maiduguri: [13.16, 11.83],
  tripoli: [13.18, 32.89], benghazi: [20.07, 32.12],
  cairo: [31.24, 30.04],
  london: [-0.12, 51.51], paris: [2.35, 48.85],
  berlin: [13.40, 52.52], brussels: [4.36, 50.85],
  warsaw: [21.01, 52.23],
  belgrade: [20.46, 44.80], bucharest: [26.10, 44.44],
  istanbul: [28.95, 41.01], ankara: [32.86, 39.93],
  tbilisi: [44.80, 41.69], baku: [49.87, 40.41],
  yerevan: [44.51, 40.18], minsk: [27.56, 53.90],
  washington: [-77.04, 38.91], 'new york': [-74.01, 40.71],
  caracas: [-66.90, 10.49], bogota: [-74.08, 4.71],
  havana: [-82.38, 23.14], 'mexico city': [-99.13, 19.43],
}

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim()
}

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

function geocodeEvent(
  id: string,
  region: string | null,
  title: string | null,
): [number, number] | null {
  const [jx, jy] = stableJitter(id, 2.5)
  function applyJitter(coords: [number, number], scale = 1): [number, number] {
    return [
      Math.max(-179.5, Math.min(179.5, coords[0] + jx * scale)),
      Math.max(-85, Math.min(85, coords[1] + jy * scale)),
    ]
  }

  // Step 1: region field
  if (region) {
    const key = normalizeKey(region)
    if (REGION_CENTROIDS[key]) return applyJitter(REGION_CENTROIDS[key], 0.8)
    for (const [rk, coords] of Object.entries(REGION_CENTROIDS)) {
      if (key.includes(rk) || rk.includes(key)) return applyJitter(coords, 0.8)
    }
    for (const [city, coords] of Object.entries(CITY_COORDS)) {
      if (key.includes(city)) return applyJitter(coords, 0.3)
    }
  }

  // Step 2: city names in title
  const titleLower = (title ?? '').toLowerCase()
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    const regex = new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    if (regex.test(titleLower)) return applyJitter(coords, 0.3)
  }

  return null
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const window = url.searchParams.get('window') ?? '7d'
  const severityStr = url.searchParams.get('severity') ?? 'all'

  const hours = windowToHours(window)
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
  const sevMin = severityStr !== 'all' ? sevFilterToMin(severityStr) : null

  let query = createServiceClient()
    .from('events')
    .select('id, title, occurred_at, severity, event_type, region, source, source_id, summary_short, significance_score, is_breaking')
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: false })
    .limit(2000)

  if (sevMin !== null) {
    // 'critical' only → eq 4; 'high+' → gte 3; 'medium+' → gte 2
    if (severityStr === 'critical') {
      query = query.eq('severity', 4)
    } else {
      query = query.gte('severity', sevMin)
    }
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const now = Date.now()
  const counts = { critical: 0, high: 0, medium: 0, low: 0 }
  const features: GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties>[] = []

  for (const event of (data ?? [])) {
    const coords = geocodeEvent(event.id, event.region, event.title)
    if (!coords) continue

    const sevStr = sevToStr(event.severity)
    counts[sevStr as keyof typeof counts]++

    const breakingCutoff = 30 * 60 * 1000 // 30 min
    const isBreaking = event.is_breaking === true ||
      (event.occurred_at != null && now - new Date(event.occurred_at).getTime() < breakingCutoff)

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: coords },
      properties: {
        id: event.id,
        title: event.title ?? 'Untitled',
        severity: sevStr,
        severityInt: event.severity ?? 1,
        event_type: event.event_type ?? 'general',
        region: event.region,
        source: event.source,
        sourceUrl: event.source_id,
        summary: event.summary_short ?? '',
        publishedAt: event.occurred_at,
        isBreaking,
        significance: event.significance_score ?? 0,
      },
    })
  }

  return NextResponse.json({
    type: 'FeatureCollection',
    features,
    meta: {
      total: features.length,
      ...counts,
      timeWindow: window,
      severityFilter: severityStr,
      generatedAt: new Date().toISOString(),
    },
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  })
}
