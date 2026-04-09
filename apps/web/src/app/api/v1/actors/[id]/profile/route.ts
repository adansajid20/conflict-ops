export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getActorProfile, enrichActorProfile } from '@/lib/intelligence/actor-network'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'actor id required' },
        { status: 400 }
      )
    }

    const profile = await getActorProfile(id)

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'actor not found or no events in last 90 days' },
        { status: 404 }
      )
    }

    // Enrich with connected actors
    const enrichedProfile = await enrichActorProfile(profile)

    return NextResponse.json({
      success: true,
      data: enrichedProfile,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[actor-profile] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
