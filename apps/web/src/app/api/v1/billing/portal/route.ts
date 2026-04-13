import { safeAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST() {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: user } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('clerk_user_id', userId)
    .single()

  if (!user?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
  }

  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://conflictradar.co'

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id as string,
    return_url: `${appUrl}/settings/billing`,
  })

  return NextResponse.json({ url: session.url })
}
