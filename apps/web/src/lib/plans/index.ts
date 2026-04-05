export type Plan = 'free' | 'scout' | 'analyst' | 'operator'

export interface PlanConfig {
  feedDays: number
  alerts: number
  channels: string[]
  reports: boolean | string[]
  trends: boolean | 'basic' | 'full'
  actors: boolean | 'view' | 'full'
  tools: string[]
  api: boolean
  workbench: boolean
  predictions: boolean | 'view' | 'full'
  similarity: boolean
}

export const PLAN_LIMITS: Record<Plan, PlanConfig> = {
  free: {
    feedDays: 1, alerts: 3, channels: ['in_app'],
    reports: false, trends: false, actors: false,
    tools: [], api: false, workbench: false,
    predictions: false, similarity: false,
  },
  scout: {
    feedDays: 7, alerts: 10, channels: ['in_app', 'email'],
    reports: ['daily_briefing'], trends: 'basic', actors: 'view',
    tools: ['travel_risk'], api: false, workbench: false,
    predictions: 'view', similarity: false,
  },
  analyst: {
    feedDays: 30, alerts: 50, channels: ['in_app', 'email', 'webhook'],
    reports: true, trends: 'full', actors: 'full',
    tools: ['travel_risk', 'geoverify', 'similarity'], api: true, workbench: false,
    predictions: 'full', similarity: true,
  },
  operator: {
    feedDays: 99999, alerts: 99999, channels: ['in_app', 'email', 'webhook'],
    reports: true, trends: 'full', actors: 'full',
    tools: ['travel_risk', 'geoverify', 'similarity', 'workbench'], api: true, workbench: true,
    predictions: 'full', similarity: true,
  },
}

export const PLAN_PRICES = {
  free:     { monthly: 0,   annual: 0,    label: 'Free' },
  scout:    { monthly: 29,  annual: 290,  label: 'Scout' },
  analyst:  { monthly: 79,  annual: 790,  label: 'Analyst' },
  operator: { monthly: 149, annual: 1490, label: 'Operator' },
}

export function canAccess(plan: Plan, feature: keyof PlanConfig): boolean {
  const config = PLAN_LIMITS[plan]
  const val = config[feature]
  if (typeof val === 'boolean') return val
  if (typeof val === 'number') return val > 0
  if (Array.isArray(val)) return val.length > 0
  if (typeof val === 'string') return true
  return false
}
