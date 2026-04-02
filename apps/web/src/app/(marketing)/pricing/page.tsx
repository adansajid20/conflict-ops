import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Pricing — CONFLICTRADAR',
  description: 'Simple, transparent pricing. From individual analysts to enterprise security teams.',
}

const PLANS = [
  { id: 'individual', name: 'Individual', price: '$9', period: '/mo', desc: 'For solo analysts and researchers', features: ['3 missions', '7-day event history', 'Intel feed + map', 'Basic forecasts', 'Email alerts'] },
  { id: 'pro', name: 'Pro', price: '$29', period: '/mo', desc: 'For professional analysts', features: ['25 missions', '180-day history', 'Workbench tools', 'Custom alert rules (5)', 'Scheduled briefs'] },
  { id: 'business', name: 'Business', price: '$299', period: '/mo', desc: 'For teams and security firms', features: ['Unlimited missions', '365-day history', 'API + webhooks', 'Slack/PagerDuty integrations', 'Team seats', 'Audit logs'] },
  { id: 'enterprise', name: 'Enterprise', price: 'Custom', period: '', desc: 'For large organisations', features: ['Unlimited everything', 'SSO/SAML', 'White-label branding', 'Custom data sources', 'Dedicated support', 'Contracting + SLA'] },
] as const

const COMPARISON = [
  ['Real-time event feed', 'Yes', 'Yes', 'Yes', 'Yes'],
  ['AI co-pilot', 'No', 'Yes', 'Yes', 'Yes'],
  ['Custom alert rules', 'No', '5', 'Unlimited', 'Unlimited'],
  ['REST API', 'No', 'No', 'Yes', 'Yes'],
  ['Slack / PagerDuty', 'No', 'No', 'Yes', 'Yes'],
  ['White-label', 'No', 'No', 'No', 'Yes'],
]

export default function PricingPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <nav className="border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/landing" className="font-bold tracking-widest mono" style={{ color: 'var(--primary)' }}>CONFLICTRADAR</Link>
          <div className="flex items-center gap-6 text-sm mono">
            <Link href="/features" style={{ color: 'var(--text-muted)' }}>Features</Link>
            <Link href="/pricing" style={{ color: 'var(--primary)' }}>Pricing</Link>
            <Link href="/wire" style={{ color: 'var(--text-muted)' }}>Live Wire</Link>
            <Link href="/sign-in" style={{ color: 'var(--text-muted)' }}>Sign In</Link>
            <Link href="/sign-up" className="rounded px-4 py-1.5 text-xs font-bold" style={{ backgroundColor: 'var(--primary)', color: '#000' }}>Start Free</Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-16 text-center">
          <h1 className="mb-4 text-4xl font-bold tracking-widest uppercase" style={{ color: 'var(--primary)' }}>Transparent pricing</h1>
          <p className="text-lg" style={{ color: 'var(--text-muted)' }}>Four tiers. Clear tradeoffs. No mystery enterprise tax until you actually need enterprise things.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <div key={plan.id} className="flex flex-col rounded border p-6" style={{ borderColor: plan.id === 'pro' ? 'var(--primary)' : 'var(--border)', backgroundColor: plan.id === 'pro' ? 'rgba(0,255,136,0.03)' : 'var(--bg-surface)' }}>
              {plan.id === 'pro' ? <div className="mb-3 text-xs font-bold tracking-widest mono" style={{ color: 'var(--primary)' }}>◆ MOST POPULAR</div> : null}
              <h3 className="mb-1 font-bold tracking-widest mono">{plan.name.toUpperCase()}</h3>
              <p className="mb-4 text-xs" style={{ color: 'var(--text-muted)' }}>{plan.desc}</p>
              <div className="mb-6"><span className="text-3xl font-bold">{plan.price}</span><span className="text-sm" style={{ color: 'var(--text-muted)' }}>{plan.period}</span></div>
              <ul className="mb-6 flex-1 space-y-2">
                {plan.features.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-muted)' }}><span style={{ color: 'var(--alert-green)' }}>✓</span>{feature}</li>)}
              </ul>
              <Link href={plan.id === 'enterprise' ? 'mailto:enterprise@conflictradar.co' : '/sign-up'} className="block rounded py-2.5 text-center text-sm font-bold tracking-wider mono" style={{ backgroundColor: plan.id === 'pro' ? 'var(--primary)' : 'transparent', color: plan.id === 'pro' ? '#000' : 'var(--primary)', border: plan.id === 'pro' ? 'none' : '1px solid var(--primary)' }}>{plan.id === 'enterprise' ? 'Contact Sales' : 'Start Free Trial'}</Link>
            </div>
          ))}
        </div>

        <div className="mt-16 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr style={{ color: 'var(--text-muted)' }}>
                <th className="px-4 py-3">Feature</th>
                <th className="px-4 py-3">Individual</th>
                <th className="px-4 py-3">Pro</th>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row[0]} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  {row.map((cell, index) => <td key={`${row[0]}-${index}`} className="px-4 py-3" style={{ color: index === 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>All plans include a 14-day free trial. No credit card required to start. Questions? <a href="mailto:support@conflictradar.co" style={{ color: 'var(--primary)' }}>support@conflictradar.co</a></p>
      </div>
    </div>
  )
}
