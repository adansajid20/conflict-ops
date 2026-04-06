'use client'

import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Shield, ArrowRight, Lock } from 'lucide-react'

function BlurIn({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-40px' })
  return <motion.div ref={ref} initial={{ opacity: 0, filter: 'blur(10px)', y: 16 }} animate={isInView ? { opacity: 1, filter: 'blur(0px)', y: 0 } : {}} transition={{ duration: 0.7, delay }} className={className}>{children}</motion.div>
}

function FadeUp({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  return <motion.div ref={ref} initial={{ opacity: 0, y: 24 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay }} className={className}>{children}</motion.div>
}

const SECTIONS = [
  {
    icon: Shield,
    title: '1. Information We Collect',
    body: `We collect information you provide directly to us when you create an account, including your name, email address, and payment information. We also collect information about how you use our services, including log data, device information, and usage statistics.

We collect the following categories of data:
• Account data: name, email, organization name
• Usage data: features accessed, queries made, alerts configured
• Payment data: processed by Stripe — we do not store card numbers
• Analytics: anonymized usage metrics for product improvement`,
  },
  {
    icon: Lock,
    title: '2. How We Use Your Information',
    body: `We use your information to:
• Provide, maintain, and improve our services
• Process transactions and send related information
• Send technical notices, security alerts, and support messages
• Send email notifications you have configured (alerts, weekly briefs)
• Respond to your comments and questions
• Monitor and analyze usage patterns

We do not sell your personal information to third parties.`,
  },
  {
    icon: Shield,
    title: '3. Data Sources and Attribution',
    body: `CONFLICTRADAR aggregates data from publicly available sources including:
• ACLED (Armed Conflict Location & Event Data Project) — acleddata.com
• GDELT Project — gdeltproject.org
• NASA FIRMS — firms.modaps.eosdis.nasa.gov
• AISStream.io — vessel position data
• The OpenSky Network — opensky-network.org
• Metaculus — metaculus.com
• Polymarket — polymarket.com

All source data is attributed within the platform. We do not represent this data as our own original intelligence.`,
  },
  {
    icon: Lock,
    title: '4. Data Retention',
    body: `We retain your data for as long as your account is active or as needed to provide services. Retention periods by plan:
• Free: 24 hours of event history
• Scout: 7 days
• Analyst: 30 days
• Operator: Unlimited (configurable)

You may request deletion of your account and associated data at any time by contacting privacy@conflictradar.co.`,
  },
  {
    icon: Lock,
    title: '5. Security',
    body: `We implement industry-standard security measures including encryption in transit (TLS 1.3), encryption at rest, API key hashing (SHA-256), and access controls. Enterprise customers have access to audit logs for all account activity.

However, no method of transmission over the Internet is 100% secure. We cannot guarantee absolute security.`,
  },
  {
    icon: Shield,
    title: '6. Third-Party Services',
    body: `We use the following third-party services:
• Clerk — authentication and user management (clerk.com)
• Supabase — database hosting (supabase.com)
• Stripe — payment processing (stripe.com)
• Upstash — Redis caching (upstash.com)
• Vercel — hosting (vercel.com)
• Resend — transactional email (resend.com)
• Google Gemini — AI enrichment for event analysis (ai.google.dev)
• Inngest — background job processing (inngest.com)

Each third-party provider has their own privacy policy governing their data practices.`,
  },
  {
    icon: Lock,
    title: '7. Your Rights',
    body: `Depending on your location, you may have the following rights:
• Access: request a copy of your personal data
• Correction: request correction of inaccurate data
• Deletion: request deletion of your account and data
• Portability: receive your data in a machine-readable format
• Objection: object to certain processing of your data

To exercise any of these rights, contact privacy@conflictradar.co.`,
  },
  {
    icon: Shield,
    title: '8. Contact',
    body: `For privacy-related inquiries:
Email: privacy@conflictradar.co
Address: CONFLICTRADAR / conflictradar.co`,
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ background: '#070B11' }}>
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#070B11]/80 border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/landing" className="flex items-center gap-2.5">
            <Shield size={20} className="text-blue-400" />
            <span className="font-bold text-[15px] text-white">ConflictRadar</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/features" className="text-sm text-white/50 hover:text-white transition-colors">Features</Link>
            <Link href="/pricing" className="text-sm text-white/50 hover:text-white transition-colors">Pricing</Link>
            <Link href="/methods" className="text-sm text-white/50 hover:text-white transition-colors">Methods</Link>
            <Link href="/wire" className="text-sm text-white/50 hover:text-white transition-colors">Live Wire</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/sign-in" className="text-sm text-white/60 hover:text-white transition-colors">Sign in</Link>
            <Link href="/sign-up" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-900 hover:bg-gray-100 transition-colors">
              Get Started <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <BlurIn className="max-w-3xl mx-auto text-center">
          <p className="text-sm font-medium text-blue-400 tracking-wide uppercase mb-5">Privacy & Compliance</p>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent">
            Your privacy is paramount.
          </h1>
          <p className="text-lg text-white/40 max-w-xl mx-auto leading-relaxed">
            Clear, transparent policies about how we collect, use, and protect your data.
          </p>
          <p className="text-xs text-white/30 mt-8">Last updated: March 2026</p>
        </BlurIn>
      </section>

      {/* Content */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="space-y-8">
          {SECTIONS.map((section, idx) => {
            const Icon = section.icon
            return (
              <FadeUp key={section.title} delay={idx * 0.05}>
                <motion.div
                  whileHover={{ y: -2 }}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 hover:border-white/[0.12] transition-colors"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="mt-1 flex-shrink-0">
                      <Icon size={24} className="text-blue-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-white">{section.title}</h2>
                  </div>
                  <div className="text-sm leading-relaxed text-white/50 whitespace-pre-line ml-10">
                    {section.body}
                  </div>
                </motion.div>
              </FadeUp>
            )
          })}
        </div>
      </section>

      {/* CTA Footer */}
      <section className="border-t border-white/[0.06] py-16 px-6">
        <BlurIn className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Have questions about your privacy?</h2>
          <p className="text-white/50 mb-8">
            Contact us at{' '}
            <a href="mailto:privacy@conflictradar.co" className="text-blue-400 hover:text-blue-300 transition-colors">
              privacy@conflictradar.co
            </a>
          </p>
          <motion.a
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            href="mailto:privacy@conflictradar.co"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium bg-white text-gray-900 hover:bg-gray-100 transition-colors"
          >
            Get in Touch <ArrowRight size={16} />
          </motion.a>
        </BlurIn>
      </section>

      {/* Bottom note */}
      <section className="border-t border-white/[0.04] py-12 px-6 bg-white/[0.01]">
        <div className="text-center text-xs text-white/30">
          <p>CONFLICTRADAR respects and protects your privacy in accordance with applicable data protection regulations.</p>
        </div>
      </section>
    </div>
  )
}
