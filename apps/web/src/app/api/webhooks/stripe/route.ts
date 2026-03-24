import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@conflict-ops/shared'

const stripe = new Stripe(process.env['STRIPE_SECRET_KEY']!, {
  apiVersion: '2024-04-10',
})

type PlanId = 'individual' | 'pro' | 'business' | 'enterprise'

const PRICE_TO_PLAN: Record<string, PlanId> = {
  [process.env['STRIPE_PRICE_INDIVIDUAL'] ?? '']: 'individual',
  [process.env['STRIPE_PRICE_PRO'] ?? '']: 'pro',
  [process.env['STRIPE_PRICE_BUSINESS'] ?? '']: 'business',
  [process.env['STRIPE_PRICE_ENTERPRISE'] ?? '']: 'enterprise',
}

function getPlanFromSubscription(subscription: Stripe.Subscription): PlanId {
  const priceId = subscription.items.data[0]?.price.id ?? ''
  return PRICE_TO_PLAN[priceId] ?? 'individual'
}

export async function POST(req: Request): Promise<NextResponse<ApiResponse>> {
  const body = await req.text()
  const sig = headers().get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ success: false, error: 'Missing stripe-signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env['STRIPE_WEBHOOK_SECRET']!)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook verification failed'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }

  // Return 200 immediately — process async
  processWebhookEvent(event).catch((err: unknown) => {
    console.error('[stripe-webhook] processing error:', err)
  })

  return NextResponse.json({ success: true })
}

async function processWebhookEvent(event: Stripe.Event): Promise<void> {
  const supabase = createServiceClient()

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const planId = getPlanFromSubscription(subscription)

      // CRITICAL: upsert org — may not exist yet (race condition fix)
      await supabase.from('organizations').upsert(
        {
          stripe_customer_id: subscription.customer as string,
          stripe_subscription_id: subscription.id,
          plan_id: planId,
          subscription_status: subscription.status,
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'stripe_customer_id', ignoreDuplicates: false }
      )
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription

      await supabase
        .from('organizations')
        .update({
          plan_id: 'individual',
          subscription_status: 'canceled',
          stripe_subscription_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', subscription.customer as string)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice

      await supabase
        .from('organizations')
        .update({
          subscription_status: 'past_due',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', invoice.customer as string)
      break
    }

    default:
      // Unhandled event type — ignore
      break
  }
}
