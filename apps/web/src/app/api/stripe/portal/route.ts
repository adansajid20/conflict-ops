export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { safeAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  void req
  const sk = process.env.STRIPE_SECRET_KEY
  if (!sk) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })

  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: user } = await supabase.from('users').select('email').eq('clerk_user_id', userId).single()

  // Look up stripe customer id from subscriptions table
  const { data: sub } = await supabase.from('subscriptions').select('stripe_customer_id').eq('email', user?.email ?? '').single()

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: 'No active subscription found. Subscribe from the pricing page.' }, { status: 404 })
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://conflictradar.co'

  const body = new URLSearchParams({
    customer: sub.stripe_customer_id,
    return_url: `${base}/settings/billing`,
  })

  const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sk}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  const data = await res.json() as { url?: string; error?: { message: string } }
  if (!res.ok) return NextResponse.json({ error: data.error?.message ?? 'Stripe error' }, { status: 500 })
  return NextResponse.json({ url: data.url })
}
