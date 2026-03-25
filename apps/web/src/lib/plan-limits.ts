/**
 * Server-side plan limits resolver.
 * Reads from DB — never trusts client-provided plan tier.
 */
import { createServiceClient } from './supabase/server'
import { getPlanLimits } from '@conflict-ops/shared'
import type { PlanId, PlanLimits } from '@conflict-ops/shared'

export async function getOrgPlanLimits(orgId: string): Promise<PlanLimits> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('orgs')
    .select('plan_id')
    .eq('id', orgId)
    .single()

  if (error !== null || data === null) {
    // Default to individual on error — safest fallback
    return getPlanLimits('individual')
  }

  return getPlanLimits(data.plan_id as PlanId)
}

export async function requireFeature(
  orgId: string,
  feature: keyof PlanLimits
): Promise<void> {
  const limits = await getOrgPlanLimits(orgId)
  if (!limits[feature]) {
    throw new Error(`Feature '${feature}' not available on your current plan. Upgrade to access this feature.`)
  }
}

export { getPlanLimits, isAtMissionLimit, planHasFeature } from '@conflict-ops/shared'
