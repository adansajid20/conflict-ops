'use client'

import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import {
  Shield, ArrowRight, Globe, Zap, BarChart3, Bell, Eye, Users,
  Lock, Radio, TrendingUp, Map, Brain, FileText, Crosshair, Plane,
  Sparkles, Rocket,
} from 'lucide-react'

function BlurIn({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  return <motion.div ref={ref} initial={{ opacity: 0, filter: 'blur(12px)', y: 20 }} animate={isInView ? { opacity: 1, filter: 'blur(0px)', y: 0 } : {}} transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }} className={className}>{children}</motion.div>
}

function FadeUp({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  return <motion.div ref={ref} initial={{ opacity: 0, y: 28 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }} className={className}>{children}</motion.div>
}

const MODULES = [
  {
    icon: Globe, color: 'from-blue-500 to-cyan-500',
    title: 'Interactive Conflict Map',
    desc: '3D globe powered by CesiumJS with real-time ACLED conflict pins, live flight tracking, and multi-layer data overlays. Filter by event type, region, severity, actor, and fatality count. Zoom from a global view down to neighborhood-level intelligence.',
    highlights: ['ACLED conflict data', 'Live flight positions', '7 filter dimensions', 'Lat/lon precision'],
  },
  {
    icon: Zap, color: 'from-amber-500 to-orange-500',
    title: 'Real-Time Intelligence Feed',
    desc: 'Ingest from 35+ sources every 15 minutes. Events are classified by severity, deduplicated across sources, and enriched with AI-generated summaries. Searchable, filterable, and exportable.',
    highlights: ['35+ data sources', '15-min ingest cycle', 'AI classification', 'CSV/PDF export'],
  },
  {
    icon: Brain, color: 'from-purple-500 to-violet-500',
    title: 'AI Intel Copilot',
    desc: 'Ask questions in plain English, get answers grounded in platform data. The copilot queries your live event database, risk scores, predictions, and actor intelligence to deliver structured analytical responses — never hallucinated.',
    highlights: ['Grounded-only answers', '9 data tools', 'Multi-turn conversations', 'Source citations'],
  },
  {
    icon: BarChart3, color: 'from-pink-500 to-rose-500',
    title: 'Analysis Workbench',
    desc: 'Monte Carlo simulation engine with 1,000-iteration scenario modeling. Analysis of Competing Hypotheses (ACH) matrices. Six Structured Analytic Techniques (SAT) including red-team analysis and key assumptions checks.',
    highlights: ['Monte Carlo simulations', 'ACH matrices', '6 SAT tools', 'Forecast calibration'],
  },
  {
    icon: Bell, color: 'from-red-500 to-red-600',
    title: 'Alert Engine & PIRs',
    desc: 'Define Priority Intelligence Requirements that fire when conditions are met. Five-level escalation ladder from STABLE to WAR. Alerts via in-app notifications, email, or webhook. Configurable cooldowns to prevent alert fatigue.',
    highlights: ['5-level escalation', 'Email + webhook', 'PIR conditions', 'Smart cooldowns'],
  },
  {
    icon: Eye, color: 'from-cyan-500 to-teal-500',
    title: 'Actor Intelligence Network',
    desc: 'Track armed groups, state actors, and key individuals with relationship graphs, activity timelines, and influence scoring. Cross-reference actors with live events to build a complete operational picture.',
    highlights: ['Relationship graphs', 'Influence scoring', 'Activity timeline', 'Event correlation'],
  },
  {
    icon: Radio, color: 'from-green-500 to-emerald-500',
    title: 'Maritime & Air Tracking',
    desc: 'Real-time AIS vessel tracking with dark vessel detection — flag ships that go silent in sensitive waters. ADS-B flight tracking with military callsign recognition and squawk 7700 emergency detection.',
    highlights: ['Dark vessel alerts', 'Military callsigns', 'Squawk 7700', 'Zone monitoring'],
  },
  {
    icon: TrendingUp, color: 'from-indigo-500 to-blue-500',
    title: 'Supply Chain Monitor',
    desc: 'Map your supply chain nodes and monitor disruption signals in real-time. Commodity price correlations, route risk assessments, and automated threat alerts before disruptions cascade.',
    highlights: ['Node monitoring', 'Commodity prices', 'Route risk', 'Cascade alerts'],
  },
  {
    icon: Lock, color: 'from-slate-400 to-gray-500',
    title: 'Sanctions Screening',
    desc: 'Automated entity matching against OFAC, EU, and UN sanctions databases. Submit entity names and get instant match results with confidence scoring and list identification.',
    highlights: ['OFAC / EU / UN', 'Entity matching', 'Confidence scoring', 'Continuous monitoring'],
  },
  {
    icon: Users, color: 'from-sky-500 to-blue-500',
    title: 'Personnel Safety',
    desc: 'Duty-of-care tracking for teams operating in complex environments. Real-time proximity alerts when team members approach high-threat zones. Check-in system and evacuation route planning.',
    highlights: ['Proximity alerts', 'Check-in system', 'Evacuation routing', 'ISO 31030'],
  },
  {
    icon: Crosshair, color: 'from-rose-400 to-red-500',
    title: 'Geoverification (OSINT)',
    desc: 'Eight-method verification queue with SunCalc shadow analysis, EXIF metadata extraction, and map reference cross-checking. Five-tier confidence system from Confirmed to False Positive.',
    highlights: ['Shadow analysis', 'EXIF extraction', '5-tier confidence', 'Map reference'],
  },
  {
    icon: Plane, color: 'from-amber-400 to-yellow-500',
    title: 'Travel Risk Engine',
    desc: 'Country risk scoring generated from live event data. ISO 31030-aligned pre-departure briefing generation. Traveler registry with automated safety notifications for your team.',
    highlights: ['Live risk scoring', 'Pre-departure briefs', 'Traveler registry', 'ISO 31030'],
  },
  {
    icon: Map, color: 'from-teal-400 to-cyan-500',
    title: 'Situation Rooms',
    desc: 'Dedicated monitoring dashboards for active crises. Aggregate events, actors, and predictions around a specific situation. Track escalation trajectory with real-time event correlation.',
    highlights: ['Crisis dashboards', 'Event correlation', 'Escalation tracking', 'Shared access'],
  },
  {
    icon: FileText, color: 'from-violet-400 to-purple-500',
    title: 'Reports & API',
    desc: 'AI-generated intelligence reports for stakeholders. ESG conflict reporting with XBRL-ready export. RESTful API with Bearer authentication and HMAC-signed webhooks for system integrations.',
    highlights: ['AI report generation', 'ESG / XBRL', 'REST API', 'HMAC webhooks'],
  },
]

export default function FeaturesPage() {
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
            <Link href="/features" className="text-sm text-blue-400">Features</Link>
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
      <section className="pt-32 pb-24 px-6 relative">
        {/* Background accents */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/3 w-[600px] h-[400px] bg-blue-600/[0.08] rounded-full blur-[150px]" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[400px] bg-cyan-600/[0.06] rounded-full blur-[130px]" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <BlurIn>
            <motion.p className="text-sm font-bold text-blue-400 tracking-widest uppercase mb-6 flex items-center justify-center gap-2">
              <Sparkles size={14} /> Platform Capabilities
            </motion.p>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8 leading-tight">
              <span className="bg-gradient-to-b from-white via-white/95 to-white/70 bg-clip-text text-transparent">
                14 integrated intelligence modules.
              </span>
            </h1>
            <p className="text-lg md:text-xl text-white/45 max-w-3xl mx-auto mb-12 leading-relaxed">
              Every tool a serious analyst needs — from real-time event feeds to AI-powered prediction engines. No vendor lock-in. No procurement circus.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
                <Link href="/sign-up" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-[15px] font-bold bg-gradient-to-r from-white to-blue-50 text-gray-900 hover:from-blue-50 hover:to-white transition-all shadow-lg shadow-white/20">
                  Start Free <Rocket size={16} />
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.95 }}>
                <Link href="/pricing" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-[15px] font-semibold border-2 border-white/[0.15] text-white/70 hover:text-white hover:border-white/30 transition-all backdrop-blur">
                  View Pricing <ArrowRight size={16} />
                </Link>
              </motion.div>
            </div>
          </BlurIn>
        </div>
      </section>

      {/* Module Grid */}
      <section className="max-w-7xl mx-auto px-6 pb-40">
        <div className="space-y-6">
          {MODULES.map((mod, i) => {
            const Icon = mod.icon
            const isEven = i % 2 === 0
            return (
              <FadeUp key={mod.title} delay={i * 0.05}>
                <motion.div
                  whileHover={{ borderColor: 'rgba(255,255,255,0.15)', y: -2 }}
                  transition={{ duration: 0.3 }}
                  className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.03] to-white/[0.005] hover:from-white/[0.06] hover:to-white/[0.01] overflow-hidden transition-all duration-300"
                >
                  <div className={`flex flex-col ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'} items-stretch`}>
                    {/* Icon side */}
                    <motion.div
                      className="flex-shrink-0 w-full md:w-56 p-10 flex items-center justify-center bg-gradient-to-br from-white/[0.03] to-transparent"
                      whileHover={{ scale: 1.05 }}
                    >
                      <motion.div
                        className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${mod.color} flex items-center justify-center shadow-lg shadow-black/30`}
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        transition={{ type: 'spring' as const, stiffness: 400 }}
                      >
                        <Icon size={32} className="text-white" />
                      </motion.div>
                    </motion.div>
                    {/* Content side */}
                    <div className="flex-1 p-10 flex flex-col justify-center">
                      <h3 className="text-2xl font-bold text-white mb-4">{mod.title}</h3>
                      <p className="text-sm md:text-base text-white/50 leading-relaxed mb-6">{mod.desc}</p>
                      <div className="flex flex-wrap gap-2.5">
                        {mod.highlights.map((h) => (
                          <motion.span
                            key={h}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border border-white/[0.1] text-white/60 bg-white/[0.03] hover:bg-white/[0.08] transition-colors"
                            whileHover={{ scale: 1.05 }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400/80" />
                            {h}
                          </motion.span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </FadeUp>
            )
          })}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-white/[0.08] py-32 px-6 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-t from-blue-600/[0.05] via-transparent to-transparent" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-500/[0.04] rounded-full blur-[140px]" />

        <BlurIn className="text-center max-w-4xl mx-auto relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-6">Ready to see it in action?</h2>
          <p className="text-lg text-white/40 mb-10 leading-relaxed">Free tier includes the real-time intel feed, interactive conflict map, and 3 custom alerts. No credit card required.</p>
          <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }} className="inline-block">
            <Link href="/sign-up" className="inline-flex items-center gap-2.5 px-10 py-4.5 rounded-xl text-base font-bold bg-gradient-to-r from-white to-blue-50 text-gray-900 hover:from-blue-50 hover:to-white transition-all shadow-[0_0_60px_rgba(255,255,255,0.1)]">
              Start Free <Rocket size={18} />
            </Link>
          </motion.div>
        </BlurIn>
      </section>
    </div>
  )
}
