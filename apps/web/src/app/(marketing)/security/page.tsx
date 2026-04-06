'use client'

import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Shield, Lock, Server, CheckCircle, ArrowRight, Mail } from 'lucide-react'

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

const badges = [
  { name: 'SOC 2 Type II', status: 'In progress', icon: Shield },
  { name: 'GDPR', status: 'Compliant', icon: Lock },
  { name: 'ISO 27001', status: 'Roadmap', icon: CheckCircle },
] as const

const infrastructure = [
  { name: 'Supabase', detail: 'SOC 2', description: 'Primary data plane and managed Postgres' },
  { name: 'Vercel', detail: 'SOC 2', description: 'Deployment edge and hosting' },
  { name: 'Clerk', detail: 'SOC 2', description: 'Authentication and session security' },
  { name: 'Upstash', detail: 'SOC 2', description: 'Rate limiting, cache, and operational controls' },
]

export default function SecurityPage() {
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

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <BlurIn className="max-w-3xl mx-auto text-center">
          <p className="text-sm font-medium text-blue-400 tracking-wide uppercase mb-5">Trust Center</p>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent">
            Security by design.
          </h1>
          <p className="text-lg text-white/40 max-w-2xl mx-auto leading-relaxed">
            TLS 1.3 across the public edge, encrypted data at rest and in transit, and zero plaintext secrets. Your data deserves better.
          </p>
        </BlurIn>
      </section>

      {/* Trust Badges */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          {badges.map(({ name, status, icon: Icon }, i) => (
            <FadeUp key={name} delay={i * 0.1}>
              <motion.div
                whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(59,130,246,0.1)' }}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 flex flex-col items-center text-center backdrop-blur transition-all"
              >
                <div className="mb-4 p-3 rounded-full bg-blue-400/10">
                  <Icon size={24} className="text-blue-400" />
                </div>
                <h3 className="text-white font-semibold mb-2">{name}</h3>
                <p className="text-blue-400 text-sm font-medium">{status}</p>
              </motion.div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* Security Features */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <BlurIn className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">Encryption & Data Protection</h2>
          <p className="text-white/40">Industry-standard protocols and zero-trust architecture across every layer.</p>
        </BlurIn>

        <div className="grid gap-5 md:grid-cols-2">
          {[
            { icon: Lock, title: 'Data in Transit', desc: 'TLS 1.3 encryption on all connections with forward secrecy' },
            { icon: Server, title: 'Data at Rest', desc: 'AES-256 encryption for all stored data with key rotation' },
            { icon: Shield, title: 'Zero Secrets', desc: 'No plaintext secrets in application storage or logs' },
            { icon: Lock, title: 'Regional Residency', desc: 'EU and US data residency options for compliance' },
          ].map(({ icon: Icon, title, desc }, i) => (
            <FadeUp key={title} delay={i * 0.08}>
              <motion.div
                whileHover={{ y: -2 }}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 backdrop-blur transition-all"
              >
                <Icon size={24} className="text-blue-400 mb-4" />
                <h3 className="text-white font-semibold mb-2">{title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* Infrastructure */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <BlurIn className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">Infrastructure & Partners</h2>
          <p className="text-white/40">Built on globally trusted platforms with demonstrated security practices.</p>
        </BlurIn>

        <div className="grid gap-4">
          {infrastructure.map((item, i) => (
            <FadeUp key={item.name} delay={i * 0.08}>
              <motion.div
                whileHover={{ x: 4 }}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 backdrop-blur transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-white font-semibold mb-1">{item.name}</h3>
                    <p className="text-white/40 text-sm mb-3">{item.description}</p>
                  </div>
                  <div className="px-3 py-1.5 rounded-full bg-blue-400/10 border border-blue-400/20">
                    <span className="text-xs font-medium text-blue-400">{item.detail}</span>
                  </div>
                </div>
              </motion.div>
            </FadeUp>
          ))}
        </div>

        <FadeUp delay={infrastructure.length * 0.08} className="mt-6">
          <motion.div
            whileHover={{ x: 4 }}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 backdrop-blur transition-all"
          >
            <h3 className="text-white font-semibold mb-2">Regional Support</h3>
            <p className="text-white/40 text-sm">EU and US data residency options available for all plans to meet local compliance requirements.</p>
          </motion.div>
        </FadeUp>
      </section>

      {/* Responsible Disclosure */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <BlurIn className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">Responsible Disclosure</h2>
          <p className="text-white/40">Found something sharp? We take security seriously and appreciate the disclosure.</p>
        </BlurIn>

        <FadeUp>
          <motion.div
            whileHover={{ y: -4 }}
            className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-10 backdrop-blur transition-all"
          >
            <div className="flex gap-6">
              <div className="flex-shrink-0">
                <div className="p-3 rounded-full bg-blue-400/10">
                  <Mail size={24} className="text-blue-400" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-3">Report a Vulnerability</h3>
                <p className="text-white/40 mb-4 leading-relaxed">
                  Found a security issue? Report it to <a href="mailto:security@conflictradar.co" className="text-blue-400 hover:text-blue-300 transition-colors">security@conflictradar.co</a>. Include reproduction steps, impact assessment, and any proof-of-concept details. We prefer signal over drama.
                </p>
                <p className="text-white/50 text-sm">Expected response time: 48 hours. We&apos;re committed to working with security researchers to resolve issues responsibly.</p>
              </div>
            </div>
          </motion.div>
        </FadeUp>
      </section>

      {/* CTA Section */}
      <section className="border-t border-white/[0.04] py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <BlurIn>
            <h2 className="text-3xl font-bold text-white mb-4">Ready to get started?</h2>
            <p className="text-white/40 mb-8">Start free and upgrade when you need more. We&apos;re here to help.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link href="/sign-up" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-colors">
                  Get Started Free <ArrowRight size={16} />
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link href="/pricing" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/[0.12] text-white font-semibold hover:border-white/25 transition-colors">
                  View Pricing
                </Link>
              </motion.div>
            </div>
          </BlurIn>
        </div>
      </section>
    </div>
  )
}
