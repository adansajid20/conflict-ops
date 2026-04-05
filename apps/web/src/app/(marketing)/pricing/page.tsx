import type { Metadata } from 'next'
import Link from 'next/link'
import { PricingCheckout } from '@/components/pricing/PricingCheckout'
import { PLANS } from '@/lib/pricing/plans'

export const metadata: Metadata = {
  title: 'Pricing — CONFLICTRADAR',
  description: 'Simple, transparent pricing. From individual analysts to enterprise security teams.',
}

const COMPARISON = [
  ['Real-time event feed',    '✓', '✓', '✓', '✓'],
  ['AI Co-pilot',             '–', '–', '✓', '✓'],
  ['Custom alert rules',      '3', '10', '50', '∞'],
  ['REST API',                '–', '–', '✓', '✓'],
  ['Webhooks',                '–', '–', '✓', '✓'],
  ['Actor network',           '–', 'View', '✓', '✓'],
  ['Similarity search',       '–', '–', '✓', '✓'],
  ['Workbench boards',        '–', '–', '–', '✓'],
  ['Prediction engine',       '–', 'View', '✓', '✓'],
  ['Feed history',            '24h', '7d', '30d', '∞'],
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
            <Link href="/sign-in" style={{ color: 'var(--text-muted)' }}>Sign In</Link>
            <Link href="/sign-up" className="rounded px-4 py-1.5 text-xs font-bold" style={{ backgroundColor: 'var(--primary)', color: '#000' }}>Start Free</Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-16 text-center">
          <h1 className="mb-4 text-4xl font-bold tracking-widest uppercase" style={{ color: 'var(--primary)' }}>Transparent pricing</h1>
          <p className="text-lg" style={{ color: 'var(--text-muted)' }}>Four tiers. Clear tradeoffs. No mystery enterprise tax until you actually need it.</p>
        </div>

        <PricingCheckout plans={PLANS} />

        <div className="mt-16 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>Feature</th>
                {['Free','Scout','Analyst','Operator'].map(h => <th key={h} className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row[0]} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  {row.map((cell, i) => (
                    <td key={i} className="px-4 py-3" style={{ color: i === 0 ? 'var(--text-primary)' : cell === '✓' || cell === '∞' ? 'var(--alert-green)' : cell === '–' ? 'var(--text-muted)' : 'var(--primary)' }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          All plans include a 14-day free trial. No credit card required to start.{' '}
          <a href="mailto:support@conflictradar.co" style={{ color: 'var(--primary)' }}>support@conflictradar.co</a>
        </p>
      </div>
    </div>
  )
}
