import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'CONFLICT OPS — Geopolitical Intelligence Platform',
  description: 'Enterprise-grade geopolitical intelligence for analysts, security teams, and risk professionals. Real-time conflict tracking, forecasting, and threat assessment.',
  openGraph: {
    title: 'CONFLICT OPS',
    description: 'Palantir-grade geopolitical intelligence. Built for serious analysts.',
    type: 'website',
  },
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
