import { safeAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { stripe, PRICE_IDS } from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const CheckoutSchema = z.object({
  plan: z.enum(['individual', 'pro', 'business']),
  billing: z.enum(['monthly', 'annual']).default('monthly'),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
})

export async function POST(req: Request) {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = CheckoutSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

  const { plan, billing, successUrl, cancelUrl } = parsed.data
  const priceKey = `${plan}_${billing}` as keyof typeof PRICE_IDS
  const priceId = PRICE_IDS[priceKey]

  if (!priceId) {
    return NextResponse.json({ error: `Price not configured for ${priceKey}` }, { status: 500 })
  }

  const supabase = createServiceClient()
  const { data: user } = await supabase
    .from('users')
    .select('id, email, org_id, stripe_customer_id')
    .eq('clerk_user_id', userId)
    .single()

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Get or create Stripe customer
  let customerId = user.stripe_customer_id as string | null

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email as string,
      metadata: {
        clerk_user_id: userId,
        user_id: user.id as string,
        org_id: (user.org_id as string) ?? '',
      },
    })
    customerId = customer.id

    await supabase
      .from('users')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
  }

  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://conflictradar.co'

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl ?? `${appUrl}/settings/billing?upgraded=true`,
    cancel_url: cancelUrl ?? `${appUrl}/settings/billing?canceled=true`,
    metadata: {
      clerk_user_id: userId,
      user_id: user.id as string,
      org_id: (user.org_id as string) ?? '',
      plan,
      billing,
    },
    subscription_data: {
      metadata: {
        clerk_user_id: userId,
        org_id: (user.org_id as string) ?? '',
        plan,
      },
    },
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    tax_id_collection: { enabled: true },
  })

  return NextResponse.json({ url: session.url, sessionId: session.id })
}
