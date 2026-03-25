import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'CONFLICT OPS — Geopolitical Intelligence Platform',
  description: 'Real-time conflict tracking, AI forecasting, and threat assessment. Enterprise-grade intelligence for analysts, security teams, and risk professionals. Free trial.',
  openGraph: {
    title: 'CONFLICT OPS — Geopolitical Intelligence',
    description: 'Palantir-grade intelligence. Self-serve. Mission-ready.',
    type: 'website',
    url: 'https://conflictradar.co',
  },
  twitter: { card: 'summary_large_image', title: 'CONFLICT OPS', description: 'Real-time geopolitical intelligence platform' },
  alternates: { canonical: 'https://conflictradar.co/landing' },
}

const NAV = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/methods', label: 'Methods' },
  { href: '/wire', label: 'Live Wire' },
]

const STATS = [
  { label: 'Data Sources', value: '5+', sub: 'UN, NASA, GDELT' },
  { label: 'Update Cadence', value: '15m', sub: 'Fast lane ingest' },
  { label: 'Languages', value: '250+', sub: 'GDELT coverage' },
  { label: 'Uptime SLA', value: '99.9%', sub: 'Enterprise tier' },
]

const FEATURES = [
  { icon: '◈', title: 'Real-Time Intel Feed', desc: 'Multi-source ingest every 15 minutes. GDELT, UN OCHA, GDACS, UNHCR, NASA — all unified.' },
  { icon: '⊞', title: 'Conflict Map', desc: 'PostGIS-powered map with event clustering, maritime zones, AIS vessel tracking, and thermal overlays.' },
  { icon: '◷', title: 'AI Forecasting', desc: 'Monte Carlo risk forecasts (P10/P50/P90). Gemini-powered extraction. Zero hallucinated predictions.' },
  { icon: '⚠', title: 'Alert Engine', desc: 'Priority Intelligence Requirements with 5-level escalation ladder. Email alerts on trigger.' },
  { icon: '⊙', title: 'Tracking Layer', desc: 'AIS vessel + ADS-B flight tracking. Dark vessel detection. Military callsign recognition.' },
  { icon: '⊢', title: 'REST API', desc: 'Bearer-authenticated API with rate limiting. HMAC-signed webhooks. Business plan.' },
]

const PLANS = [
  { name: 'Individual', price: '$9/mo', cta: 'Start free', highlight: false },
  { name: 'Pro', price: '$29/mo', cta: 'Start free', highlight: true },
  { name: 'Business', price: '$299/mo', cta: 'Start free', highlight: false },
  { name: 'Enterprise', price: 'Custom', cta: 'Contact us', highlight: false },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {/* Nav */}
      <nav style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-glass)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/landing" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 16, letterSpacing: '0.15em', color: 'var(--primary)', textDecoration: 'none' }}>
            CONFLICT OPS
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            {NAV.map(n => (
              <Link key={n.href} href={n.href} style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', fontFamily: 'JetBrains Mono, monospace', transition: 'color 0.15s' }}>
                {n.label}
              </Link>
            ))}
            <Link href="/sign-in" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', fontFamily: 'JetBrains Mono, monospace' }}>Sign in</Link>
            <Link href="/sign-up" style={{ padding: '6px 16px', backgroundColor: 'var(--primary)', color: '#000', borderRadius: 6, fontSize: 12, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em', textDecoration: 'none' }}>
              Start Free →
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '96px 24px 80px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', padding: '4px 12px', border: '1px solid rgba(0,255,136,0.3)', borderRadius: 20, marginBottom: 24, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--primary)', letterSpacing: '0.12em' }}>
          ● LIVE — GDELT + UN + NASA INGESTING NOW
        </div>
        <h1 style={{ fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 20, background: 'linear-gradient(135deg, #F0F6FC 0%, #C9D1D9 60%, #7D8590 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Geopolitical Intelligence<br />for the 99%
        </h1>
        <p style={{ fontSize: 'clamp(16px, 2.5vw, 20px)', color: 'var(--text-muted)', maxWidth: 600, margin: '0 auto 40px', lineHeight: 1.6 }}>
          Real-time conflict tracking, AI forecasting, and threat assessment. Self-serve. Mission-ready. No procurement cycle.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/sign-up" style={{ padding: '14px 32px', backgroundColor: 'var(--primary)', color: '#000', borderRadius: 8, fontSize: 14, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em', textDecoration: 'none', boxShadow: '0 0 24px rgba(0,255,136,0.2)' }}>
            START FREE TRIAL →
          </Link>
          <Link href="/wire" style={{ padding: '14px 32px', backgroundColor: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em', textDecoration: 'none' }}>
            VIEW LIVE WIRE
          </Link>
        </div>
        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-disabled)', fontFamily: 'JetBrains Mono, monospace' }}>
          14-day free trial · No credit card required
        </p>
      </section>

      {/* Stats bar */}
      <section style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 24 }}>
          {STATS.map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--primary)', fontFamily: 'JetBrains Mono, monospace' }}>{s.value}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 2 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.15em', marginBottom: 12 }}>PLATFORM CAPABILITIES</div>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
            Everything an analyst needs
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ padding: '24px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, transition: 'border-color 0.15s, box-shadow 0.15s' }}>
              <div style={{ fontSize: 24, marginBottom: 12, color: 'var(--primary)' }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.04em' }}>{f.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section style={{ backgroundColor: 'var(--bg-surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.01em' }}>Simple pricing</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>14-day free trial on all plans. No credit card required.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, maxWidth: 900, margin: '0 auto' }}>
            {PLANS.map(p => (
              <div key={p.name} style={{ padding: '24px 20px', backgroundColor: p.highlight ? 'var(--primary-dim)' : 'var(--bg-surface-2)', border: `1px solid ${p.highlight ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8, color: p.highlight ? 'var(--primary)' : 'var(--text-muted)' }}>{p.name.toUpperCase()}</div>
                <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 16, color: 'var(--text-primary)' }}>{p.price}</div>
                <Link href={p.name === 'Enterprise' ? 'mailto:enterprise@conflictradar.co' : '/sign-up'}
                  style={{ display: 'block', padding: '8px 0', backgroundColor: p.highlight ? 'var(--primary)' : 'transparent', color: p.highlight ? '#000' : 'var(--primary)', border: p.highlight ? 'none' : '1px solid var(--primary)', borderRadius: 6, fontSize: 12, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', textDecoration: 'none', transition: 'opacity 0.15s' }}>
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', marginTop: 24 }}>
            <Link href="/pricing" style={{ color: 'var(--primary)', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>Compare all features →</Link>
          </p>
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 700, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, marginBottom: 16 }}>
          Ready to see the world clearly?
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 16, marginBottom: 32 }}>
          Join analysts, security teams, and researchers using CONFLICT OPS to stay ahead.
        </p>
        <Link href="/sign-up" style={{ display: 'inline-block', padding: '16px 40px', backgroundColor: 'var(--primary)', color: '#000', borderRadius: 8, fontSize: 15, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em', textDecoration: 'none', boxShadow: '0 0 32px rgba(0,255,136,0.2)' }}>
          START FREE — 14 DAYS →
        </Link>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: 'var(--primary)', fontSize: 14, letterSpacing: '0.12em' }}>CONFLICT OPS</div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              { href: '/features', label: 'Features' }, { href: '/pricing', label: 'Pricing' },
              { href: '/methods', label: 'Methods' }, { href: '/wire', label: 'Wire' },
              { href: '/status', label: 'Status' }, { href: '/privacy', label: 'Privacy' },
              { href: '/terms', label: 'Terms' },
            ].map(l => (
              <Link key={l.href} href={l.href} style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>{l.label}</Link>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-disabled)', fontFamily: 'JetBrains Mono, monospace' }}>
            © 2025 conflictradar.co
          </div>
        </div>
      </footer>

    </div>
  )
}
