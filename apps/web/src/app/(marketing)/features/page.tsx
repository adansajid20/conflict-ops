import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Features — CONFLICTRADAR',
  description: 'Enterprise geopolitical intelligence platform. Real-time conflict tracking, AI forecasting, vessel tracking, and threat assessment.',
}

const FEATURES = [
  {
    icon: '◈', title: 'Real-Time Intel Feed',
    desc: 'GDELT, ReliefWeb, GDACS, and UNHCR feeds ingest every 15 minutes. 250+ languages, global coverage.',
    tags: ['GDELT', 'UN OCHA', 'GDACS', 'UNHCR'],
  },
  {
    icon: '⊞', title: 'Conflict Map',
    desc: 'Interactive global map with event clustering, maritime zones, thermal anomalies, and flight tracking overlays.',
    tags: ['MapLibre', 'PostGIS', 'AIS', 'ADS-B'],
  },
  {
    icon: '◷', title: 'AI Forecasting',
    desc: 'Monte Carlo simulations (1,000 iterations) produce P10/P50/P90 risk forecasts. Null when data insufficient — no hallucinations.',
    tags: ['Gemini 2.0', 'Monte Carlo', 'P10/P50/P90'],
  },
  {
    icon: '⚠', title: 'Alert Engine',
    desc: 'Priority Intelligence Requirements (PIRs) fire alerts when conditions are met. 5-level escalation ladder from STABLE to WAR.',
    tags: ['PIR', 'Escalation', 'Email Alerts'],
  },
  {
    icon: '⊙', title: 'Maritime & Air Tracking',
    desc: 'AIS vessel tracking with dark vessel detection. ADS-B flight tracking with military callsign recognition and squawk 7700.',
    tags: ['AISStream', 'OpenSky', 'Dark Vessels'],
  },
  {
    icon: '◷', title: 'Prediction Markets',
    desc: 'Metaculus and Polymarket geopolitical question feeds, cross-referenced with your intelligence assessments.',
    tags: ['Metaculus', 'Polymarket', 'Superforecasting'],
  },
  {
    icon: '⊛', title: 'OSINT Geoverification',
    desc: '8-method verification queue with confidence scoring. Tier system from Confirmed to False positive.',
    tags: ['OSINT', 'Verification', '5-Tier'],
  },
  {
    icon: '⊲', title: 'Travel Risk (ISO 31030)',
    desc: 'Country risk scoring from live event data. Pre-departure brief generation for security teams.',
    tags: ['ISO 31030', 'Duty of Care', 'Travel Security'],
  },
  {
    icon: '⊢', title: 'Public REST API',
    desc: 'Bearer-token authenticated API with rate limiting. Webhooks with HMAC-SHA256 signing for Business plans.',
    tags: ['REST API', 'Webhooks', 'Business'],
  },
]

export default function FeaturesPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* Nav */}
      <nav className="border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/landing" className="font-bold tracking-widest mono" style={{ color: 'var(--primary)' }}>
            CONFLICTRADAR
          </Link>
          <div className="flex items-center gap-6 text-sm mono">
            <Link href="/features" style={{ color: 'var(--primary)' }}>Features</Link>
            <Link href="/pricing" style={{ color: 'var(--text-muted)' }}>Pricing</Link>
            <Link href="/wire" style={{ color: 'var(--text-muted)' }}>Live Wire</Link>
            <Link href="/sign-in" style={{ color: 'var(--text-muted)' }}>Sign In</Link>
            <Link href="/sign-up" className="px-4 py-1.5 rounded text-xs font-bold"
              style={{ backgroundColor: 'var(--primary)', color: '#000' }}>
              Start Free
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <div className="classification-banner inline-block px-3 py-1 rounded mb-4 text-xs mono">
            PLATFORM CAPABILITIES // UNCLASSIFIED
          </div>
          <h1 className="text-4xl font-bold tracking-widest uppercase mb-4" style={{ color: 'var(--primary)' }}>
            INTELLIGENCE FEATURES
          </h1>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--text-muted)' }}>
            Enterprise-grade geopolitical intelligence without the enterprise price tag. Every tool serious analysts need.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(f => (
            <div key={f.title} className="p-6 rounded border hover:border-primary/40 transition-colors"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
              <div className="text-2xl mb-3" style={{ color: 'var(--primary)' }}>{f.icon}</div>
              <h3 className="font-bold tracking-wider mono mb-2" style={{ color: 'var(--text-primary)' }}>{f.title}</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
              <div className="flex flex-wrap gap-2">
                {f.tags.map(t => (
                  <span key={t} className="text-xs mono px-2 py-0.5 rounded"
                    style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Link href="/sign-up" className="inline-block px-10 py-4 rounded font-bold mono tracking-widest text-lg"
            style={{ backgroundColor: 'var(--primary)', color: '#000' }}>
            START FREE TRIAL — NO CARD REQUIRED
          </Link>
          <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>14-day free trial · Individual plan free forever</p>
        </div>
      </div>
    </div>
  )
}
