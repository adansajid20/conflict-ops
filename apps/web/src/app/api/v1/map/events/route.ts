export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// ── Severity helpers ──────────────────────────────────────────────────────────
function sevToStr(n: number | null): string {
  switch (n) { case 4: return 'critical'; case 3: return 'high'; case 2: return 'medium'; default: return 'low' }
}
function sevStrToInt(s: string): number {
  switch (s) { case 'critical': return 4; case 'high': return 3; case 'medium': return 2; default: return 1 }
}
function windowToHours(w: string): number {
  switch (w) { case '24h': return 24; case '72h': return 72; case '7d': return 168; case '30d': return 720; default: return 168 }
}

// ── COUNTRY SPREAD POINTS ─────────────────────────────────────────────────────
// Multiple points per country — events hash-distribute across them, not all pile up on one centroid
const COUNTRY_SPREADS: Record<string, [number, number][]> = {
  ukraine:  [[50.45,30.52],[49.99,36.23],[46.47,30.73],[47.10,37.55],[48.60,38.00],[47.84,35.14],[48.57,39.31],[46.64,32.62],[48.02,37.80],[50.90,34.80]],
  russia:   [[55.76,37.62],[59.93,30.32],[56.84,60.60],[55.03,82.92],[43.12,131.87],[48.71,44.51],[50.60,36.59],[52.97,36.06],[47.22,39.72],[61.00,69.00]],
  china:    [[39.90,116.40],[31.23,121.47],[22.54,114.06],[30.57,104.07],[23.13,113.26],[34.26,108.94],[36.07,120.38],[25.04,102.68],[28.23,112.94],[26.08,119.30]],
  iran:     [[35.69,51.39],[32.65,51.68],[38.08,46.29],[29.59,52.58],[37.28,49.58],[33.51,48.35],[36.57,53.06],[30.28,48.22],[31.90,54.37],[27.18,56.27]],
  iraq:     [[33.31,44.37],[36.19,44.01],[36.34,43.12],[30.51,47.78],[35.47,44.39],[32.62,44.02],[34.93,45.68],[33.34,43.72],[35.11,42.45],[36.86,42.95]],
  syria:    [[33.51,36.29],[36.20,37.15],[35.93,36.63],[34.73,36.72],[34.44,35.82],[32.63,36.10],[35.33,40.14],[36.35,36.59],[35.53,35.78]],
  israel:   [[31.77,35.23],[32.09,34.78],[32.79,34.99],[31.25,34.79],[31.05,34.85],[32.32,34.85]],
  palestine:[[31.95,35.23],[31.50,34.47],[31.30,34.25],[31.35,34.31],[31.90,35.20],[32.22,35.25]],
  gaza:     [[31.50,34.47],[31.30,34.25],[31.35,34.31],[31.42,34.38],[31.52,34.45],[31.28,34.30]],
  yemen:    [[15.37,44.19],[12.79,45.04],[14.80,42.95],[15.46,45.33],[13.58,44.02],[14.54,49.12],[16.94,43.96]],
  libya:    [[32.90,13.18],[32.12,20.09],[32.38,15.09],[31.21,16.59],[27.05,14.43],[26.59,18.73]],
  sudan:    [[15.59,32.53],[19.62,37.22],[13.19,30.22],[11.76,34.39],[12.05,24.89],[13.63,25.35]],
  ethiopia: [[9.02,38.75],[7.05,38.48],[13.50,39.47],[9.31,42.12],[11.59,37.39],[6.00,37.75]],
  somalia:  [[2.05,45.32],[10.44,45.04],[9.56,44.06],[0.35,42.54],[3.12,43.65]],
  afghanistan:[[34.53,69.17],[31.63,65.71],[36.71,67.11],[32.36,62.20],[33.60,68.42]],
  pakistan: [[33.69,73.04],[24.86,67.01],[31.55,74.35],[30.20,71.47],[34.01,71.58]],
  lebanon:  [[33.89,35.50],[34.44,35.82],[33.27,35.20],[34.43,35.84]],
  turkey:   [[39.93,32.86],[41.01,28.98],[38.42,27.14],[37.00,35.32],[39.77,30.52],[40.18,29.07]],
  egypt:    [[30.04,31.24],[31.21,29.92],[27.18,31.17],[30.06,32.27],[31.42,31.81]],
  'saudi arabia': [[24.71,46.68],[21.49,39.19],[26.43,50.10],[21.42,39.83],[24.47,39.61]],
  india:    [[28.61,77.21],[19.08,72.88],[13.08,80.27],[22.57,88.36],[12.97,77.59],[17.39,78.49]],
  myanmar:  [[19.76,96.13],[16.87,96.20],[21.97,96.08],[25.38,97.00]],
  nigeria:  [[9.06,7.49],[6.52,3.38],[11.99,8.52],[12.00,8.52],[7.38,3.94]],
  mali:     [[12.64,-8.00],[16.77,-3.01],[14.49,-4.20],[15.04,1.50]],
  niger:    [[13.51,2.13],[13.11,3.21],[14.22,7.63],[11.88,13.24]],
  drc:      [[-4.44,15.27],[-1.68,29.23],[-11.66,27.48],[-2.50,28.86]],
  'democratic republic of congo': [[-4.44,15.27],[-1.68,29.23],[-2.50,28.86]],
  'north korea': [[39.02,125.75],[39.92,127.54],[38.75,125.38],[41.10,129.04]],
  'south korea': [[37.57,127.00],[35.18,129.08],[35.87,128.60],[35.10,126.88]],
  taiwan:   [[25.03,121.57],[22.63,120.30],[24.15,120.67],[23.00,120.21]],
  philippines: [[14.60,120.98],[10.31,123.89],[7.07,125.61],[16.41,120.60]],
  colombia: [[4.71,-74.07],[6.25,-75.56],[3.45,-76.53],[10.39,-75.51]],
  venezuela:[[10.48,-66.90],[10.07,-69.32],[8.62,-71.15]],
  mexico:   [[19.43,-99.13],[20.67,-103.35],[25.69,-100.31],[32.53,-117.03]],
  brazil:   [[-15.78,-47.93],[-23.55,-46.63],[-22.91,-43.17],[-12.97,-38.51]],
  'united states': [[38.91,-77.04],[40.71,-74.01],[34.05,-118.24],[41.88,-87.63],[29.76,-95.37],[33.75,-84.39]],
  usa:      [[38.91,-77.04],[40.71,-74.01],[34.05,-118.24],[41.88,-87.63]],
  'united kingdom': [[51.51,-0.13],[53.48,-2.24],[55.95,-3.19],[52.49,-1.89]],
  uk:       [[51.51,-0.13],[53.48,-2.24],[55.95,-3.19]],
  france:   [[48.86,2.35],[43.30,5.37],[45.76,4.84],[43.61,1.44]],
  germany:  [[52.52,13.41],[48.14,11.58],[53.55,9.99],[50.94,6.96]],
  poland:   [[52.23,21.01],[51.76,19.46],[50.06,19.94],[54.35,18.65]],
  // Regions
  middle_east: [[32.00,44.00],[28.00,52.00],[35.00,36.00],[25.00,57.00],[29.00,35.00],[33.00,40.00]],
  eastern_europe: [[50.00,30.00],[52.00,21.00],[45.00,28.00],[48.00,18.00],[53.00,23.00]],
  sub_saharan_africa: [[6.00,3.00],[9.00,38.00],[-4.00,15.00],[12.00,8.00],[14.00,25.00]],
  north_africa: [[30.00,31.00],[32.00,13.00],[36.00,3.00],[27.00,17.00]],
  south_asia: [[28.00,77.00],[24.00,67.00],[13.00,80.00],[23.00,88.00]],
  southeast_asia: [[13.75,100.50],[14.60,120.98],[3.14,101.69],[10.82,106.66]],
  east_asia: [[39.90,116.40],[37.57,127.00],[35.68,139.69],[25.03,121.57]],
  central_asia: [[41.30,69.30],[43.00,76.00],[38.00,58.00],[48.00,66.00]],
  caucasus: [[41.72,44.79],[40.41,49.87],[40.18,44.51],[42.87,74.59]],
  sahel: [[12.37,-1.52],[13.51,2.13],[14.00,7.00],[12.64,-8.00]],
  horn_of_africa: [[9.02,38.75],[2.05,45.32],[15.37,44.19],[9.56,44.06]],
  balkans: [[44.80,20.47],[42.66,21.17],[43.86,18.41],[45.81,15.98]],
}

// ── CITY COORDINATES ─────────────────────────────────────────────────────────
const CITY_COORDS: Record<string, [number, number]> = {
  kyiv:[50.45,30.52], kharkiv:[49.99,36.23], odesa:[46.47,30.73], odessa:[46.47,30.73],
  mariupol:[47.10,37.55], kherson:[46.64,32.62], zaporizhzhia:[47.84,35.14],
  donetsk:[48.02,37.80], luhansk:[48.57,39.31], bakhmut:[48.60,38.00],
  crimea:[44.95,34.10], sevastopol:[44.62,33.53], moscow:[55.76,37.62],
  belgorod:[50.60,36.59], kursk:[51.73,36.19],
  jerusalem:[31.77,35.23], 'tel aviv':[32.09,34.78], 'gaza city':[31.50,34.47],
  gaza:[31.42,34.38], rafah:[31.30,34.25], 'khan younis':[31.35,34.31],
  ramallah:[31.90,35.20], haifa:[32.79,34.99],
  beirut:[33.89,35.50], damascus:[33.51,36.29], aleppo:[36.20,37.15],
  idlib:[35.93,36.63], homs:[34.73,36.72],
  baghdad:[33.31,44.37], erbil:[36.19,44.01], mosul:[36.34,43.12],
  basra:[30.51,47.78], kirkuk:[35.47,44.39],
  tehran:[35.69,51.39], isfahan:[32.65,51.68], tabriz:[38.08,46.29], natanz:[33.51,51.92],
  sanaa:[15.37,44.19], aden:[12.79,45.04], hodeidah:[14.80,42.95], marib:[15.46,45.33],
  riyadh:[24.71,46.68], jeddah:[21.49,39.19],
  tripoli:[32.90,13.18], benghazi:[32.12,20.09],
  khartoum:[15.59,32.53], 'port sudan':[19.62,37.22], omdurman:[15.64,32.48],
  mogadishu:[2.05,45.32], hargeisa:[9.56,44.06],
  kabul:[34.53,69.17], kandahar:[31.63,65.71], herat:[34.34,62.20],
  islamabad:[33.69,73.04], karachi:[24.86,67.01], lahore:[31.55,74.35], peshawar:[34.01,71.58],
  cairo:[30.04,31.24], alexandria:[31.21,29.92],
  ankara:[39.93,32.86], istanbul:[41.01,28.98],
  beijing:[39.90,116.40], shanghai:[31.23,121.47], taipei:[25.03,121.57], 'hong kong':[22.32,114.17],
  tokyo:[35.68,139.69], seoul:[37.57,127.00], pyongyang:[39.02,125.75],
  'new delhi':[28.61,77.21], mumbai:[19.08,72.88], delhi:[28.70,77.10],
  yangon:[16.87,96.20], naypyidaw:[19.76,96.13],
  'addis ababa':[9.02,38.75], nairobi:[-1.29,36.82], abuja:[9.06,7.49], lagos:[6.52,3.38],
  bamako:[12.64,-8.00], niamey:[13.51,2.13], ouagadougou:[12.37,-1.52],
  kinshasa:[-4.44,15.27], goma:[-1.68,29.23], maputo:[-25.97,32.57],
  washington:[38.91,-77.04], 'new york':[40.71,-74.01], pentagon:[38.87,-77.06],
  london:[51.51,-0.13], paris:[48.86,2.35], berlin:[52.52,13.41],
  brussels:[50.85,4.35], warsaw:[52.23,21.01], bucharest:[44.43,26.10],
  tbilisi:[41.72,44.79], yerevan:[40.18,44.51], baku:[40.41,49.87], minsk:[53.90,27.57],
  belgrade:[44.79,20.47], pristina:[42.66,21.17], sarajevo:[43.86,18.41],
  singapore:[1.35,103.82], manila:[14.60,120.98], bangkok:[13.75,100.50], hanoi:[21.03,105.85],
  bogota:[4.71,-74.07], caracas:[10.48,-66.90], 'mexico city':[19.43,-99.13],
}

// ── GEOCODER ──────────────────────────────────────────────────────────────────
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0 }
  return Math.abs(h)
}

function jitter(h: number, range: number): [number, number] {
  return [((h & 0xffff) / 0xffff - 0.5) * range, (((h >> 16) & 0xffff) / 0xffff - 0.5) * range]
}

function geocode(id: string, region: string | null, title: string | null): [number, number] | null {
  const h = hashStr(id)
  const t = (title ?? '').toLowerCase()

  // 1. City in title (highest precision)
  for (const [city, [lat, lon]] of Object.entries(CITY_COORDS)) {
    if (city.length < 3) continue
    const re = new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    if (re.test(t)) {
      const [jl, jn] = jitter(h, 0.6)
      return [lat + jl, lon + jn]
    }
  }

  // 2. region field → spread points
  if (region) {
    const rk = region.toLowerCase().replace(/ /g, '_').trim()
    const pts = COUNTRY_SPREADS[rk] ?? COUNTRY_SPREADS[region.toLowerCase().trim()]
    if (pts?.length) {
      const pt = pts[h % pts.length]!
      const [jl, jn] = jitter(h, 1.2)
      return [pt[0] + jl, pt[1] + jn]
    }
    const city = CITY_COORDS[region.toLowerCase().trim()]
    if (city) {
      const [jl, jn] = jitter(h, 0.5)
      return [city[0] + jl, city[1] + jn]
    }
  }

  // 3. Country names in title (4+ chars to avoid false positives)
  for (const [country, pts] of Object.entries(COUNTRY_SPREADS)) {
    if (country.length < 4) continue
    const re = new RegExp(`\\b${country.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    if (re.test(t)) {
      const pt = pts[h % pts.length]!
      const [jl, jn] = jitter(h, 1.5)
      return [pt[0] + jl, pt[1] + jn]
    }
  }

  return null
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  // Support both ?window=7d and legacy ?hours=168
  const windowParam = url.searchParams.get('window')
  const hoursParam = url.searchParams.get('hours')
  const window = windowParam ?? '7d'
  const severityStr = url.searchParams.get('severity') ?? 'all'
  const regionFilter = url.searchParams.get('region') ?? ''

  let hours: number
  if (hoursParam) {
    hours = parseInt(hoursParam, 10) || 168
  } else {
    hours = windowToHours(window)
  }
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  let query = createServiceClient()
    .from('events')
    .select('id, title, occurred_at, severity, event_type, region, source, source_id, summary_short, significance_score, is_breaking')
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: false })
    .limit(3000)

  if (severityStr === 'critical') query = query.eq('severity', 4)
  else if (severityStr === 'high') query = query.gte('severity', 3)
  else if (severityStr === 'medium') query = query.gte('severity', 2)

  if (regionFilter) {
    query = query.or(`region.ilike.%${regionFilter}%,title.ilike.%${regionFilter}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const now = Date.now()
  const counts = { critical: 0, high: 0, medium: 0, low: 0 }
  const features: GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties>[] = []

  for (const event of (data ?? [])) {
    const coords = geocode(event.id, event.region, event.title)
    if (!coords) continue

    const sevStr = sevToStr(event.severity)
    counts[sevStr as keyof typeof counts]++

    const isBreaking = event.is_breaking === true ||
      (event.occurred_at != null && now - new Date(event.occurred_at).getTime() < 30 * 60 * 1000)

    const SEVERITY_COLORS: Record<string, string> = {
      critical: '#ff2d2d', high: '#ff8c00', medium: '#ffd700', low: '#4a9eff',
    }
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [coords[1], coords[0]] }, // [lon, lat]
      properties: {
        id: event.id,
        title: event.title ?? 'Untitled',
        severity: sevStr,
        severityNum: sevStrToInt(sevStr),   // needed by MapLibre paint expressions
        severityInt: sevStrToInt(sevStr),
        color: SEVERITY_COLORS[sevStr] ?? '#4a9eff',  // pre-computed color for paint
        event_type: event.event_type ?? 'general',
        category: event.event_type ?? 'general',
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
