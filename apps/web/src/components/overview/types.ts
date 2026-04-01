export interface OverviewEvent {
  id: string
  source: string | null
  event_type: string | null
  title: string | null
  description: string | null
  region: string | null
  country_code: string | null
  severity: number | null
  status: string | null
  occurred_at: string | null
  ingested_at: string | null
  location: string | null
  provenance_raw: { url?: string; attribution?: string; source?: string } | null
  // Phase 2: extended fields (optional for backward-compat)
  outlet_name?: string | null
  location_confidence?: string | null
  corroboration_count?: number | null
}

export interface HotRegion {
  region: string
  riskLevel: 'Critical' | 'High' | 'Moderate' | 'Monitored'
  eventCount: number
  topDrivers: string[]
  topCountries: string[]
}

export interface OverviewData {
  lastUpdatedAt: string | null
  freshnessStatus: 'Fresh' | 'Delayed' | 'Stale' | 'Offline'
  freshnessDescription: string
  freshnessColor: 'green' | 'yellow' | 'orange' | 'red'
  coverageLevel: 'High' | 'Medium' | 'Low'
  coverageTooltip: string
  kpis: {
    eventsWindow: number
    events7d: number
    hotRegionCount: number
    criticalHighCount: number
    developingCount: number
    activeAlertsCount: number
  }
  topStories: OverviewEvent[]
  hotRegions: HotRegion[]
  notices: string[]
  hasOrg: boolean
  window: string
  // Phase 2: pre-computed severity distribution from API (optional for compat)
  severityCounts?: { critical: number; high: number; medium: number; low: number }
}
