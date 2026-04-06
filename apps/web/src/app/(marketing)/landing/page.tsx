import type { Metadata } from 'next'
import { LandingClient } from '@/components/landing/LandingClient'

export const metadata: Metadata = {
  title: 'ConflictRadar — Geopolitical Intelligence That Saves Lives',
  description: 'Real-time conflict tracking, AI-powered analysis, and predictive intelligence. Built for analysts, NGOs, journalists, and security teams. Free to start.',
  openGraph: {
    title: 'ConflictRadar — Intelligence That Saves Lives',
    description: 'Real-time conflict tracking, AI-powered analysis, and predictive intelligence for the organizations that need it most.',
    type: 'website',
  },
}

export default function LandingPage() {
  return <LandingClient features={[]} />
}
