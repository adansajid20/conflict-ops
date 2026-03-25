import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// API root — returns available endpoints and version info
export function GET() {
  return NextResponse.json({
    api: 'CONFLICT OPS',
    version: 'v1',
    documentation: 'https://conflictradar.co/api-docs',
    authentication: 'Bearer token — generate at /settings/api',
    rate_limit: '1,000 requests per hour (Business plan)',
    endpoints: [
      {
        path: '/api/public/v1/events',
        method: 'GET',
        description: 'Conflict events feed',
        params: ['limit (max 500)', 'offset', 'country (ISO 2-letter)', 'severity_gte (1-5)', 'since (ISO date)'],
        plan: 'Business+',
      },
    ],
    attribution: [
      'Active fire data courtesy of NASA FIRMS (firms.modaps.eosdis.nasa.gov)',
      'Vessel data via AISStream.io',
      'Flight data provided by The OpenSky Network (opensky-network.org)',
    ],
  })
}
