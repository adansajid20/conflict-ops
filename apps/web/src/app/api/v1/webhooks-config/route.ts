/**
 * Webhook Configuration API — Business plan
 * Allows orgs to register webhook endpoints for real-time event delivery
 *
 * Supported events:
 * - alert.created
 * - event.high_severity (severity >= 4)
 * - escalation.changed
 * - vessel.dark
 * - aircraft.emergency
 */

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgPlanLimits } from '@/lib/plan-limits'
import { z } from 'zod'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

const SUPPORTED_EVENTS = [
  'alert.created',
  'event.high_severity',
  'escalation.changed',
  'vessel.dark',
  'aircraft.emergency',
  'forecast.updated',
] as const

const CreateWebhookSchema = z.object({
  url: z.string().url(),
  event_types: z.array(z.enum(SUPPORTED_EVENTS)).min(1),
  description: z.string().max(200).optional(),
})

async function getUser(clerkId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase.from('users').select('id,org_id').eq('clerk_user_id', clerkId).single()
  return data
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await getUser(userId)
  if (!user?.org_id) return NextResponse.json({ error: 'No org' }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('webhooks')
    .select('id,url,event_types,active,description,created_at,last_triggered,failure_count')
    .eq('org_id', user.org_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: data ?? [] })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await getUser(userId)
  if (!user?.org_id) return NextResponse.json({ error: 'No org' }, { status: 400 })

  // Plan check — webhooks = Business only
  const limits = await getOrgPlanLimits(user.org_id)
  if (!limits.webhooks) {
    return NextResponse.json(
      { error: 'Webhooks require Business plan or higher.' },
      { status: 403 }
    )
  }

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = CreateWebhookSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

  // Generate signing secret for this webhook
  const signingSecret = `whsec_${crypto.randomBytes(32).toString('hex')}`

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('webhooks')
    .insert({
      org_id: user.org_id,
      url: parsed.data.url,
      event_types: parsed.data.event_types,
      description: parsed.data.description ?? null,
      secret: signingSecret,
      active: true,
      failure_count: 0,
    })
    .select('id,url,event_types,active,description,created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return signing secret ONCE — never shown again
  return NextResponse.json({
    success: true,
    data: { ...data, signing_secret: signingSecret },
    message: 'Store the signing_secret securely — it will not be shown again.',
  }, { status: 201 })
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await getUser(userId)
  if (!user?.org_id) return NextResponse.json({ error: 'No org' }, { status: 400 })

  const url = new URL(req.url)
  const webhookId = url.searchParams.get('id')
  if (!webhookId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = createServiceClient()
  await supabase.from('webhooks').delete().eq('id', webhookId).eq('org_id', user.org_id)

  return NextResponse.json({ success: true, data: null })
}
