// Pricing: anchored high (OPERATOR first), decoy effect on ANALYST, charm pricing
export const PLANS = [
  {
    id: 'operator',
    name: 'Operator',
    price: '$149',
    priceMonthly: 149,
    period: '/mo',
    desc: 'Full intelligence operating system',
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_OPERATOR ?? 'price_operator',
    features: ['Unlimited alerts', '∞ feed history', 'All tools + Workbench', 'Shared boards', 'Full API + webhooks', 'Custom reports', 'All predictions'],
    popular: false,
  },
  {
    id: 'analyst',
    name: 'Analyst',
    price: '$79',
    priceMonthly: 79,
    period: '/mo',
    desc: 'For professional analysts',
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ANALYST ?? 'price_analyst',
    features: ['50 alert rules', '30-day history', 'AI Co-pilot', 'All tools', 'Full predictions', 'Similarity search', 'API access'],
    popular: true,
  },
  {
    id: 'scout',
    name: 'Scout',
    price: '$29',
    priceMonthly: 29,
    period: '/mo',
    desc: 'See what\'s happening',
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_SCOUT ?? 'price_scout',
    features: ['10 alert rules', '7-day history', 'Full map + live layers', 'Daily briefing', 'Email alerts', 'Travel risk'],
    popular: false,
  },
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    priceMonthly: 0,
    period: '/mo',
    desc: 'Just the basics',
    stripePriceId: null as string | null,
    features: ['3 alert rules', '24h feed', 'Map (view only)', 'In-app alerts'],
    popular: false,
  },
] as const

export type PlanId = typeof PLANS[number]['id']

export const PLAN_LIMITS: Record<PlanId, {
  feed_days: number; alerts: number; channels: string[]
  reports: string[] | string | false; trends: string | false
  actors: string | false; tools: string[]
  api: boolean; workbench: boolean
  predictions: string | false; similarity: boolean
  analyst_chat: number; scenarios: number; market: boolean
  sanctions: boolean; multi_lang: string | false
  country_profiles: string; personnel: number
  supply_chain: number; custom_dashboards: number
  timelines: boolean; compare: boolean
  export_briefs: string | false; force_tracker: string | false
  api_calls_per_day: number
}> = {
  free: {
    feed_days: 1, alerts: 3, channels: ['in_app'],
    reports: false, trends: false, actors: false, tools: [], api: false, workbench: false,
    predictions: false, similarity: false,
    analyst_chat: 0, scenarios: 0, market: false,
    sanctions: false, multi_lang: false,
    country_profiles: 'basic', personnel: 0,
    supply_chain: 0, custom_dashboards: 0,
    timelines: false, compare: false,
    export_briefs: false, force_tracker: false,
    api_calls_per_day: 0,
  },
  scout: {
    feed_days: 7, alerts: 10, channels: ['in_app','email'],
    reports: ['daily_briefing'], trends: 'basic', actors: 'view', tools: ['travel_risk'],
    api: false, workbench: false, predictions: 'view', similarity: false,
    analyst_chat: 3, scenarios: 0, market: false,
    sanctions: false, multi_lang: 'badges',
    country_profiles: 'full', personnel: 0,
    supply_chain: 0, custom_dashboards: 0,
    timelines: false, compare: false,
    export_briefs: 'daily_digest', force_tracker: 'basic',
    api_calls_per_day: 0,
  },
  analyst: {
    feed_days: 30, alerts: 50, channels: ['in_app','email','webhook'],
    reports: 'all', trends: 'full', actors: 'full',
    tools: ['travel_risk','geoverify','similarity'], api: true, workbench: false,
    predictions: 'full', similarity: true,
    analyst_chat: Infinity, scenarios: 3, market: true,
    sanctions: true, multi_lang: 'full',
    country_profiles: 'full_ai', personnel: 0,
    supply_chain: 0, custom_dashboards: 3,
    timelines: true, compare: true,
    export_briefs: 'all', force_tracker: 'full',
    api_calls_per_day: 1000,
  },
  operator: {
    feed_days: Infinity, alerts: Infinity, channels: ['in_app','email','webhook'],
    reports: 'all', trends: 'full', actors: 'full',
    tools: ['travel_risk','geoverify','similarity','workbench'], api: true, workbench: true,
    predictions: 'full', similarity: true,
    analyst_chat: Infinity, scenarios: Infinity, market: true,
    sanctions: true, multi_lang: 'full',
    country_profiles: 'full_compare', personnel: 50,
    supply_chain: 20, custom_dashboards: Infinity,
    timelines: true, compare: true,
    export_briefs: 'white_label', force_tracker: 'full_posture',
    api_calls_per_day: Infinity,
  },
}

export function canAccess(planId: PlanId, feature: keyof typeof PLAN_LIMITS['free']): boolean {
  const limits = PLAN_LIMITS[planId]
  if (!limits) return false
  const val = limits[feature]
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') return true
  if (Array.isArray(val)) return val.length > 0
  if (typeof val === 'number') return val > 0
  return !!val
}
