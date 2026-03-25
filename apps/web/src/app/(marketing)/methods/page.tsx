import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Intelligence Methods — CONFLICT OPS',
  description: 'How CONFLICT OPS collects, processes, and verifies geopolitical intelligence. Our methodology, data sources, and analysis framework.',
}

const METHODS = [
  {
    step: '01', title: 'COLLECTION',
    desc: 'Multi-source ingestion runs every 15 minutes across 5 primary data streams.',
    items: [
      { name: 'GDELT Project', detail: 'Global news monitoring across 250+ languages. 15-minute update cadence. Covers 65+ countries.' },
      { name: 'ReliefWeb (UN OCHA)', detail: 'United Nations humanitarian and conflict reports. Structured data on displaced persons, crises, and actors.' },
      { name: 'GDACS', detail: 'Global Disaster Alert and Coordination System. Red/Orange/Green alert levels for complex emergencies.' },
      { name: 'UNHCR', detail: 'Displacement data as a leading conflict indicator. Surge detection triggers elevated risk flags.' },
      { name: 'NASA EONET + FIRMS', detail: 'Natural event tracking overlaid on conflict zones. Wildfire, flood, and thermal anomaly detection.' },
    ],
  },
  {
    step: '02', title: 'PROCESSING',
    desc: 'Raw events run through a two-stage processing pipeline.',
    items: [
      { name: 'Fast Lane (15 min)', detail: 'Deduplication, normalization, geolocation extraction, severity scoring. Lightweight — no LLM calls.' },
      { name: 'Heavy Lane (30 min)', detail: 'Gemini 2.0 Flash AI enrichment: entity extraction, actor identification, translation, structured output.' },
      { name: 'Embeddings', detail: 'Each event gets a 1536-dimension semantic embedding for similarity search and clustering.' },
      { name: 'Safe Mode', detail: 'When provider issues detected, heavy lane pauses. Cached snapshots serve all read requests.' },
    ],
  },
  {
    step: '03', title: 'ANALYSIS',
    desc: 'Multiple analytical frameworks applied to processed events.',
    items: [
      { name: 'Monte Carlo Forecasting', detail: '1,000 iterations per forecast. P10/P50/P90 risk distributions. Score NULL if event_count < 3 — no hallucinated predictions.' },
      { name: 'Escalation Ladder', detail: '7-day rolling window. 5-level assessment: STABLE → WATCH → CAUTION → ELEVATED → WAR. Rule-based, auditable.' },
      { name: 'ACH Matrix', detail: 'Analysis of Competing Hypotheses. Structured evidence weighting. Inconsistency scoring.' },
      { name: 'Geoverification', detail: '8-method OSINT verification queue. 5-tier confidence system: Confirmed → Probable → Possible → Unverified → False.' },
    ],
  },
  {
    step: '04', title: 'DISSEMINATION',
    desc: 'Intelligence delivered via multiple channels.',
    items: [
      { name: 'Priority Intelligence Requirements', detail: 'User-defined PIRs fire alerts when conditions match. 5-level escalation with email notification.' },
      { name: 'Weekly Brief', detail: 'Automated Monday morning intelligence summary for Pro+ subscribers.' },
      { name: 'REST API', detail: 'Authenticated access to event feed, forecasts, and alerts. HMAC-signed webhooks for Business plans.' },
      { name: 'Export', detail: 'JSON/CSV export of any time-windowed dataset.' },
    ],
  },
]

const LIMITATIONS = [
  'Open-source data only. Classified or intercepted intelligence is not used.',
  'ACLED conflict data not included (commercial license required). Covered by ReliefWeb + GDELT overlap.',
  'AIS vessel positions may be spoofed. Dark vessel detection is probabilistic, not certain.',
  'AI extraction may introduce errors. All AI-enriched fields are labeled and auditable.',
  'Forecasts are probabilistic estimates, not predictions. P90 is not certainty.',
]

export default function MethodsPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <nav className="border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/landing" className="font-bold tracking-widest mono" style={{ color: 'var(--primary)' }}>
            CONFLICT OPS
          </Link>
          <div className="flex items-center gap-6 text-sm mono">
            <Link href="/features" style={{ color: 'var(--text-muted)' }}>Features</Link>
            <Link href="/pricing" style={{ color: 'var(--text-muted)' }}>Pricing</Link>
            <Link href="/methods" style={{ color: 'var(--primary)' }}>Methods</Link>
            <Link href="/sign-up" className="px-4 py-1.5 rounded text-xs font-bold"
              style={{ backgroundColor: 'var(--primary)', color: '#000' }}>
              Start Free
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="mb-12">
          <div className="text-xs mono tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
            INTELLIGENCE METHODOLOGY
          </div>
          <h1 className="text-4xl font-bold tracking-widest uppercase mb-4" style={{ color: 'var(--primary)' }}>
            HOW IT WORKS
          </h1>
          <p className="text-lg max-w-2xl" style={{ color: 'var(--text-muted)' }}>
            Transparent, auditable, and open-source first. Every data source, processing step, and analytical method is documented here.
          </p>
        </div>

        {METHODS.map(m => (
          <div key={m.step} className="mb-12">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-3xl font-bold mono" style={{ color: 'var(--border)' }}>{m.step}</span>
              <div>
                <h2 className="text-xl font-bold tracking-widest" style={{ color: 'var(--primary)' }}>{m.title}</h2>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{m.desc}</p>
              </div>
            </div>
            <div className="grid gap-3 pl-16">
              {m.items.map(item => (
                <div key={item.name} className="p-4 rounded border"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                  <div className="font-bold mono text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{item.name}</div>
                  <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{item.detail}</div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Limitations */}
        <div className="p-6 rounded border" style={{ borderColor: 'var(--alert-amber)', backgroundColor: 'rgba(245,158,11,0.05)' }}>
          <h3 className="font-bold mono tracking-widest mb-4" style={{ color: 'var(--alert-amber)' }}>
            ⚠ KNOWN LIMITATIONS
          </h3>
          <ul className="space-y-2">
            {LIMITATIONS.map((l, i) => (
              <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--alert-amber)' }}>·</span>
                {l}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-12 text-center">
          <Link href="/sign-up" className="inline-block px-10 py-4 rounded font-bold mono tracking-widest"
            style={{ backgroundColor: 'var(--primary)', color: '#000' }}>
            START FREE TRIAL
          </Link>
        </div>
      </div>
    </div>
  )
}
