import type { Metadata } from 'next'
import { LandingClient } from '@/components/landing/LandingClient'

export const metadata: Metadata = {
  title: 'Conflict Ops — Geopolitical Intelligence. Built for Operators.',
  description: 'Production-grade geopolitical intelligence for analysts, operators, and security teams.',
}

const FEATURES = [
  { icon: 'activity', color: '#60A5FA', title: 'Real-Time Intel Feed', desc: 'Multi-source ingest every 15 minutes across 5 global data streams' },
  { icon: 'globe', color: '#22C55E', title: 'Conflict Map', desc: 'PostGIS-powered interactive map with event clustering, AIS vessel positions, and thermal overlays' },
  { icon: 'trending-up', color: '#A78BFA', title: 'AI Forecasting', desc: 'Monte Carlo risk models. P10/P50/P90 scenario outputs. Zero hallucinated predictions.' },
  { icon: 'bell', color: '#FB923C', title: 'Alert Engine', desc: 'Define Priority Intelligence Requirements. Get alerted the moment conditions are met.' },
  { icon: 'radio', color: '#F87171', title: 'Vessel & Flight Tracking', desc: 'AIS maritime tracking + ADS-B flight data. Dark vessel detection. Military callsign recognition.' },
  { icon: 'key', color: '#94A3B8', title: 'REST API + Webhooks', desc: 'Business-tier API with Bearer auth, rate limiting, and HMAC-signed webhooks.' },
] as const

export default function LandingPage() {
  return <LandingClient features={FEATURES as any} />
}
