import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Intelligence Methods — CONFLICTRADAR',
  description: 'How CONFLICTRADAR collects, processes, and verifies geopolitical intelligence.',
}

const SOURCES = [
  ['GDELT', 'B', '15 min'], ['ReliefWeb', 'A', '15 min'], ['GDACS', 'A', '15 min'], ['UNHCR', 'A', '1 hr'],
  ['NASA EONET', 'A', '15 min'], ['NASA FIRMS', 'B', '15 min'], ['USGS', 'A', '5 min'], ['NOAA', 'A', '15 min'],
  ['NewsAPI', 'B', '15 min'], ['News RSS', 'C', '30 min'], ['Cloudflare Radar', 'B', '1 hr'], ['ACLED-ready adapter', 'A', 'daily'],
] as const

export default function MethodsPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div className="max-w-4xl mx-auto px-6 py-20 space-y-10">
        <div>
          <div className="text-xs mono tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>INTELLIGENCE METHODOLOGY</div>
          <h1 className="text-4xl font-bold tracking-widest uppercase mb-4" style={{ color: 'var(--primary)' }}>HOW IT WORKS</h1>
          <p className="text-lg max-w-2xl" style={{ color: 'var(--text-muted)' }}>Transparent collection, scoring, and enrichment. No magic box. Just a well-lit one.</p>
        </div>
        <section className="rounded border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
          <h2 className="text-sm mono font-bold mb-4">DATA SOURCES</h2>
          <div className="grid gap-3 md:grid-cols-2">{SOURCES.map(([name, tier, freq]) => <div key={name} className="rounded border p-3" style={{ borderColor: 'var(--border)' }}><div className="font-bold mono text-sm">{name}</div><div className="text-xs" style={{ color: 'var(--text-muted)' }}>Reliability tier {tier} · Update frequency {freq}</div></div>)}</div>
        </section>
        <section className="rounded border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
          <h2 className="text-sm mono font-bold mb-4">METHODOLOGY</h2>
          <ul className="space-y-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <li>Events are classified from source metadata, keyword signals, and structured AI enrichment when enabled.</li>
            <li>Severity scores combine source credibility, casualty cues, escalation markers, and geostrategic relevance.</li>
            <li>Deduplication clusters same-story reports across sources to reduce alert spam and improve corroboration confidence.</li>
          </ul>
        </section>
        <section className="rounded border p-6" style={{ borderColor: 'var(--alert-amber)', backgroundColor: 'rgba(245,158,11,0.05)' }}>
          <h2 className="text-sm mono font-bold mb-4" style={{ color: 'var(--alert-amber)' }}>KNOWN LIMITATIONS</h2>
          <ul className="space-y-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <li>Coverage is strongest where open-source reporting density is high; some regions remain sparse or delayed.</li>
            <li>Language support is broad but not universal; machine translation can blur nuance and entity relationships.</li>
            <li>AI confidence thresholds reduce noise, but sub-threshold signals can still be relevant and require analyst review.</li>
          </ul>
        </section>
        <section className="rounded border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
          <h2 className="text-sm mono font-bold mb-4">AI DISCLOSURE</h2>
          <ul className="space-y-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <li>AI is used for translation, entity extraction, event normalization, report drafting, and confidence scoring.</li>
            <li>Primary models include Gemini-class structured extraction and OpenAI-class assistance for workflow augmentation.</li>
            <li>Confidence thresholds are enforced before AI-enriched fields influence downstream automation.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
