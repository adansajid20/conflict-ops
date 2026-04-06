'use client'

import Link from 'next/link'
import { motion, useInView, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { useRef, useState, useEffect, useCallback } from 'react'
import {
  Shield, ArrowRight, Check, Globe, Zap, BarChart3, Bell, Eye, Users,
  Lock, Radio, TrendingUp, ChevronRight, MapPin, Activity, Satellite,
  FileText, MessageSquare, Search, Crosshair, Layers,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   ANIMATION PRIMITIVES
   ═══════════════════════════════════════════════════════════════ */

function BlurIn({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, filter: 'blur(10px)', y: 16 }}
      animate={isInView ? { opacity: 1, filter: 'blur(0px)', y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function FadeUp({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-40px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function StaggerWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-40px' })
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function StaggerChild({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* Animated counter */
function AnimatedNumber({ value, suffix = '', duration = 2 }: { value: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (!isInView) return
    let start = 0
    const end = value
    const stepTime = Math.max(16, (duration * 1000) / end)
    const timer = setInterval(() => {
      start += Math.ceil(end / (duration * 60))
      if (start >= end) { start = end; clearInterval(timer) }
      setDisplay(start)
    }, stepTime)
    return () => clearInterval(timer)
  }, [isInView, value, duration])
  return <span ref={ref}>{display.toLocaleString()}{suffix}</span>
}

/* ═══════════════════════════════════════════════════════════════
   HERO - DASHBOARD MOCKUP
   ═══════════════════════════════════════════════════════════════ */

function DashboardMockup() {
  return (
    <div className="relative w-full">
      {/* Glow behind mockup */}
      <div className="absolute -inset-8 bg-gradient-to-br from-blue-500/[0.08] via-cyan-500/[0.05] to-transparent rounded-3xl blur-2xl" />

      <div className="relative rounded-2xl border border-white/[0.08] bg-[#0C1220]/80 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/40">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="px-3 py-1 rounded-md bg-white/[0.04] text-[11px] text-white/30">conflictradar.co/map</div>
          </div>
        </div>

        {/* Dashboard content */}
        <div className="p-4 space-y-3">
          {/* Map area */}
          <div className="rounded-xl bg-gradient-to-br from-[#0A1628] to-[#0D1B2A] border border-white/[0.04] p-4 h-[200px] relative overflow-hidden">
            {/* Grid pattern */}
            <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
            {/* Threat dots */}
            {[
              { x: '22%', y: '35%', color: '#EF4444', size: 8, pulse: true },
              { x: '48%', y: '28%', color: '#F59E0B', size: 6, pulse: false },
              { x: '65%', y: '52%', color: '#EF4444', size: 10, pulse: true },
              { x: '35%', y: '60%', color: '#3B82F6', size: 5, pulse: false },
              { x: '78%', y: '38%', color: '#F59E0B', size: 7, pulse: true },
              { x: '15%', y: '55%', color: '#22D3EE', size: 5, pulse: false },
            ].map((dot, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full"
                style={{ left: dot.x, top: dot.y, width: dot.size, height: dot.size, background: dot.color, boxShadow: `0 0 ${dot.size * 2}px ${dot.color}40` }}
                animate={dot.pulse ? { scale: [1, 1.4, 1], opacity: [0.8, 1, 0.8] } : { opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2 + i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
              />
            ))}
            {/* Map label */}
            <div className="absolute bottom-3 left-3 text-[10px] text-white/20 tracking-wide uppercase">Global Threat Map — Live</div>
          </div>

          {/* Bottom cards row */}
          <div className="grid grid-cols-3 gap-3">
            {/* Event feed mini */}
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-3 col-span-2">
              <div className="text-[10px] text-white/30 uppercase tracking-wide mb-2">Latest Events</div>
              {[
                { severity: 'CRITICAL', text: 'Military escalation detected in border region', color: '#EF4444' },
                { severity: 'HIGH', text: 'Maritime incident reported near shipping corridor', color: '#F59E0B' },
                { severity: 'MEDIUM', text: 'Protest activity surge in capital district', color: '#3B82F6' },
              ].map((evt, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1 + i * 0.3, duration: 0.4 }}
                  className="flex items-center gap-2 py-1.5 border-t border-white/[0.03] first:border-0"
                >
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: evt.color }} />
                  <span className="text-[10px] text-white/40 truncate">{evt.text}</span>
                </motion.div>
              ))}
            </div>

            {/* Stats mini */}
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-3 space-y-3">
              <div className="text-[10px] text-white/30 uppercase tracking-wide">Risk Score</div>
              <div className="text-2xl font-bold text-white">7.2</div>
              <div className="flex items-center gap-1 text-[10px] text-red-400">
                <TrendingUp size={10} /> +1.4 today
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════════════════════════ */

function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'blur(8px)',
        WebkitBackdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'blur(8px)',
        background: scrolled ? 'rgba(7,11,17,0.88)' : 'rgba(7,11,17,0.3)',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/landing" className="flex items-center gap-2.5 group">
          <Shield size={20} className="text-blue-400 transition-transform group-hover:scale-110 duration-200" />
          <span className="font-bold text-[15px] tracking-tight text-white">ConflictRadar</span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <Link href="/features" className="text-[13px] text-white/40 hover:text-white/80 transition-colors duration-200">Features</Link>
          <Link href="/pricing" className="text-[13px] text-white/40 hover:text-white/80 transition-colors duration-200">Pricing</Link>
          <Link href="/methods" className="text-[13px] text-white/40 hover:text-white/80 transition-colors duration-200">Methods</Link>
          <Link href="/wire" className="text-[13px] text-white/40 hover:text-white/80 transition-colors duration-200">Live Wire</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/sign-in" className="text-[13px] text-white/50 hover:text-white/80 transition-colors duration-200">Sign in</Link>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium bg-white text-gray-900 hover:bg-gray-100 transition-colors"
            >
              Get Started <ArrowRight size={13} />
            </Link>
          </motion.div>
        </div>
      </div>
    </motion.nav>
  )
}

/* ═══════════════════════════════════════════════════════════════
   HERO SECTION
   ═══════════════════════════════════════════════════════════════ */

function HeroSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] })
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 120])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0])

  return (
    <section ref={sectionRef} className="relative min-h-[100vh] flex items-center overflow-hidden">
      {/* Layered background */}
      <div className="absolute inset-0 bg-[#070B11]" />
      <div className="absolute inset-0 bg-gradient-to-b from-blue-950/20 via-transparent to-transparent" />
      <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-500/[0.03] rounded-full blur-[150px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-cyan-500/[0.02] rounded-full blur-[120px]" />

      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)', backgroundSize: '72px 72px' }} />

      <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 max-w-7xl mx-auto px-6 pt-28 pb-20 w-full">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-8"
        >
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-white/[0.06] bg-white/[0.02]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
            </span>
            <span className="text-[13px] text-white/40">Ingesting from 35+ sources every 15 minutes</span>
          </div>
        </motion.div>

        {/* Centered headline */}
        <div className="text-center max-w-4xl mx-auto mb-16">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-[48px] md:text-[64px] lg:text-[72px] leading-[1.02] font-bold tracking-[-0.035em] mb-6"
          >
            <span className="bg-gradient-to-b from-white via-white/90 to-white/50 bg-clip-text text-transparent">
              Geopolitical intelligence,
            </span>
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              radically accessible.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="text-[17px] md:text-lg text-white/40 max-w-2xl mx-auto leading-relaxed mb-10"
          >
            Real-time conflict monitoring, AI-powered threat analysis, and predictive intelligence — all in one platform.
            What used to require a $50,000 enterprise contract is now free to start.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row justify-center gap-3"
          >
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link href="/sign-up" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-[15px] font-semibold bg-white text-gray-900 hover:bg-gray-50 transition-colors shadow-[0_0_40px_rgba(255,255,255,0.06)]">
                Start for Free <ArrowRight size={15} />
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link href="/wire" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-[15px] font-medium border border-white/[0.1] text-white/60 hover:text-white/90 hover:border-white/20 transition-all">
                View Live Wire <ChevronRight size={15} />
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-6 flex justify-center items-center gap-5 text-[13px] text-white/25"
          >
            <span className="flex items-center gap-1.5"><Check size={13} className="text-green-400/50" /> No credit card</span>
            <span className="w-0.5 h-0.5 rounded-full bg-white/15" />
            <span className="flex items-center gap-1.5"><Check size={13} className="text-green-400/50" /> Free tier forever</span>
            <span className="w-0.5 h-0.5 rounded-full bg-white/15" />
            <span className="flex items-center gap-1.5"><Check size={13} className="text-green-400/50" /> Deploy in 60 seconds</span>
          </motion.div>
        </div>

        {/* Dashboard mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-5xl mx-auto"
        >
          <DashboardMockup />
        </motion.div>
      </motion.div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   TRUST BAR - Logos & social proof
   ═══════════════════════════════════════════════════════════════ */

function TrustBar() {
  const sources = ['ACLED', 'GDELT', 'ReliefWeb', 'NASA FIRMS', 'USGS', 'NOAA', 'UNHCR', 'OpenSky', 'AISStream']
  return (
    <section className="relative z-10 border-y border-white/[0.04] py-10" style={{ background: 'rgba(7,11,17,0.9)' }}>
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-center text-[12px] uppercase tracking-[0.2em] text-white/20 mb-6">Intelligence from trusted global sources</p>
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
          {sources.map((s) => (
            <span key={s} className="text-[13px] font-medium text-white/15 hover:text-white/30 transition-colors duration-300">{s}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   STATS SECTION
   ═══════════════════════════════════════════════════════════════ */

function StatsSection() {
  const stats = [
    { value: 35, suffix: '+', label: 'Data sources monitored' },
    { value: 140, suffix: '+', label: 'API endpoints' },
    { value: 15, suffix: 'min', label: 'Average ingest cycle' },
    { value: 99, suffix: '.9%', label: 'Platform uptime' },
  ]

  return (
    <section className="relative z-10 py-20" style={{ background: '#070B11' }}>
      <div className="max-w-6xl mx-auto px-6">
        <StaggerWrap className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <StaggerChild key={stat.label}>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                  <AnimatedNumber value={stat.value} suffix={stat.suffix} />
                </div>
                <div className="mt-2 text-[13px] text-white/30">{stat.label}</div>
              </div>
            </StaggerChild>
          ))}
        </StaggerWrap>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   FEATURES - BENTO GRID
   ═══════════════════════════════════════════════════════════════ */

function FeaturesSection() {
  const features = [
    { icon: Globe, color: 'from-blue-500/80 to-cyan-500/80', title: 'Conflict Map', desc: 'Interactive 3D globe with ACLED data, live vessel tracking, flight paths, and satellite fire overlays. Zoom from global to neighborhood.', tag: 'Core', large: true },
    { icon: Zap, color: 'from-amber-500/80 to-orange-500/80', title: 'Real-Time Intel Feed', desc: 'Multi-source ingestion from GDELT, ReliefWeb, ACLED, NASA, and 30+ feeds. Classified, deduplicated, and AI-enriched.', tag: 'Core', large: true },
    { icon: MessageSquare, color: 'from-violet-500/80 to-purple-500/80', title: 'AI Intel Copilot', desc: 'Ask questions grounded in your platform data. Get sourced answers, not hallucinated guesses.', tag: 'AI' },
    { icon: BarChart3, color: 'from-pink-500/80 to-rose-500/80', title: 'Prediction Engine', desc: 'Monte Carlo simulations, competing hypotheses, and structured analytic techniques for forward-looking risk.', tag: 'AI' },
    { icon: Bell, color: 'from-red-500/80 to-orange-500/80', title: 'Alert Engine & PIRs', desc: 'Define Priority Intelligence Requirements. Get alerted via email, webhook, or SMS the moment conditions are met.', tag: 'Ops' },
    { icon: Eye, color: 'from-cyan-500/80 to-teal-500/80', title: 'Actor Intelligence', desc: 'Track armed groups, state actors, and key individuals. Relationship graphs and activity timelines.', tag: 'Intel' },
    { icon: Radio, color: 'from-green-500/80 to-emerald-500/80', title: 'Maritime & Air Tracking', desc: 'AIS vessel tracking with dark vessel detection. ADS-B flight data with military callsign recognition.', tag: 'SIGINT' },
    { icon: TrendingUp, color: 'from-indigo-500/80 to-blue-500/80', title: 'Supply Chain Risk', desc: 'Disruption signals, commodity correlations, and route risk assessments before they hit your operations.', tag: 'Risk' },
    { icon: Lock, color: 'from-slate-400/80 to-gray-500/80', title: 'Sanctions Screening', desc: 'Automated entity matching against OFAC, EU, and UN databases with continuous monitoring.', tag: 'Compliance' },
    { icon: Users, color: 'from-sky-500/80 to-blue-500/80', title: 'Personnel Safety', desc: 'Duty-of-care tracking for field teams. Proximity alerts, evac routing, and real-time check-ins.', tag: 'Safety' },
    { icon: Search, color: 'from-emerald-500/80 to-green-500/80', title: 'Geoverification', desc: 'Cross-reference claims against satellite imagery, open-source evidence, and corroborating reports.', tag: 'OSINT' },
    { icon: FileText, color: 'from-blue-400/80 to-indigo-500/80', title: 'Reports & API', desc: 'Generate intelligence reports. Expose everything via REST API with Bearer auth and HMAC webhooks.', tag: 'Platform' },
  ]

  return (
    <section className="relative py-32" style={{ background: '#070B11' }}>
      <div className="max-w-7xl mx-auto px-6">
        <BlurIn className="text-center mb-20">
          <p className="text-[13px] font-medium text-blue-400 tracking-widest uppercase mb-4">Platform</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-5">
            <span className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
              Everything you need.
            </span>
            <br className="hidden sm:block" />
            <span className="text-white/30"> Nothing you don&apos;t.</span>
          </h2>
          <p className="text-[16px] text-white/35 max-w-2xl mx-auto leading-relaxed">
            12 integrated modules that transform raw global data into decisions.
            Every feature works together. Every insight is grounded in real data.
          </p>
        </BlurIn>

        <StaggerWrap className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => {
            const Icon = f.icon
            return (
              <StaggerChild key={f.title}>
                <motion.div
                  whileHover={{ y: -3, borderColor: 'rgba(255,255,255,0.1)' }}
                  transition={{ duration: 0.2 }}
                  className={`group relative p-6 rounded-2xl border border-white/[0.05] bg-white/[0.015] hover:bg-white/[0.03] transition-all duration-300 cursor-default h-full ${
                    f.large ? 'lg:col-span-1' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${f.color} flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity duration-300`}>
                      <Icon size={18} className="text-white" />
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-white/20 font-medium">{f.tag}</span>
                  </div>
                  <h3 className="text-[15px] font-semibold text-white/90 mb-2">{f.title}</h3>
                  <p className="text-[13px] text-white/30 leading-relaxed">{f.desc}</p>
                </motion.div>
              </StaggerChild>
            )
          })}
        </StaggerWrap>

        <FadeUp delay={0.2} className="text-center mt-12">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Link href="/features" className="inline-flex items-center gap-2 text-[14px] text-white/40 hover:text-white/70 transition-colors duration-200">
              Explore all features <ArrowRight size={14} />
            </Link>
          </motion.div>
        </FadeUp>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   HOW IT WORKS - VISUAL TIMELINE
   ═══════════════════════════════════════════════════════════════ */

function HowItWorksSection() {
  const steps = [
    {
      num: '01',
      title: 'Ingest',
      desc: '35+ global data sources feed into one unified pipeline. Conflict events, satellite imagery, vessel positions, flight tracks, and news reports — all classified and deduplicated automatically.',
      icon: Satellite,
      accent: 'from-blue-500 to-cyan-500',
    },
    {
      num: '02',
      title: 'Analyze',
      desc: 'AI-powered correlation engine connects signals across sources. The copilot answers questions grounded in real platform data. Monte Carlo models quantify risk with full transparency.',
      icon: Activity,
      accent: 'from-violet-500 to-purple-500',
    },
    {
      num: '03',
      title: 'Act',
      desc: 'Trigger alerts when conditions change. Push intelligence via webhooks. Generate reports for stakeholders. Get the right signal to the right person at the right time.',
      icon: Crosshair,
      accent: 'from-emerald-500 to-green-500',
    },
  ]

  return (
    <section className="relative py-32 border-t border-white/[0.04]" style={{ background: '#070B11' }}>
      <div className="max-w-6xl mx-auto px-6">
        <BlurIn className="text-center mb-20">
          <p className="text-[13px] font-medium text-blue-400 tracking-widest uppercase mb-4">How it works</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            From raw data to decisions.
          </h2>
        </BlurIn>

        <div className="relative grid md:grid-cols-3 gap-6">
          {/* Connector line (desktop) */}
          <div className="hidden md:block absolute top-16 left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-blue-500/20 via-violet-500/20 to-emerald-500/20" />

          {steps.map((step, i) => {
            const Icon = step.icon
            return (
              <FadeUp key={step.num} delay={i * 0.12}>
                <div className="relative p-7 rounded-2xl border border-white/[0.05] bg-white/[0.015] h-full group hover:bg-white/[0.025] transition-colors duration-300">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.accent} flex items-center justify-center mb-5 opacity-60 group-hover:opacity-90 transition-opacity duration-300`}>
                    <Icon size={22} className="text-white" />
                  </div>
                  <div className="text-[11px] uppercase tracking-widest text-white/15 mb-2 font-medium">Step {step.num}</div>
                  <h3 className="text-xl font-semibold text-white mb-3">{step.title}</h3>
                  <p className="text-[13px] text-white/30 leading-relaxed">{step.desc}</p>
                </div>
              </FadeUp>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   USE CASES
   ═══════════════════════════════════════════════════════════════ */

function UseCasesSection() {
  const [active, setActive] = useState(0)

  const personas = [
    { role: 'NGO Security Managers', icon: Shield, desc: 'Monitor threat levels across operational areas. Receive evacuation alerts before situations escalate. Track team safety with duty-of-care tools and real-time check-ins.', points: ['Proximity alerts for field teams', 'Evacuation route planning', 'Daily situation briefings'] },
    { role: 'Conflict Journalists', icon: Search, desc: 'Verify events with multi-source correlation. Map actor networks and activity timelines. Access OSINT tools that turn tips into confirmed intelligence.', points: ['Multi-source event verification', 'Actor relationship mapping', 'Geolocation evidence tools'] },
    { role: 'Corporate Security Teams', icon: Layers, desc: 'Supply chain disruption monitoring, travel risk assessments, and sanctions screening. Protect operations and people with early warning intelligence.', points: ['Supply chain risk alerts', 'Travel risk scoring', 'Sanctions compliance checks'] },
    { role: 'Government & Defense', icon: Crosshair, desc: 'Situation rooms for active operations. Intelligence feeds, predictive modeling, and secure team workspaces with full audit trails.', points: ['Classified-style event feeds', 'Predictive scenario modeling', 'Secure collaboration rooms'] },
  ]

  const handleSetActive = useCallback((i: number) => setActive(i), [])

  return (
    <section className="relative py-32 border-t border-white/[0.04]" style={{ background: '#070B11' }}>
      <div className="max-w-6xl mx-auto px-6">
        <BlurIn className="text-center mb-16">
          <p className="text-[13px] font-medium text-blue-400 tracking-widest uppercase mb-4">Who it&apos;s for</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-5">
            Built for people on the ground.
          </h2>
          <p className="text-[16px] text-white/35 max-w-2xl mx-auto">
            Not another enterprise tool locked behind procurement. ConflictRadar serves the people and organizations who need intelligence most.
          </p>
        </BlurIn>

        <FadeUp>
          <div className="grid md:grid-cols-[280px_1fr] gap-6">
            {/* Tab list */}
            <div className="flex md:flex-col gap-2">
              {personas.map((p, i) => {
                const Icon = p.icon
                return (
                  <button
                    key={p.role}
                    onClick={() => handleSetActive(i)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 w-full ${
                      active === i
                        ? 'bg-white/[0.05] border border-white/[0.08] text-white'
                        : 'border border-transparent text-white/30 hover:text-white/50 hover:bg-white/[0.02]'
                    }`}
                  >
                    <Icon size={18} className={active === i ? 'text-blue-400' : 'text-white/20'} />
                    <span className="text-[14px] font-medium">{p.role}</span>
                  </button>
                )
              })}
            </div>

            {/* Content panel */}
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.3 }}
                className="p-8 rounded-2xl border border-white/[0.05] bg-white/[0.015]"
              >
                <h3 className="text-xl font-semibold text-white mb-3">{personas[active]?.role}</h3>
                <p className="text-[14px] text-white/35 leading-relaxed mb-6">{personas[active]?.desc}</p>
                <div className="space-y-3">
                  {(personas[active]?.points ?? []).map((pt) => (
                    <div key={pt} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Check size={12} className="text-blue-400" />
                      </div>
                      <span className="text-[13px] text-white/40">{pt}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </FadeUp>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   COMPARISON SECTION
   ═══════════════════════════════════════════════════════════════ */

function ComparisonSection() {
  const rows = [
    { feature: 'Starting price', cr: 'Free — $149/mo', d: '~$15,000/yr', rf: '~$50,000/yr' },
    { feature: 'Self-serve signup', cr: true, d: false, rf: false },
    { feature: 'AI analysis copilot', cr: true, d: false, rf: false },
    { feature: 'Predictive modeling', cr: true, d: false, rf: false },
    { feature: 'Vessel & flight tracking', cr: true, d: true, rf: false },
    { feature: 'Supply chain monitoring', cr: true, d: false, rf: false },
    { feature: 'Personnel safety', cr: true, d: false, rf: false },
    { feature: 'Sanctions screening', cr: true, d: false, rf: false },
    { feature: 'REST API & webhooks', cr: true, d: true, rf: true },
  ]

  return (
    <section className="relative py-32 border-t border-white/[0.04]" style={{ background: '#070B11' }}>
      <div className="max-w-5xl mx-auto px-6">
        <BlurIn className="text-center mb-16">
          <p className="text-[13px] font-medium text-blue-400 tracking-widest uppercase mb-4">Why ConflictRadar</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-5">
            <span className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
              Enterprise intelligence.
            </span>
            <br />
            <span className="text-white/30">Startup pricing.</span>
          </h2>
        </BlurIn>

        <FadeUp>
          <div className="overflow-hidden rounded-2xl border border-white/[0.05]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-5 py-4 text-white/30 font-medium w-[200px]">Feature</th>
                    <th className="px-5 py-4 text-blue-400 font-semibold bg-blue-500/[0.04]">ConflictRadar</th>
                    <th className="px-5 py-4 text-white/25 font-medium">Dataminr</th>
                    <th className="px-5 py-4 text-white/25 font-medium">Recorded Future</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.feature} className="border-t border-white/[0.03]">
                      <td className="px-5 py-3.5 text-white/40">{row.feature}</td>
                      <td className="px-5 py-3.5 bg-blue-500/[0.04]">
                        {typeof row.cr === 'boolean' ? (
                          row.cr ? <Check size={16} className="text-blue-400" /> : <span className="text-white/15">—</span>
                        ) : <span className="text-white font-medium">{row.cr}</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {typeof row.d === 'boolean' ? (
                          row.d ? <Check size={16} className="text-white/25" /> : <span className="text-white/15">—</span>
                        ) : <span className="text-white/25">{row.d}</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {typeof row.rf === 'boolean' ? (
                          row.rf ? <Check size={16} className="text-white/25" /> : <span className="text-white/15">—</span>
                        ) : <span className="text-white/25">{row.rf}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   CTA SECTION
   ═══════════════════════════════════════════════════════════════ */

function CTASection() {
  return (
    <section className="relative py-32 border-t border-white/[0.04] overflow-hidden" style={{ background: '#070B11' }}>
      {/* Gradient bloom */}
      <div className="absolute inset-0 bg-gradient-to-t from-blue-500/[0.03] via-transparent to-transparent" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-500/[0.04] rounded-full blur-[120px]" />

      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <BlurIn>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            <span className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
              Start making better decisions.
            </span>
          </h2>
          <p className="text-[16px] text-white/35 max-w-xl mx-auto mb-10 leading-relaxed">
            Free forever for individual analysts. No credit card required.
            Upgrade when your team needs the full operating picture.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link href="/sign-up" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-[15px] font-semibold bg-white text-gray-900 hover:bg-gray-50 transition-colors shadow-[0_0_50px_rgba(255,255,255,0.06)]">
                Get Started Free <ArrowRight size={15} />
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link href="/pricing" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-[15px] font-medium border border-white/[0.1] text-white/50 hover:text-white/80 hover:border-white/20 transition-all">
                View Pricing
              </Link>
            </motion.div>
          </div>
        </BlurIn>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════════ */

function Footer() {
  return (
    <footer className="border-t border-white/[0.04] py-12" style={{ background: '#070B11' }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Shield size={18} className="text-blue-400" />
              <span className="font-bold text-white text-[14px]">ConflictRadar</span>
            </div>
            <p className="text-[13px] text-white/25 leading-relaxed">
              Geopolitical intelligence for analysts, operators, and organizations in complex environments.
            </p>
          </div>
          <div>
            <h4 className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] mb-4">Product</h4>
            <div className="flex flex-col gap-2.5">
              <Link href="/features" className="text-[13px] text-white/25 hover:text-white/50 transition-colors duration-200">Features</Link>
              <Link href="/pricing" className="text-[13px] text-white/25 hover:text-white/50 transition-colors duration-200">Pricing</Link>
              <Link href="/wire" className="text-[13px] text-white/25 hover:text-white/50 transition-colors duration-200">Live Wire</Link>
              <Link href="/methods" className="text-[13px] text-white/25 hover:text-white/50 transition-colors duration-200">Methods</Link>
            </div>
          </div>
          <div>
            <h4 className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] mb-4">Company</h4>
            <div className="flex flex-col gap-2.5">
              <Link href="/security" className="text-[13px] text-white/25 hover:text-white/50 transition-colors duration-200">Security</Link>
              <Link href="/privacy" className="text-[13px] text-white/25 hover:text-white/50 transition-colors duration-200">Privacy</Link>
              <Link href="/terms" className="text-[13px] text-white/25 hover:text-white/50 transition-colors duration-200">Terms</Link>
              <Link href="/status" className="text-[13px] text-white/25 hover:text-white/50 transition-colors duration-200">Status</Link>
            </div>
          </div>
          <div>
            <h4 className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] mb-4">Get in touch</h4>
            <div className="flex flex-col gap-2.5">
              <a href="mailto:support@conflictradar.co" className="text-[13px] text-white/25 hover:text-white/50 transition-colors duration-200">support@conflictradar.co</a>
              <a href="mailto:security@conflictradar.co" className="text-[13px] text-white/25 hover:text-white/50 transition-colors duration-200">security@conflictradar.co</a>
            </div>
          </div>
        </div>
        <div className="pt-8 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-[12px] text-white/15">&copy; 2026 ConflictRadar. All rights reserved.</span>
          <span className="text-[12px] text-white/15">GDPR Compliant · SOC 2 In Progress</span>
        </div>
      </div>
    </footer>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN EXPORT
   ═══════════════════════════════════════════════════════════════ */

export function LandingClient({ features }: { features: unknown[] }) {
  void features
  return (
    <div className="min-h-screen" style={{ background: '#070B11', color: '#fff' }}>
      <Nav />
      <HeroSection />
      <TrustBar />
      <StatsSection />
      <FeaturesSection />
      <HowItWorksSection />
      <UseCasesSection />
      <ComparisonSection />
      <CTASection />
      <Footer />
    </div>
  )
}
