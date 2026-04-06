'use client'

import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Shield, ArrowRight, Scale } from 'lucide-react'

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

const TERMS_SECTIONS = [
  {
    title: 'Acceptance of Terms',
    content: 'By accessing or using CONFLICTRADAR ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service.\n\nThe Service is operated by CONFLICTRADAR (conflictradar.co). These terms apply to all users, including free trial users, paid subscribers, and Enterprise customers.',
  },
  {
    title: 'Description of Service',
    content: 'CONFLICTRADAR is a geopolitical intelligence aggregation and analysis platform. The Service aggregates publicly available data from third-party sources and provides tools for analysis, forecasting, and reporting.\n\nTHE SERVICE IS FOR INFORMATIONAL PURPOSES ONLY. Nothing on the platform constitutes professional security advice, military intelligence, or legal counsel. Users are solely responsible for decisions made based on information provided by the Service.',
  },
  {
    title: 'Prohibited Uses',
    content: 'You may not use the Service:\n• To plan, facilitate, or support any illegal activity\n• To target, harass, or surveil individuals\n• To produce or distribute disinformation\n• To circumvent, disable, or interfere with security features\n• To scrape or bulk-download data beyond your plan\'s API limits\n• For any purpose that violates applicable laws or regulations\n• To resell or redistribute raw data without explicit written permission\n\nViolation of these terms will result in immediate account termination.',
  },
  {
    title: 'Data and Intelligence Disclaimer',
    content: 'All data displayed on the Service is aggregated from publicly available third-party sources. CONFLICTRADAR:\n• Makes no warranty regarding the accuracy, completeness, or timeliness of any data\n• Does not verify the authenticity of source events\n• Is not responsible for decisions made based on platform data\n• Cannot guarantee continuous availability of third-party data feeds\n\nForecasts and probability estimates are computational outputs, not professional intelligence assessments. They should not be used as the sole basis for security or operational decisions.',
  },
  {
    title: 'Subscription and Billing',
    content: 'Paid plans are billed monthly or annually. All payments are processed by Stripe.\n\n• Free trials last 14 days with full feature access\n• Cancellation takes effect at the end of the current billing period\n• No refunds for partial months\n• We reserve the right to modify pricing with 30 days notice\n• Accounts past due for more than 14 days may be suspended',
  },
  {
    title: 'Intellectual Property',
    content: 'The Service, including all software, design, and documentation, is owned by CONFLICTRADAR. You are granted a limited, non-exclusive, non-transferable license to use the Service for your internal business purposes.\n\nYou may not copy, modify, distribute, or create derivative works from the Service. Third-party data displayed on the platform remains the property of its respective owners and is subject to their licensing terms.',
  },
  {
    title: 'Limitation of Liability',
    content: 'TO THE MAXIMUM EXTENT PERMITTED BY LAW, CONFLICTRADAR SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY.\n\nOUR TOTAL LIABILITY FOR ANY CLAIM ARISING FROM THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS PRIOR TO THE CLAIM.',
  },
  {
    title: 'Termination',
    content: 'We may suspend or terminate your account at any time for violation of these Terms. You may cancel your account at any time from the billing settings page.\n\nUpon termination, your access to the Service will cease and your data will be deleted according to our retention policy.',
  },
  {
    title: 'Changes to Terms',
    content: 'We may update these Terms at any time. We will notify you of material changes via email. Continued use of the Service after changes constitutes acceptance of the new Terms.',
  },
  {
    title: 'Contact',
    content: 'For questions about these Terms:\nEmail: legal@conflictradar.co',
  },
]

export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ background: '#070B11', color: '#fff' }}>
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
          <div className="flex items-center justify-center gap-2 mb-5">
            <Scale size={20} className="text-blue-400" />
            <p className="text-sm font-medium text-blue-400 tracking-wide uppercase">Legal</p>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
            Terms of Service
          </h1>
          <p className="text-base text-white/40 max-w-xl mx-auto leading-relaxed">
            Please read our terms carefully. We&apos;re transparent about how we operate and what we require.
          </p>
          <p className="text-xs text-white/30 mt-4">Last updated: March 2026</p>
        </BlurIn>
      </section>

      {/* Terms Sections */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="space-y-6">
          {TERMS_SECTIONS.map((section, index) => (
            <FadeUp key={section.title} delay={index * 0.05}>
              <motion.div
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 hover:border-white/[0.1] hover:bg-white/[0.03] transition-all"
                whileHover={{ y: -2 }}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex-shrink-0">
                    <div className="w-6 h-6 rounded-full border border-blue-400/40 bg-blue-400/10 flex items-center justify-center text-xs font-semibold text-blue-400">
                      {index + 1}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-white mb-4">{section.title}</h2>
                    <div className="text-sm leading-relaxed text-white/50 whitespace-pre-line">
                      {section.content}
                    </div>
                  </div>
                </div>
              </motion.div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-white/[0.04] py-16 px-6">
        <BlurIn className="max-w-2xl mx-auto text-center">
          <h3 className="text-lg font-semibold text-white mb-3">Questions about these terms?</h3>
          <p className="text-sm text-white/40 mb-6">
            Our legal team is here to help clarify anything in our Terms of Service.
          </p>
          <a
            href="mailto:legal@conflictradar.co"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium border border-blue-400/40 text-blue-400 hover:border-blue-400/60 hover:bg-blue-400/10 transition-all"
          >
            Contact Legal <ArrowRight size={14} />
          </a>
        </BlurIn>
      </section>

      {/* Footer */}
      <section className="border-t border-white/[0.04] py-8 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-xs text-white/20">
            © 2026 CONFLICTRADAR. All rights reserved. See also our <Link href="/privacy" className="text-blue-400 hover:text-blue-300 transition-colors">Privacy Policy</Link>
          </p>
        </div>
      </section>
    </div>
  )
}
