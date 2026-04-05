export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const PLAN_MAP: Record<string, string> = {
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_INDIVIDUAL ?? 'price_individual']: 'individual',
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? 'price_pro']: 'pro',
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS ?? 'price_business']: 'business',
}

async function verifySignature(body: string, sig: string, secret: string): Promise<boolean> {
  const ts = sig.split(',').find(p => p.startsWith('t='))?.slice(2) ?? ''
  const v1 = sig.split(',').find(p => p.startsWith('v1='))?.slice(3) ?? ''
  const payload = `${ts}.${body}`
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const computed = Buffer.from(mac).toString('hex')
  return computed === v1
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })

  const body = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''

  const valid = await verifySignature(body, sig, secret)
  if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })

  const event = JSON.parse(body) as { type: string; data: { object: Record<string, unknown> } }
  const supabase = createServiceClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const customerId = session.customer as string
    const subscriptionId = session.subscription as string
    const customerEmail = (session.customer_details as Record<string, unknown>)?.email as string | undefined

    if (subscriptionId) {
      // Fetch subscription to get price
      const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
      })
      const sub = await res.json() as { items?: { data?: Array<{ price?: { id: string } }> } }
      const priceId = sub.items?.data?.[0]?.price?.id ?? ''
      const planId = PLAN_MAP[priceId] ?? 'individual'

      await supabase.from('subscriptions').upsert({
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        email: customerEmail ?? null,
        plan_id: planId,
        status: 'active',
        trial_end: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'stripe_customer_id' })
    }
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const sub = event.data.object
    await supabase.from('subscriptions').update({
      status: sub.status as string,
      updated_at: new Date().toISOString(),
    }).eq('stripe_subscription_id', sub.id as string)
  }

  return NextResponse.json({ received: true })
}
