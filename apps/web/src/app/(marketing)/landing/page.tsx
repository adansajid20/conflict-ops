import Link from 'next/link'
import { SignedIn, SignedOut } from '@clerk/nextjs'

const FEATURES = [
  {
    icon: '▤',
    title: 'Real-Time Intel Feed',
    desc: 'ACLED + GDELT events processed every 15 minutes. GPT-4o enrichment, severity scoring, and narrative synthesis on the heavy lane.',
  },
  {
    icon: '⊞',
    title: 'Interactive Conflict Map',
    desc: 'MapLibre-powered global conflict map. Cluster events by region, filter by severity, overlay maritime and thermal data.',
  },
  {
    icon: '⊡',
    title: 'Analysis Workbench',
    desc: 'Monte Carlo escalation engine (1,000 iterations), ACH hypothesis matrix, structured analytic techniques — all in-browser.',
  },
  {
    icon: '⚠',
    title: 'PIR Alerts + Escalation',
    desc: 'Define Priority Intelligence Requirements. Get alerts when thresholds are crossed. 5-level escalation ladder auto-computes from rolling event data.',
  },
  {
    icon: '⊙',
    title: 'Maritime + Air Tracking',
    desc: 'AIS vessel tracks (AISStream.io), ADS-B military flights (OpenSky), dark vessel detection, squawk emergency monitoring.',
  },
  {
    icon: '◷',
    title: 'Prediction Markets',
    desc: 'Metaculus and Polymarket probabilities pulled into your dashboard. Real-money calibrated forecasts alongside your own analysis.',
  },
  {
    icon: '⊛',
    title: 'OSINT Geoverification',
    desc: 'Submit source URLs for structured verification. Shadow analysis, metadata extraction, landmark matching, satellite cross-reference.',
  },
  {
    icon: '⊲',
    title: 'Travel Risk (ISO 31030)',
    desc: 'Country risk scoring from live event data. Auto-generated pre-departure briefs with checklists, comms plans, and extraction routes.',
  },
  {
    icon: '⊢',
    title: 'REST API + Webhooks',
    desc: 'Programmatic access to events, forecasts, and tracking data. Webhook delivery for alerts, escalations, and dark vessel events.',
  },
]

const PLANS = [
  {
    name: 'INDIVIDUAL',
    price: '$29',
    period: '/mo',
    desc: 'Solo analyst',
    features: ['3 missions', '7-day history', 'Intel feed + map', 'Basic alerts'],
    cta: 'Start free trial',
    highlight: false,
  },
  {
    name: 'PRO',
    price: '$99',
    period: '/mo',
    desc: 'Power analyst',
    features: ['25 missions', '180-day history', 'Workbench + ACH', 'Scheduled briefs', 'PIR tracking'],
    cta: 'Start free trial',
    highlight: true,
  },
  {
    name: 'BUSINESS',
    price: '$499',
    period: '/mo',
    desc: 'Security teams',
    features: ['Unlimited missions', '365-day history', 'REST API + webhooks', 'Travel risk module', 'Geoverification queue', '50 seats'],
    cta: 'Start free trial',
    highlight: false,
  },
  {
    name: 'ENTERPRISE',
    price: 'Custom',
    period: '',
    desc: 'Large orgs',
    features: ['Unlimited everything', 'SSO / SAML', 'Audit log', 'White-label', 'Custom data sources', 'SLA + dedicated support'],
    cta: 'Contact sales',
    highlight: false,
  },
]

const STATS = [
  { value: '180+', label: 'Countries tracked' },
  { value: '15min', label: 'Intel refresh cycle' },
  { value: '1,000', label: 'Monte Carlo iterations' },
  { value: '6', label: 'Maritime chokepoints monitored' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0e14', color: '#c9d1d9', fontFamily: 'var(--font-mono, monospace)' }}>

      {/* Top nav */}
      <nav className="border-b px-6 py-4 flex items-center justify-between sticky top-0 z-50"
        style={{ borderColor: '#21262d', backgroundColor: '#0a0e14ee', backdropFilter: 'blur(8px)' }}>
        <div className="text-lg font-bold tracking-widest" style={{ color: '#58a6ff' }}>CONFLICT OPS</div>
        <div className="flex items-center gap-4 text-sm">
          <a href="#features" style={{ color: '#8b949e' }} className="hover:text-white transition-colors">Features</a>
          <a href="#pricing" style={{ color: '#8b949e' }} className="hover:text-white transition-colors">Pricing</a>
          <SignedOut>
            <Link href="/sign-in" style={{ color: '#8b949e' }} className="hover:text-white transition-colors">Sign in</Link>
            <Link href="/sign-up"
              className="px-4 py-2 rounded text-sm font-bold transition-colors"
              style={{ backgroundColor: '#1f6feb', color: '#fff' }}>
              Get access
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/"
              className="px-4 py-2 rounded text-sm font-bold"
              style={{ backgroundColor: '#1f6feb', color: '#fff' }}>
              Dashboard →
            </Link>
          </SignedIn>
        </div>
      </nav>

      {/* Classification banner */}
      <div className="text-center py-2 text-xs tracking-widest" style={{ backgroundColor: '#161b22', color: '#58a6ff', borderBottom: '1px solid #21262d' }}>
        CONFLICT OPS // UNCLASSIFIED // OPERATOR USE ONLY
      </div>

      {/* Hero */}
      <section className="px-6 py-32 text-center max-w-5xl mx-auto">
        <div className="inline-block px-3 py-1 text-xs tracking-widest rounded mb-6" style={{ backgroundColor: '#1f6feb20', color: '#58a6ff', border: '1px solid #1f6feb40' }}>
          ENTERPRISE GEOPOLITICAL INTELLIGENCE
        </div>
        <h1 className="text-5xl font-bold mb-6 leading-tight tracking-tight" style={{ color: '#e6edf3' }}>
          Palantir-grade intel.<br />
          <span style={{ color: '#58a6ff' }}>Without the Palantir price.</span>
        </h1>
        <p className="text-xl mb-10 max-w-2xl mx-auto" style={{ color: '#8b949e', lineHeight: 1.7 }}>
          Real-time conflict tracking, Monte Carlo forecasting, maritime/air picture, OSINT verification, and travel risk — in one platform built for serious analysts.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/sign-up"
            className="px-8 py-4 rounded font-bold text-lg transition-all hover:opacity-90"
            style={{ backgroundColor: '#1f6feb', color: '#fff' }}>
            Start free trial — no credit card
          </Link>
          <Link href="/sign-in"
            className="px-8 py-4 rounded font-bold text-lg transition-colors"
            style={{ border: '1px solid #30363d', color: '#c9d1d9' }}>
            Sign in →
          </Link>
        </div>
        <p className="mt-4 text-xs" style={{ color: '#484f58' }}>14-day free trial · Cancel anytime · No BS</p>
      </section>

      {/* Stats */}
      <section className="border-y py-12" style={{ borderColor: '#21262d', backgroundColor: '#0d1117' }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center px-6">
          {STATS.map(s => (
            <div key={s.label}>
              <div className="text-3xl font-bold mb-1" style={{ color: '#58a6ff' }}>{s.value}</div>
              <div className="text-xs tracking-widest uppercase" style={{ color: '#484f58' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-24 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div className="text-xs tracking-widest mb-3" style={{ color: '#58a6ff' }}>CAPABILITIES</div>
          <h2 className="text-3xl font-bold" style={{ color: '#e6edf3' }}>Everything an intel analyst needs</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(f => (
            <div key={f.title} className="p-6 rounded-lg border"
              style={{ borderColor: '#21262d', backgroundColor: '#0d1117' }}>
              <div className="text-2xl mb-3" style={{ color: '#58a6ff' }}>{f.icon}</div>
              <h3 className="font-bold mb-2 tracking-wide" style={{ color: '#e6edf3' }}>{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#8b949e' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-24" style={{ backgroundColor: '#0d1117' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs tracking-widest mb-3" style={{ color: '#58a6ff' }}>PRICING</div>
            <h2 className="text-3xl font-bold" style={{ color: '#e6edf3' }}>Intelligence that scales with your mission</h2>
            <p className="mt-3 text-sm" style={{ color: '#8b949e' }}>All plans include 14-day free trial</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PLANS.map(p => (
              <div key={p.name}
                className="p-6 rounded-lg border flex flex-col"
                style={{
                  borderColor: p.highlight ? '#1f6feb' : '#21262d',
                  backgroundColor: p.highlight ? '#0d2044' : '#161b22',
                  boxShadow: p.highlight ? '0 0 30px #1f6feb30' : 'none',
                }}>
                {p.highlight && (
                  <div className="text-xs tracking-widest mb-3 font-bold" style={{ color: '#58a6ff' }}>MOST POPULAR</div>
                )}
                <div className="text-xs tracking-widest mb-1" style={{ color: '#484f58' }}>{p.name}</div>
                <div className="mb-1">
                  <span className="text-3xl font-bold" style={{ color: '#e6edf3' }}>{p.price}</span>
                  <span className="text-sm" style={{ color: '#8b949e' }}>{p.period}</span>
                </div>
                <div className="text-xs mb-4" style={{ color: '#8b949e' }}>{p.desc}</div>
                <ul className="flex-1 space-y-2 mb-6">
                  {p.features.map(f => (
                    <li key={f} className="text-xs flex gap-2" style={{ color: '#c9d1d9' }}>
                      <span style={{ color: '#3fb950' }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link href={p.name === 'ENTERPRISE' ? 'mailto:enterprise@conflictradar.co' : '/sign-up'}
                  className="block text-center py-2 rounded text-sm font-bold transition-colors"
                  style={{
                    backgroundColor: p.highlight ? '#1f6feb' : 'transparent',
                    color: p.highlight ? '#fff' : '#58a6ff',
                    border: p.highlight ? 'none' : '1px solid #1f6feb',
                  }}>
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 text-center border-t" style={{ borderColor: '#21262d' }}>
        <div className="max-w-2xl mx-auto">
          <div className="text-xs tracking-widest mb-4" style={{ color: '#58a6ff' }}>READY TO OPERATE</div>
          <h2 className="text-3xl font-bold mb-4" style={{ color: '#e6edf3' }}>
            Start your free trial today
          </h2>
          <p className="text-sm mb-8" style={{ color: '#8b949e' }}>
            No credit card required. Full access for 14 days.
            Cancel anytime — no questions asked.
          </p>
          <Link href="/sign-up"
            className="inline-block px-10 py-4 rounded font-bold text-lg"
            style={{ backgroundColor: '#1f6feb', color: '#fff' }}>
            Get started free →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-8" style={{ borderColor: '#21262d' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="text-sm font-bold tracking-widest" style={{ color: '#58a6ff' }}>CONFLICT OPS</div>
          <div className="text-xs" style={{ color: '#484f58' }}>
            Active fire data courtesy of NASA FIRMS · Vessel data via AISStream.io · Flight data by The OpenSky Network
          </div>
          <div className="text-xs flex gap-4 items-center" style={{ color: '#484f58' }}>
            <span>© 2026 CONFLICT OPS</span>
            <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-white transition-colors">Terms</a>
            <a href="mailto:support@conflictradar.co" className="hover:text-white transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
