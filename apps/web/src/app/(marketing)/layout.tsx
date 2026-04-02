import type { Metadata } from 'next'
import Link from 'next/link'
import { CookieConsentBanner } from '@/components/ui/CookieConsentBanner'

export const metadata: Metadata = {
  title: 'CONFLICTRADAR — Geopolitical Intelligence Platform',
  description: 'Enterprise-grade geopolitical intelligence for analysts, security teams, and risk professionals. Real-time conflict tracking, forecasting, and threat assessment.',
  openGraph: {
    title: 'CONFLICTRADAR',
    description: 'Palantir-grade geopolitical intelligence. Built for serious analysts.',
    type: 'website',
  },
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <footer className="border-t mt-16" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-wrap items-center gap-4 text-xs mono" style={{ color: 'var(--text-muted)' }}>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/status">Status</Link>
          <Link href="/methods">Methods</Link>
          <Link href="/security">Security</Link>
        </div>
      </footer>
      <CookieConsentBanner />
    </>
  )
}
