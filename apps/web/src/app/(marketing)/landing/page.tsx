import type { Metadata } from 'next'
import { LandingClient } from '@/components/landing/LandingClient'
import { WaitlistForm } from '@/components/landing/WaitlistForm'

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

const HOW_IT_WORKS = [
  { title: 'Ingest', body: 'Pull live reporting, structured feeds, and platform telemetry into one operational picture.' },
  { title: 'Analyze', body: 'Correlate events, build reports, run workbench methods, and query the AI co-pilot against real data.' },
  { title: 'Act', body: 'Trigger alerts, push webhooks, distribute reports, and route signal to the people who actually need it.' },
]

const COMPETITORS = [
  ['CONFLICT OPS', '$9–$299', 'Yes', 'Yes', 'Yes', 'Yes'],
  ['Dataminr', 'Enterprise', 'No', 'Yes', 'Limited', 'No'],
  ['Recorded Future', 'Enterprise', 'No', 'Yes', 'Limited', 'No'],
  ['Stratfor', 'Enterprise', 'No', 'Partial', 'No', 'No'],
]

export default function LandingPage() {
  return (
    <div style={{ background: 'var(--bg-base)' }}>
      <LandingClient features={FEATURES as never} />

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="mb-8 text-3xl font-semibold" style={{ color: 'var(--text-primary)' }}>How it works</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {HOW_IT_WORKS.map((item, index) => (
            <div key={item.title} className="rounded-2xl border p-6" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--primary)' }}>0{index + 1}</div>
              <div className="mb-2 text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{item.title}</div>
              <p style={{ color: 'var(--text-muted)' }}>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="rounded-2xl border p-8" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
          <div className="mb-2 text-sm font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--primary)' }}>Social proof</div>
          <div className="text-3xl font-semibold" style={{ color: 'var(--text-primary)' }}>Used by analysts in 30+ countries</div>
          <p className="mt-3 max-w-3xl" style={{ color: 'var(--text-muted)' }}>From individual researchers to multi-seat security teams, CONFLICT OPS is built for people who need signal now, not after six procurement calls and a dull vendor deck.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="mb-6 text-3xl font-semibold" style={{ color: 'var(--text-primary)' }}>Competitor comparison</h2>
        <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr style={{ color: 'var(--text-muted)' }}>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Self-serve</th>
                <th className="px-4 py-3">Real-time</th>
                <th className="px-4 py-3">AI analysis</th>
                <th className="px-4 py-3">Prediction markets</th>
              </tr>
            </thead>
            <tbody>
              {COMPETITORS.map((row) => (
                <tr key={row[0]} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  {row.map((cell, index) => <td key={`${row[0]}-${index}`} className="px-4 py-3" style={{ color: index === 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="rounded-2xl border p-8" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
          <div className="mb-2 text-sm font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--primary)' }}>Waitlist</div>
          <h2 className="mb-3 text-3xl font-semibold" style={{ color: 'var(--text-primary)' }}>Get launch updates without the spam ritual</h2>
          <p className="mb-6" style={{ color: 'var(--text-muted)' }}>Drop your email and we’ll send product updates, launch notes, and access announcements.</p>
          <WaitlistForm />
        </div>
      </section>
    </div>
  )
}
