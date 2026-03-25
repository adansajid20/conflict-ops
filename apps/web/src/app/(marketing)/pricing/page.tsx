import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Pricing — CONFLICT OPS',
  description: 'Simple, transparent pricing. From individual analysts to enterprise security teams.',
}

const PLANS = [
  {
    id: 'individual', name: 'Individual', price: '$9', period: '/mo',
    desc: 'For solo analysts and researchers',
    features: ['3 missions', '7-day event history', 'Intel feed + map', 'Basic forecasts', 'Email alerts'],
    cta: 'Start Free Trial', highlight: false,
  },
  {
    id: 'pro', name: 'Pro', price: '$29', period: '/mo',
    desc: 'For professional analysts',
    features: ['25 missions', '180-day history', 'Everything in Individual', 'Workbench (ACH, scenarios)', 'SAT analysis suite', 'Weekly intelligence brief'],
    cta: 'Start Free Trial', highlight: true,
  },
  {
    id: 'business', name: 'Business', price: '$299', period: '/mo',
    desc: 'For teams and security firms',
    features: ['Unlimited missions', '365-day history', 'Everything in Pro', 'Public REST API', 'Webhooks + integrations', '50 team members', 'Audit logs', 'Satellite imagery', 'Maritime + aviation data packs'],
    cta: 'Start Free Trial', highlight: false,
  },
  {
    id: 'enterprise', name: 'Enterprise', price: 'Custom', period: '',
    desc: 'For large organisations',
    features: ['Unlimited everything', 'SSO/SAML', 'White-label', 'Custom data sources', 'Dedicated support', 'SLA + compliance', 'Insurance + ESG packs'],
    cta: 'Contact Sales', highlight: false,
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <nav className="border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/landing" className="font-bold tracking-widest mono" style={{ color: 'var(--primary)' }}>
            CONFLICT OPS
          </Link>
          <div className="flex items-center gap-6 text-sm mono">
            <Link href="/features" style={{ color: 'var(--text-muted)' }}>Features</Link>
            <Link href="/pricing" style={{ color: 'var(--primary)' }}>Pricing</Link>
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
          <h1 className="text-4xl font-bold tracking-widest uppercase mb-4" style={{ color: 'var(--primary)' }}>
            TRANSPARENT PRICING
          </h1>
          <p className="text-lg" style={{ color: 'var(--text-muted)' }}>
            Enterprise intelligence without the enterprise invoice. 14-day free trial, no card required.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map(plan => (
            <div key={plan.id}
              className="p-6 rounded border flex flex-col"
              style={{
                borderColor: plan.highlight ? 'var(--primary)' : 'var(--border)',
                backgroundColor: plan.highlight ? 'rgba(0,255,136,0.03)' : 'var(--bg-surface)',
              }}>
              {plan.highlight && (
                <div className="text-xs mono font-bold mb-3 tracking-widest" style={{ color: 'var(--primary)' }}>
                  ◆ MOST POPULAR
                </div>
              )}
              <h3 className="font-bold tracking-widest mono mb-1">{plan.name.toUpperCase()}</h3>
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>{plan.desc}</p>
              <div className="mb-6">
                <span className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{plan.price}</span>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{plan.period}</span>
              </div>
              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                    <span style={{ color: 'var(--alert-green)' }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href={plan.id === 'enterprise' ? 'mailto:enterprise@conflictradar.co' : '/sign-up'}
                className="block text-center py-2.5 rounded mono text-sm font-bold tracking-wider"
                style={{
                  backgroundColor: plan.highlight ? 'var(--primary)' : 'transparent',
                  color: plan.highlight ? '#000' : 'var(--primary)',
                  border: plan.highlight ? 'none' : '1px solid var(--primary)',
                }}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center mt-8 text-sm" style={{ color: 'var(--text-muted)' }}>
          All plans include 14-day free trial. No credit card required to start.
          <br />Questions? <a href="mailto:support@conflictradar.co" style={{ color: 'var(--primary)' }}>support@conflictradar.co</a>
        </p>
      </div>
    </div>
  )
}
