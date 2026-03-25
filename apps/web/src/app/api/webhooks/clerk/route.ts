import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { createServiceClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@conflict-ops/shared'

interface ClerkOrgEvent {
  type: string
  data: {
    id: string
    name: string
    created_at: number
    updated_at: number
  }
}

interface ClerkUserEvent {
  type: string
  data: {
    id: string
    email_addresses: Array<{ email_address: string }>
    first_name: string | null
    last_name: string | null
  }
}

interface ClerkMembershipEvent {
  type: string
  data: {
    id: string
    organization: { id: string }
    public_user_data: { user_id: string }
    role: string
  }
}

type ClerkEvent = ClerkOrgEvent | ClerkUserEvent | ClerkMembershipEvent

export async function POST(req: Request): Promise<NextResponse<ApiResponse>> {
  const body = await req.text()
  const headersList = headers()
  const svixId = headersList.get('svix-id')
  const svixTimestamp = headersList.get('svix-timestamp')
  const svixSignature = headersList.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ success: false, error: 'Missing svix headers' }, { status: 400 })
  }

  let event: ClerkEvent
  try {
    const wh = new Webhook(process.env['CLERK_WEBHOOK_SECRET']!)
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkEvent
  } catch {
    return NextResponse.json({ success: false, error: 'Webhook verification failed' }, { status: 400 })
  }

  processClerkEvent(event).catch((err: unknown) => {
    console.error('[clerk-webhook] processing error:', err)
  })

  return NextResponse.json({ success: true })
}

async function processClerkEvent(event: ClerkEvent): Promise<void> {
  const supabase = createServiceClient()

  switch (event.type) {
    case 'organization.created': {
      const data = (event as ClerkOrgEvent).data
      await supabase.from('orgs').upsert(
        {
          clerk_org_id: data.id,
          name: data.name,
          plan_id: 'individual',
          subscription_status: 'trialing',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'clerk_org_id', ignoreDuplicates: false }
      )
      break
    }

    case 'organization.updated': {
      const data = (event as ClerkOrgEvent).data
      await supabase
        .from('orgs')
        .update({ name: data.name, updated_at: new Date().toISOString() })
        .eq('clerk_org_id', data.id)
      break
    }

    case 'user.created': {
      const data = (event as ClerkUserEvent).data
      const email = data.email_addresses[0]?.email_address ?? ''
      const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || null

      await supabase.from('users').upsert(
        { clerk_user_id: data.id, email, name },
        { onConflict: 'clerk_user_id', ignoreDuplicates: false }
      )

      // Send welcome email (best-effort, non-blocking)
      if (email) {
        const { sendEmail } = await import('@/lib/email/client')
        void sendEmail({ to: email, template: 'welcome', data: { name: name ?? 'Operator' } })
      }
      break
    }

    case 'organizationMembership.created': {
      const data = (event as ClerkMembershipEvent).data

      // Get org id from clerk_org_id
      const { data: org } = await supabase
        .from('orgs')
        .select('id')
        .eq('clerk_org_id', data.organization.id)
        .single()

      if (org) {
        await supabase
          .from('users')
          .update({ org_id: org.id, role: data.role })
          .eq('clerk_user_id', data.public_user_data.user_id)
      }
      break
    }

    default:
      break
  }
}
