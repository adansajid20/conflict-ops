export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { detectConflictPhase } from '@/lib/intelligence/conflict-phases'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const countryCode = searchParams.get('country_code')

    // country_code is required
    if (!countryCode) {
      return NextResponse.json(
        {
          success: false,
          error: 'country_code query parameter is required',
        },
        { status: 400 }
      )
    }

    const assessment = await detectConflictPhase(countryCode)

    return NextResponse.json(
      {
        success: true,
        data: assessment,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
        },
      }
    )
  } catch (error) {
    console.error('[conflict-phases] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to detect conflict phase',
      },
      { status: 500 }
    )
  }
}
