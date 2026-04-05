export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const sk = process.env.STRIPE_SECRET_KEY
  if (!sk) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })

  const { priceId, planId } = await req.json() as { priceId?: string; planId?: string }
  if (!priceId) return NextResponse.json({ error: 'priceId required' }, { status: 400 })

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://conflictradar.co'

  const body = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: `${base}/dashboard?upgrade=success&plan=${planId ?? ''}`,
    cancel_url: `${base}/pricing`,
    allow_promotion_codes: 'true',
    'subscription_data[trial_period_days]': '14',
  })

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sk}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  const data = await res.json() as { url?: string; error?: { message: string } }
  if (!res.ok) return NextResponse.json({ error: data.error?.message ?? 'Stripe error' }, { status: 500 })
  return NextResponse.json({ url: data.url })
}
