// CONFLICT OPS — Shared Types
// All types match the DB schema exactly. No `any`. Strict.

export type PlanId = 'individual' | 'pro' | 'business' | 'enterprise'

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'

export type UserRole = 'owner' | 'admin' | 'analyst' | 'viewer'

export type EventStatus =
  | 'pending'
  | 'pending_verification'
  | 'verified'
  | 'disputed'
  | 'corrected'

export type AlertType =
  | 'event'
  | 'threshold'
  | 'anomaly'
  | 'outage'
  | 'vessel'
  | 'aircraft'
  | 'thermal'
  | 'mobility'

export type CircuitBreakerStatus = 'closed' | 'open' | 'half-open'

export type SystemStatus = 'green' | 'yellow' | 'red'

export type UITheme = 'ops' | 'professional'

// Generic API response — all routes return this
export type ApiResponse<T = unknown> = {
  success: boolean
  data?: T
  error?: string
  meta?: Record<string, unknown>
}

// Plan limits returned by getPlanLimits()
export type PlanLimits = {
  planId: PlanId
  maxMissions: number // -1 = unlimited
  maxMembers: number // -1 = unlimited
  historyDays: number // -1 = unlimited
  apiAccess: boolean
  webhooks: boolean
  scenarios: boolean
  achMatrix: boolean
  satSuite: boolean
  orgMode: boolean
  auditLogs: boolean
  ssoSaml: boolean
  customSources: boolean
  whiteLabel: boolean
  scheduledBriefs: boolean
  satelliteImagery: boolean
  verificationQueue: boolean
  twoPersonRule: boolean
  domainPacks: string[]
  maxApiCallsPerDay: number // -1 = unlimited
  dataRetentionDays: number // -1 = unlimited
  usageBasedBilling: boolean
}

export type Organization = {
  id: string
  clerkOrgId: string | null
  name: string
  planId: PlanId
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  subscriptionStatus: SubscriptionStatus
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  dataRetentionDays: number
  uiMode: UITheme
  createdAt: string
  updatedAt: string
}

export type User = {
  id: string
  clerkUserId: string
  orgId: string | null
  email: string
  name: string | null
  role: UserRole
  preferredTheme: UITheme
  locale: string
  timezone: string
  createdAt: string
}

export type Mission = {
  id: string
  orgId: string
  name: string
  description: string | null
  regions: string[]
  actorIds: string[]
  tags: string[]
  pirIds: string[]
  isShared: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type GeoPoint = {
  type: 'Point'
  coordinates: [number, number] // [lng, lat]
}

export type EventSeverity = 1 | 2 | 3 | 4 | 5

export type ConflictEvent = {
  id: string
  source: string
  sourceId: string | null
  eventType: string
  title: string
  description: string | null
  descriptionOriginal: string | null
  descriptionTranslated: string | null
  descriptionLang: string | null
  translationConfidence: number | null
  region: string | null
  countryCode: string | null
  location: GeoPoint | null
  actorIds: string[]
  tags: string[]
  severity: EventSeverity | null
  status: EventStatus
  occurredAt: string
  ingestedAt: string
  heavyLaneProcessed: boolean
  sentimentScore: number | null
  dataQualityScore: number | null
  provenanceRaw: Record<string, unknown> | null
  provenanceInferred: Record<string, unknown> | null
}

export type ForecastConfidence = 'low' | 'medium' | 'high'

export type Forecast = {
  id: string
  region: string
  countryCode: string | null
  forecastType: string
  horizonDays: number
  score: number | null // NULL if event_count < 3 — never fake
  confidence: ForecastConfidence | null
  eventCount: number
  computedAt: string
  modelVersion: string
  factors: Record<string, unknown> | null
  benchmarkViews: number | null
  benchmarkCast: number | null
}

export type Alert = {
  id: string
  orgId: string
  missionId: string | null
  title: string
  body: string
  alertType: AlertType
  severity: EventSeverity
  deliveredAt: string
  read: boolean
  metadata: Record<string, unknown> | null
}

export type Actor = {
  id: string
  orgId: string | null
  name: string
  aliases: string[]
  type: string | null
  countryCode: string | null
  description: string | null
  tags: string[]
  canonicalId: string | null
  disambiguationConfidence: number | null
  isCanonical: boolean
}

// Dashboard summary types
export type DashboardStats = {
  eventsToday: number
  activeAlerts: number
  openMissions: number
  sourcesOnline: number
  lastUpdated: string
}
