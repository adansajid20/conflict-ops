export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { buildActorNetwork } from '@/lib/intelligence/actor-network'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const countryCode = url.searchParams.get('country_code') ?? undefined

    if (countryCode && countryCode.length !== 2) {
      return NextResponse.json(
        { success: false, error: 'country_code must be a 2-letter ISO code' },
        { status: 400 }
      )
    }

    const network = await buildActorNetwork(countryCode?.toUpperCase())

    return NextResponse.json({
      success: true,
      data: network,
    })
  } catch (error) {
    console.error('[actor-network] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
