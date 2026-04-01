import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Security — CONFLICT OPS',
  description: 'Trust center, controls, infrastructure, and disclosure policy for CONFLICT OPS.',
}

const badges = [
  ['SOC 2 Type II', 'In progress'],
  ['GDPR', 'Compliant'],
  ['ISO 27001', 'Roadmap'],
] as const

export default function SecurityPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div className="max-w-4xl mx-auto px-6 py-20 space-y-10">
        <div>
          <div className="text-xs mono tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>TRUST CENTER</div>
          <h1 className="text-4xl font-bold tracking-widest uppercase mb-4" style={{ color: 'var(--primary)' }}>SECURITY</h1>
          <p className="text-lg max-w-2xl" style={{ color: 'var(--text-muted)' }}>Encrypted data at rest and in transit, TLS 1.3 across the public edge, and zero plaintext secrets in application storage.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">{badges.map(([name, status]) => <div key={name} className="rounded border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}><div className="text-xs mono" style={{ color: 'var(--text-muted)' }}>{name}</div><div className="text-xl font-bold mono mt-2" style={{ color: 'var(--primary)' }}>{status}</div></div>)}</div>
        <section className="rounded border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
          <h2 className="text-sm mono font-bold mb-3">INFRASTRUCTURE & DATA RESIDENCY</h2>
          <ul className="space-y-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <li>Supabase (SOC 2) — primary data plane and managed Postgres.</li>
            <li>Vercel (SOC 2) — deployment edge and hosting.</li>
            <li>Clerk (SOC 2) — authentication and session security.</li>
            <li>Upstash (SOC 2) — rate limiting, cache, and operational controls.</li>
            <li>Regional support: EU and US data residency options.</li>
          </ul>
        </section>
        <section className="rounded border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
          <h2 className="text-sm mono font-bold mb-3">RESPONSIBLE DISCLOSURE</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Found something sharp? Report it to <a href="mailto:security@conflictops.ai" style={{ color: 'var(--primary)' }}>security@conflictops.ai</a>. Include reproduction steps, impact, and any proof-of-concept details. We prefer signal over drama.</p>
        </section>
      </div>
    </div>
  )
}
