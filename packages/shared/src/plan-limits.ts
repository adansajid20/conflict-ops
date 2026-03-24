import type { PlanId, PlanLimits } from './types'

const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  individual: {
    planId: 'individual',
    maxMissions: 3,
    maxMembers: 1,
    historyDays: 7,
    apiAccess: false,
    webhooks: false,
    scenarios: false,
    achMatrix: false,
    satSuite: false,
    orgMode: false,
    auditLogs: false,
    ssoSaml: false,
    customSources: false,
    whiteLabel: false,
    scheduledBriefs: false,
    satelliteImagery: false,
    verificationQueue: false,
    twoPersonRule: false,
    domainPacks: [],
    maxApiCallsPerDay: 0,
    dataRetentionDays: 7,
    usageBasedBilling: false,
  },
  pro: {
    planId: 'pro',
    maxMissions: 25,
    maxMembers: 1,
    historyDays: 180,
    apiAccess: false,
    webhooks: false,
    scenarios: true,
    achMatrix: true,
    satSuite: true,
    orgMode: false,
    auditLogs: false,
    ssoSaml: false,
    customSources: false,
    whiteLabel: false,
    scheduledBriefs: true,
    satelliteImagery: false,
    verificationQueue: false,
    twoPersonRule: false,
    domainPacks: [],
    maxApiCallsPerDay: 0,
    dataRetentionDays: 180,
    usageBasedBilling: false,
  },
  business: {
    planId: 'business',
    maxMissions: -1,
    maxMembers: 50,
    historyDays: 365,
    apiAccess: true,
    webhooks: true,
    scenarios: true,
    achMatrix: true,
    satSuite: true,
    orgMode: true,
    auditLogs: true,
    ssoSaml: false,
    customSources: false,
    whiteLabel: false,
    scheduledBriefs: true,
    satelliteImagery: true,
    verificationQueue: true,
    twoPersonRule: true,
    domainPacks: ['maritime', 'aviation', 'chokepoint'],
    maxApiCallsPerDay: 10000,
    dataRetentionDays: 365,
    usageBasedBilling: true,
  },
  enterprise: {
    planId: 'enterprise',
    maxMissions: -1,
    maxMembers: -1,
    historyDays: -1,
    apiAccess: true,
    webhooks: true,
    scenarios: true,
    achMatrix: true,
    satSuite: true,
    orgMode: true,
    auditLogs: true,
    ssoSaml: true,
    customSources: true,
    whiteLabel: true,
    scheduledBriefs: true,
    satelliteImagery: true,
    verificationQueue: true,
    twoPersonRule: true,
    domainPacks: ['maritime', 'aviation', 'chokepoint', 'insurance', 'esgsec'],
    maxApiCallsPerDay: -1,
    dataRetentionDays: -1,
    usageBasedBilling: true,
  },
}

/**
 * Returns plan limits for a given plan ID.
 * NEVER accepts client-provided plan tier — always call from server-side.
 */
export function getPlanLimits(planId: PlanId): PlanLimits {
  return PLAN_LIMITS[planId]
}

/**
 * Check if a plan has access to a specific feature.
 */
export function planHasFeature(
  planId: PlanId,
  feature: keyof Omit<PlanLimits, 'planId' | 'maxMissions' | 'maxMembers' | 'historyDays' | 'maxApiCallsPerDay' | 'dataRetentionDays' | 'domainPacks'>
): boolean {
  return PLAN_LIMITS[planId][feature] as boolean
}

/**
 * Check if org has reached mission limit.
 * -1 means unlimited.
 */
export function isAtMissionLimit(planId: PlanId, currentCount: number): boolean {
  const limit = PLAN_LIMITS[planId].maxMissions
  if (limit === -1) return false
  return currentCount >= limit
}
