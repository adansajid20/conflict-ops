import type { Metadata } from 'next'
import { CookieConsentBanner } from '@/components/ui/CookieConsentBanner'

export const metadata: Metadata = {
  title: 'ConflictRadar — Geopolitical Intelligence Platform',
  description: 'Real-time conflict tracking, AI-powered analysis, and predictive intelligence for analysts, NGOs, journalists, and security teams.',
  openGraph: {
    title: 'ConflictRadar',
    description: 'Geopolitical intelligence that saves lives. Real-time conflict tracking, AI analysis, and predictive intelligence.',
    type: 'website',
  },
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <CookieConsentBanner />
    </>
  )
}
