'use client'

import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Shield, Database, Brain, AlertTriangle, Activity, ArrowRight } from 'lucide-react'

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

const SOURCES = [
  { name: 'GDELT', tier: 'B', freq: '15 min', icon: Database },
  { name: 'ReliefWeb', tier: 'A', freq: '15 min', icon: Activity },
  { name: 'GDACS', tier: 'A', freq: '15 min', icon: Activity },
  { name: 'UNHCR', tier: 'A', freq: '1 hr', icon: Activity },
  { name: 'NASA EONET', tier: 'A', freq: '15 min', icon: Activity },
  { name: 'NASA FIRMS', tier: 'B', freq: '15 min', icon: Database },
  { name: 'USGS', tier: 'A', freq: '5 min', icon: Activity },
  { name: 'NOAA', tier: 'A', freq: '15 min', icon: Activity },
  { name: 'NewsAPI', tier: 'B', freq: '15 min', icon: Database },
  { name: 'News RSS', tier: 'C', freq: '30 min', icon: Database },
  { name: 'Cloudflare Radar', tier: 'B', freq: '1 hr', icon: Database },
  { name: 'ACLED adapter', tier: 'A', freq: 'daily', icon: Activity },
] as const

export default function MethodsPage() {
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
            <Link href="/methods" className="text-sm text-blue-400">Methods</Link>
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
          <p className="text-sm font-medium text-blue-400 tracking-wide uppercase mb-5">Intelligence Methodology</p>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent">
            How we see the world.
          </h1>
          <p className="text-lg text-white/40 max-w-xl mx-auto leading-relaxed">
            Transparent collection, scoring, and enrichment. No magic box. Just a well-lit one.
          </p>
        </BlurIn>
      </section>

      {/* Data Sources Section */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <FadeUp className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <Database size={20} className="text-blue-400" />
            <h2 className="text-2xl font-bold text-white">Data Sources</h2>
          </div>
          <p className="text-white/40 text-sm">Twelve feeds spanning crisis response, environmental monitoring, conflict data, and open-source news</p>
        </FadeUp>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {SOURCES.map((source, i) => {
            const Icon = source.icon
            return (
              <FadeUp key={source.name} delay={i * 0.05}>
                <motion.div
                  whileHover={{ y: -4 }}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-sm hover:border-white/[0.12] transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <Icon size={18} className="text-blue-400/70" />
                    <span className={`text-xs font-semibold px-2 py-1 rounded-md ${
                      source.tier === 'A' ? 'bg-green-500/10 text-green-400' :
                      source.tier === 'B' ? 'bg-blue-500/10 text-blue-400' :
                      'bg-yellow-500/10 text-yellow-400'
                    }`}>
                      Tier {source.tier}
                    </span>
                  </div>
                  <h3 className="font-semibold text-white text-sm mb-1">{source.name}</h3>
                  <p className="text-xs text-white/40">Updates every {source.freq}</p>
                </motion.div>
              </FadeUp>
            )
          })}
        </div>
      </section>

      {/* Methodology Section */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <FadeUp className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <Brain size={20} className="text-blue-400" />
            <h2 className="text-2xl font-bold text-white">Methodology</h2>
          </div>
          <p className="text-white/40 text-sm">How we process raw signals into actionable intelligence</p>
        </FadeUp>

        <div className="space-y-4">
          {[
            {
              title: 'Classification',
              desc: 'Events are classified from source metadata, keyword signals, and structured AI enrichment when enabled.'
            },
            {
              title: 'Severity Scoring',
              desc: 'Severity scores combine source credibility, casualty cues, escalation markers, and geostrategic relevance.'
            },
            {
              title: 'Deduplication',
              desc: 'Deduplication clusters same-story reports across sources to reduce alert spam and improve corroboration confidence.'
            },
          ].map((item, i) => (
            <FadeUp key={item.title} delay={i * 0.08}>
              <motion.div
                whileHover={{ x: 4 }}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-blue-500/30 transition-all"
              >
                <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-white/50">{item.desc}</p>
              </motion.div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* Known Limitations Section */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <FadeUp className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle size={20} className="text-amber-400" />
            <h2 className="text-2xl font-bold text-white">Known Limitations</h2>
          </div>
          <p className="text-white/40 text-sm">We are transparent about where our coverage is strong and where it needs improvement</p>
        </FadeUp>

        <FadeUp>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-8 backdrop-blur-sm">
            <ul className="space-y-4">
              {[
                'Coverage is strongest where open-source reporting density is high; some regions remain sparse or delayed.',
                'Language support is broad but not universal; machine translation can blur nuance and entity relationships.',
                'AI confidence thresholds reduce noise, but sub-threshold signals can still be relevant and require analyst review.',
              ].map((limitation, i) => (
                <li key={i} className="flex gap-3">
                  <AlertTriangle size={16} className="text-amber-400/60 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-white/50">{limitation}</span>
                </li>
              ))}
            </ul>
          </div>
        </FadeUp>
      </section>

      {/* AI Disclosure Section */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <FadeUp className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <Brain size={20} className="text-blue-400" />
            <h2 className="text-2xl font-bold text-white">AI Disclosure</h2>
          </div>
          <p className="text-white/40 text-sm">How artificial intelligence augments our intelligence pipeline</p>
        </FadeUp>

        <div className="space-y-4">
          {[
            {
              title: 'AI Applications',
              desc: 'AI is used for translation, entity extraction, event normalization, report drafting, and confidence scoring.'
            },
            {
              title: 'Model Class',
              desc: 'Primary models include Gemini-class structured extraction and OpenAI-class assistance for workflow augmentation.'
            },
            {
              title: 'Safety Controls',
              desc: 'Confidence thresholds are enforced before AI-enriched fields influence downstream automation.'
            },
          ].map((item, i) => (
            <FadeUp key={item.title} delay={i * 0.08}>
              <motion.div
                whileHover={{ x: 4 }}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-blue-500/30 transition-all"
              >
                <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-white/50">{item.desc}</p>
              </motion.div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-white/[0.04] py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <BlurIn>
            <h2 className="text-2xl font-bold text-white mb-4">Ready to explore our intelligence?</h2>
            <p className="text-white/40 mb-8">Start with a free account. No credit card required.</p>
            <div className="flex items-center justify-center gap-4">
              <Link href="/sign-up" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold bg-white text-gray-900 hover:bg-gray-100 transition-colors">
                Get Started <ArrowRight size={16} />
              </Link>
              <Link href="/features" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold border border-white/[0.12] text-white/70 hover:text-white hover:border-white/25 transition-all">
                Learn More
              </Link>
            </div>
          </BlurIn>
        </div>
      </section>
    </div>
  )
}
