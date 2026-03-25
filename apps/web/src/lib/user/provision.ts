/**
 * User auto-provisioning — runs on every authenticated request.
 * Creates user + default org in DB if they don't exist yet.
 * This is the fallback for when the Clerk webhook is not configured.
 * Safe to call multiple times (upsert).
 */
import { currentUser } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function ensureUserProvisioned(clerkUserId: string): Promise<{
  userId: string
  orgId: string | null
  onboardingComplete: boolean
  role: string
}> {
  const supabase = createServiceClient()

  // Check if user exists
  const { data: existing } = await supabase
    .from('users')
    .select('id, org_id, onboarding_complete, role')
    .eq('clerk_user_id', clerkUserId)
    .single()

  if (existing) {
    return {
      userId: existing.id,
      orgId: existing.org_id ?? null,
      onboardingComplete: existing.onboarding_complete,
      role: existing.role ?? 'analyst',
    }
  }

  // User doesn't exist — fetch from Clerk and create
  let email = ''
  let name: string | null = null
  try {
    const clerkUser = await currentUser()
    email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? `${clerkUserId}@unknown`
    name = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ') || null
  } catch {
    email = `${clerkUserId}@unknown`
  }

  const { data: newUser, error: userError } = await supabase
    .from('users')
    .upsert(
      { clerk_user_id: clerkUserId, email, name, role: 'owner' },
      { onConflict: 'clerk_user_id', ignoreDuplicates: false }
    )
    .select('id, org_id, onboarding_complete, role')
    .single()

  if (userError || !newUser) {
    // If upsert failed (race condition), try a plain select
    const { data: retryUser } = await supabase
      .from('users')
      .select('id, org_id, onboarding_complete, role')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (retryUser) {
      return {
        userId: retryUser.id,
        orgId: retryUser.org_id ?? null,
        onboardingComplete: retryUser.onboarding_complete,
        role: retryUser.role ?? 'owner',
      }
    }

    throw new Error(`Failed to provision user: ${userError?.message}`)
  }

  return {
    userId: newUser.id,
    orgId: newUser.org_id ?? null,
    onboardingComplete: newUser.onboarding_complete,
    role: newUser.role ?? 'owner',
  }
}

/**
 * Creates a default org for a user who has none.
 * Called from onboarding OR when user first enters a feature that needs an org.
 */
export async function createDefaultOrg(userId: string, orgName = 'My Organization'): Promise<string> {
  const supabase = createServiceClient()

  // Double-check they don't already have one
  const { data: user } = await supabase.from('users').select('org_id').eq('id', userId).single()
  if (user?.org_id) return user.org_id

  const { data: org, error } = await supabase
    .from('orgs')
    .insert({
      name: orgName,
      plan_id: 'individual',
      subscription_status: 'trialing',
    })
    .select('id')
    .single()

  if (error || !org) throw new Error(`Failed to create org: ${error?.message}`)

  await supabase.from('users').update({ org_id: org.id, role: 'owner' }).eq('id', userId)

  return org.id
}
