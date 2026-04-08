'use client'

import Link from 'next/link'
import { motion, useInView, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { useRef, useState, useEffect, useCallback } from 'react'
import {
  Shield, ArrowRight, Check, Globe, Zap, BarChart3, Bell, Eye, Users,
  Lock, Radio, TrendingUp, ChevronRight, MapPin, Activity, Satellite,
  FileText, MessageSquare, Search, Crosshair, Layers, Sparkles, Rocket,
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
      initial={{ opacity: 0, filter: 'blur(12px)', y: 20 }}
      animate={isInView ? { opacity: 1, filter: 'blur(0px)', y: 0 } : {}}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function FadeUp({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function StaggerWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } }}
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
        hidden: { opacity: 0, y: 24 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* Animated counter with smooth easing */
function AnimatedNumber({ value, suffix = '', duration = 2.2 }: { value: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!isInView) return
    const startTime = Date.now()
    const endValue = value

    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / (duration * 1000), 1)
      const easedProgress = easeOut(progress)
      const current = Math.floor(endValue * easedProgress)
      setDisplay(current)

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    animate()
  }, [isInView, value, duration])

  return <span ref={ref}>{display.toLocaleString()}{suffix}</span>
}

/* ═══════════════════════════════════════════════════════════════
   HERO - DASHBOARD MOCKUP
   ═══════════════════════════════════════════════════════════════ */

function DashboardMockup() {
  return (
    <div className="relative w-full">
      {/* Premium glow effects */}
      <div className="absolute -inset-12 bg-gradient-to-tr from-blue-600/[0.15] via-purple-600/[0.08] to-cyan-600/[0.06] rounded-3xl blur-3xl opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-transparent rounded-2xl" />

      <div className="relative rounded-2xl border border-white/[0.12] bg-gradient-to-br from-[#0E1621]/90 to-[#0A0F1A]/80 backdrop-blur-2xl overflow-hidden shadow-2xl shadow-blue-950/60">
        {/* Title bar with gradient */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.08] bg-gradient-to-r from-white/[0.02] to-transparent">
          <div className="flex gap-1.5">
            <motion.div className="w-2.5 h-2.5 rounded-full bg-red-500/60" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }} />
            <motion.div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity, delay: 0.15 }} />
            <motion.div className="w-2.5 h-2.5 rounded-full bg-green-500/60" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity, delay: 0.3 }} />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="px-3 py-1 rounded-md bg-white/[0.05] border border-white/[0.05] text-[11px] text-white/40">conflictradar.co — Global Operations Center</div>
          </div>
        </div>

        {/* Dashboard content */}
        <div className="p-5 space-y-4">
          {/* Map area with enhanced visuals */}
          <div className="rounded-xl bg-gradient-to-br from-[#0D1B2F] via-[#0A1220] to-[#050A12] border border-white/[0.06] p-5 h-[240px] relative overflow-hidden">
            {/* Animated grid pattern */}
            <motion.div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              }}
              animate={{ backgroundPosition: ['0 0', '48px 48px'] }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            />

            {/* Threat indicators */}
            {[
              { x: '20%', y: '32%', color: '#EF4444', size: 9, pulse: true, label: 'CRITICAL' },
              { x: '50%', y: '25%', color: '#F59E0B', size: 7, pulse: false, label: 'HIGH' },
              { x: '68%', y: '55%', color: '#EF4444', size: 11, pulse: true, label: 'CRITICAL' },
              { x: '38%', y: '65%', color: '#3B82F6', size: 6, pulse: false, label: 'MEDIUM' },
              { x: '80%', y: '40%', color: '#F59E0B', size: 8, pulse: true, label: 'HIGH' },
              { x: '12%', y: '58%', color: '#10B981', size: 5, pulse: false, label: 'LOW' },
            ].map((dot, i) => (
              <div key={i} className="absolute">
                <motion.div
                  className="rounded-full"
                  style={{
                    left: dot.x,
                    top: dot.y,
                    width: dot.size,
                    height: dot.size,
                    background: dot.color,
                    boxShadow: `0 0 ${dot.size * 3}px ${dot.color}, 0 0 ${dot.size * 6}px ${dot.color}40`,
                  }}
                  animate={dot.pulse ? { scale: [1, 1.6, 1], opacity: [0.9, 1, 0.9] } : { opacity: [0.6, 0.9, 0.6] }}
                  transition={{ duration: 2.5 + i * 0.35, repeat: Infinity, ease: 'easeInOut' }}
                />
              </div>
            ))}

            {/* Status indicator */}
            <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.05] border border-green-500/20">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] text-green-400 font-medium">LIVE</span>
            </div>

            {/* Map label */}
            <div className="absolute bottom-4 left-4 text-[11px] text-white/30 tracking-wide uppercase font-medium">Global Intelligence Layer — Real-Time</div>
          </div>

          {/* Bottom cards row */}
          <div className="grid grid-cols-3 gap-4">
            {/* Event feed mini */}
            <div className="rounded-lg bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.06] p-4 col-span-2">
              <div className="text-[11px] text-white/40 uppercase tracking-widest font-semibold mb-3">Inbound Events</div>
              {[
                { severity: 'CRITICAL', text: 'Military escalation in disputed border region', color: '#EF4444' },
                { severity: 'HIGH', text: 'Maritime incident detected near shipping lane', color: '#F59E0B' },
                { severity: 'MEDIUM', text: 'Sustained protest activity in urban area', color: '#3B82F6' },
              ].map((evt, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + i * 0.35, duration: 0.5 }}
                  className="flex items-center gap-3 py-2.5 border-t border-white/[0.04] first:border-0"
                >
                  <motion.div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: evt.color }}
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <span className="text-[11px] text-white/50 font-medium">{evt.text}</span>
                </motion.div>
              ))}
            </div>

            {/* Stats mini */}
            <div className="rounded-lg bg-gradient-to-br from-blue-500/[0.08] to-blue-500/[0.02] border border-blue-500/[0.15] p-4 space-y-4">
              <div className="text-[11px] text-white/40 uppercase tracking-widest font-semibold">Risk Index</div>
              <div className="space-y-2">
                <motion.div
                  className="text-3xl font-bold bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2 }}
                >
                  6.8
                </motion.div>
                <div className="flex items-center gap-2 text-[10px] text-orange-400/80 font-semibold">
                  <TrendingUp size={11} /> +0.4 (2h)
                </div>
              </div>
              <div className="w-full h-1 bg-white/[0.05] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-orange-500 to-red-500"
                  initial={{ width: '40%' }}
                  animate={{ width: '68%' }}
                  transition={{ delay: 1.4, duration: 1 }}
                />
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
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        backdropFilter: scrolled ? 'blur(24px) saturate(200%)' : 'blur(10px)',
        WebkitBackdropFilter: scrolled ? 'blur(24px) saturate(200%)' : 'blur(10px)',
        background: scrolled
          ? 'linear-gradient(135deg, rgba(7,11,17,0.9) 0%, rgba(7,11,17,0.85) 100%)'
          : 'linear-gradient(135deg, rgba(7,11,17,0.4) 0%, rgba(7,11,17,0.25) 100%)',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.02)',
        boxShadow: scrolled ? '0 4px 32px rgba(0,0,0,0.4)' : 'none',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/landing" className="flex items-center gap-2.5 group">
          <motion.div
            whileHover={{ rotate: 12, scale: 1.15 }}
            transition={{ type: 'spring' as const, stiffness: 400, damping: 10 }}
          >
            <Shield size={20} className="text-blue-400 group-hover:text-blue-300 transition-colors" />
          </motion.div>
          <span className="font-bold text-[15px] tracking-tight text-white bg-gradient-to-r from-white to-white/80 bg-clip-text group-hover:text-transparent transition-all">ConflictRadar</span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <Link href="/features" className="text-[13px] text-white/50 hover:text-white transition-colors duration-200 font-medium">Features</Link>
          <Link href="/pricing" className="text-[13px] text-white/50 hover:text-white transition-colors duration-200 font-medium">Pricing</Link>
          <Link href="/methods" className="text-[13px] text-white/50 hover:text-white transition-colors duration-200 font-medium">Methods</Link>
          <Link href="/wire" className="text-[13px] text-white/50 hover:text-white transition-colors duration-200 font-medium">Live Wire</Link>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/sign-in" className="text-[13px] text-white/50 hover:text-white/80 transition-colors duration-200 font-medium">Sign in</Link>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-[13px] font-semibold bg-gradient-to-r from-white to-gray-100 text-gray-900 hover:from-blue-50 hover:to-gray-50 transition-all shadow-lg shadow-white/20"
            >
              Get Started <ArrowRight size={13} strokeWidth={2.5} />
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
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 140])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])

  return (
    <section ref={sectionRef} className="relative min-h-[100vh] flex items-center overflow-hidden pt-20">
      {/* Premium layered background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#070B11] via-[#0A0E17] to-[#050709]" />

      {/* Multi-layer glow effects */}
      <div className="absolute top-0 left-1/4 w-[800px] h-[600px] bg-blue-600/[0.08] rounded-full blur-[180px] opacity-60" />
      <div className="absolute top-1/3 right-0 w-[600px] h-[600px] bg-purple-600/[0.06] rounded-full blur-[160px] opacity-50" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-cyan-600/[0.04] rounded-full blur-[140px]" />

      {/* Animated grid pattern */}
      <motion.div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
        animate={{ backgroundPosition: ['0 0', '80px 80px'] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
      />

      <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 max-w-7xl mx-auto px-6 py-20 w-full">
        {/* Premium badge with enhanced styling */}
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex justify-center mb-10"
        >
          <motion.div
            className="inline-flex items-center gap-3 px-5 py-3 rounded-full border border-white/[0.1] bg-gradient-to-r from-white/[0.05] to-blue-400/[0.03] backdrop-blur"
            whileHover={{ scale: 1.02, borderColor: 'rgba(255,255,255,0.15)' }}
          >
            <motion.span
              className="relative flex h-2.5 w-2.5"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
            </motion.span>
            <span className="text-[13px] text-white/60 font-medium">Real-time intelligence from 35+ global sources</span>
          </motion.div>
        </motion.div>

        {/* Premium headline */}
        <div className="text-center max-w-5xl mx-auto mb-12">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-[52px] md:text-[68px] lg:text-[80px] leading-[1.0] font-bold tracking-[-0.04em] mb-8"
          >
            <motion.span
              className="bg-gradient-to-b from-white via-white/95 to-white/70 bg-clip-text text-transparent block"
              animate={{ backgroundPosition: ['0% 0%', '100% 100%'] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
              style={{ backgroundSize: '200% 200%' }}
            >
              Geopolitical Intelligence
            </motion.span>
            <motion.span
              className="bg-gradient-to-r from-blue-300 via-cyan-300 to-blue-400 bg-clip-text text-transparent block mt-2"
              animate={{ backgroundPosition: ['0% 0%', '100% 100%'] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
              style={{ backgroundSize: '200% 200%' }}
            >
              Radically Accessible
            </motion.span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="text-[18px] md:text-[20px] text-white/45 max-w-3xl mx-auto leading-relaxed mb-12"
          >
            Real-time conflict monitoring, AI-powered threat analysis, and predictive intelligence — all in one platform. What used to require six-figure contracts is now free to start.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row justify-center gap-4 mb-10"
          >
            <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-[15px] font-bold bg-gradient-to-r from-white to-blue-50 text-gray-900 hover:from-blue-50 hover:to-white transition-all shadow-[0_0_60px_rgba(255,255,255,0.1)]"
              >
                Start for Free <Rocket size={16} />
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.95 }}>
              <Link
                href="/wire"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-[15px] font-semibold border-2 border-white/[0.15] text-white/70 hover:text-white hover:border-white/30 transition-all backdrop-blur"
              >
                View Live Feed <ChevronRight size={16} />
              </Link>
            </motion.div>
          </motion.div>

          {/* Trust indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.6 }}
            className="flex flex-wrap justify-center items-center gap-6 text-[13px] text-white/35"
          >
            <span className="flex items-center gap-2"><Check size={14} className="text-emerald-400" /> <span className="font-medium">No credit card required</span></span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span className="flex items-center gap-2"><Check size={14} className="text-emerald-400" /> <span className="font-medium">Free forever tier</span></span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span className="flex items-center gap-2"><Check size={14} className="text-emerald-400" /> <span className="font-medium">Deploy in 60 seconds</span></span>
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
    <section className="relative z-10 border-y border-white/[0.08] py-12" style={{ background: 'linear-gradient(180deg, rgba(7,11,17,0.95) 0%, rgba(7,11,17,0.85) 100%)' }}>
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-center text-[12px] uppercase tracking-[0.25em] text-white/30 font-bold mb-8">Trusted Intelligence Sources</p>
        <motion.div className="flex flex-wrap justify-center gap-x-10 gap-y-4">
          {sources.map((s, i) => (
            <motion.span
              key={s}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
              className="text-[13px] font-semibold text-white/35 hover:text-blue-300 transition-colors duration-300"
            >
              {s}
            </motion.span>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   STATS SECTION
   ═══════════════════════════════════════════════════════════════ */

function StatsSection() {
  const stats = [
    { value: 35, suffix: '+', label: 'Global data sources' },
    { value: 180, suffix: '+', label: 'Countries covered' },
    { value: 15, suffix: 'min', label: 'Ingest frequency' },
    { value: 99, suffix: '.9%', label: 'Uptime SLA' },
  ]

  return (
    <section className="relative z-10 py-24" style={{ background: '#070B11' }}>
      {/* Background accent */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

      <div className="max-w-6xl mx-auto px-6">
        <StaggerWrap className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <StaggerChild key={stat.label}>
              <motion.div
                className="text-center relative group"
                whileHover={{ y: -2 }}
              >
                {/* Background glow on hover */}
                <div className="absolute -inset-6 bg-gradient-to-br from-blue-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />

                <motion.div
                  className="relative text-4xl md:text-5xl font-bold bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent tracking-tight"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                >
                  <AnimatedNumber value={stat.value} suffix={stat.suffix} />
                </motion.div>
                <motion.div
                  className="mt-3 text-[13px] text-white/40 font-medium"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ delay: i * 0.1 + 0.2, duration: 0.5 }}
                >
                  {stat.label}
                </motion.div>
              </motion.div>
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
    { icon: Globe, color: 'from-blue-500/90 to-cyan-500/90', title: 'Conflict Map', desc: 'Interactive 3D globe with ACLED data, live vessel tracking, flight paths, and satellite overlays. Zoom from global to neighborhood precision.', tag: 'Core', large: true },
    { icon: Zap, color: 'from-amber-500/90 to-orange-500/90', title: 'Real-Time Intel Feed', desc: 'Multi-source ingestion from GDELT, ReliefWeb, ACLED, NASA, and 30+ feeds. Auto-classified, deduplicated, and AI-enriched in 15 minutes.', tag: 'Core', large: true },
    { icon: Sparkles, color: 'from-violet-500/90 to-purple-500/90', title: 'AI Intel Copilot', desc: 'Natural language Q&A grounded in your platform data. Sourced answers with citations, never hallucinated guesses.', tag: 'AI' },
    { icon: BarChart3, color: 'from-pink-500/90 to-rose-500/90', title: 'Prediction Engine', desc: 'Monte Carlo simulations, competing hypotheses analysis, and six structured analytic techniques for forward-looking intelligence.', tag: 'AI' },
    { icon: Bell, color: 'from-red-500/90 to-orange-500/90', title: 'Alert Engine & PIRs', desc: 'Define Priority Intelligence Requirements. Auto-trigger via email, webhook, or SMS when conditions change. Five-level escalation.', tag: 'Ops' },
    { icon: Eye, color: 'from-cyan-500/90 to-teal-500/90', title: 'Actor Intelligence', desc: 'Track state actors, armed groups, and key individuals. Relationship graphs, influence scoring, and activity timelines.', tag: 'Intel' },
    { icon: Radio, color: 'from-green-500/90 to-emerald-500/90', title: 'Maritime & Air Tracking', desc: 'Real-time AIS vessel tracking with dark vessel detection. ADS-B flight tracking with military callsign recognition.', tag: 'SIGINT' },
    { icon: TrendingUp, color: 'from-indigo-500/90 to-blue-500/90', title: 'Supply Chain Monitor', desc: 'Map nodes, monitor disruption signals in real-time. Commodity correlations and route risk before cascades hit.', tag: 'Risk' },
    { icon: Lock, color: 'from-slate-400/90 to-gray-500/90', title: 'Sanctions Screening', desc: 'Automated entity matching against OFAC, EU, UN databases. Confidence scoring with continuous background monitoring.', tag: 'Compliance' },
    { icon: Users, color: 'from-sky-500/90 to-blue-500/90', title: 'Personnel Safety', desc: 'Duty-of-care tracking for teams in complex environments. Proximity alerts, check-ins, and evacuation routing.', tag: 'Safety' },
    { icon: Search, color: 'from-emerald-500/90 to-green-500/90', title: 'Geoverification', desc: 'Eight-method verification: shadow analysis, EXIF extraction, map cross-reference. Five-tier confidence system.', tag: 'OSINT' },
    { icon: FileText, color: 'from-blue-400/90 to-indigo-500/90', title: 'Reports & API', desc: 'AI-generated intelligence reports for stakeholders. REST API with Bearer auth and HMAC-signed webhooks for integrations.', tag: 'Platform' },
  ]

  return (
    <section className="relative py-40" style={{ background: '#070B11' }}>
      {/* Background accent */}
      <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(59,130,246,0.3) 0%, transparent 60%)' }} />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <BlurIn className="text-center mb-24">
          <motion.p className="text-[13px] font-bold text-blue-400 tracking-widest uppercase mb-5 flex items-center justify-center gap-2">
            <Sparkles size={14} /> Platform
          </motion.p>
          <h2 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
            <span className="bg-gradient-to-b from-white via-white/95 to-white/70 bg-clip-text text-transparent">
              Everything you need.
            </span>
            <br className="hidden sm:block" />
            <span className="text-white/40 text-4xl md:text-5xl"> Nothing you don&apos;t.</span>
          </h2>
          <p className="text-[17px] text-white/40 max-w-3xl mx-auto leading-relaxed">
            Twelve integrated intelligence modules that work seamlessly together. Every feature is grounded in real data. No vendor lock-in. No compromise.
          </p>
        </BlurIn>

        <StaggerWrap className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => {
            const Icon = f.icon
            return (
              <StaggerChild key={f.title}>
                <motion.div
                  whileHover={{ y: -4, borderColor: 'rgba(255,255,255,0.15)' }}
                  transition={{ duration: 0.3, type: 'spring' as const, stiffness: 200 }}
                  className={`group relative p-7 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.02] to-white/[0.005] hover:from-white/[0.05] hover:to-white/[0.02] transition-all duration-300 cursor-default h-full backdrop-blur-sm overflow-hidden`}
                >
                  {/* Icon background glow */}
                  <div className="absolute -top-8 -right-8 w-32 h-32 bg-gradient-to-br from-white/[0.03] to-transparent rounded-full group-hover:from-white/[0.06] transition-colors opacity-0 group-hover:opacity-100" />

                  <div className="relative flex items-start justify-between mb-4">
                    <motion.div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity duration-300 shadow-lg shadow-black/20`}
                      whileHover={{ scale: 1.1 }}
                    >
                      <Icon size={20} className="text-white" />
                    </motion.div>
                    <span className="text-[10px] uppercase tracking-widest text-white/30 font-bold">{f.tag}</span>
                  </div>
                  <h3 className="text-[16px] font-bold text-white mb-2.5 relative z-10">{f.title}</h3>
                  <p className="text-[13px] text-white/45 leading-relaxed relative z-10">{f.desc}</p>
                </motion.div>
              </StaggerChild>
            )
          })}
        </StaggerWrap>

        <FadeUp delay={0.3} className="text-center mt-16">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link href="/features" className="inline-flex items-center gap-2.5 text-[15px] text-white/50 hover:text-white font-semibold transition-colors duration-200">
              Explore all 12 modules <ArrowRight size={16} strokeWidth={2.5} />
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
      desc: '35+ global sources feed one unified pipeline: conflict events, satellite imagery, vessel positions, flight tracks, news. Auto-classified, deduplicated, enriched.',
      icon: Satellite,
      accent: 'from-blue-500/90 to-cyan-500/90',
      color: 'text-blue-300',
    },
    {
      num: '02',
      title: 'Analyze',
      desc: 'AI-powered correlation connects signals across sources. The copilot answers questions grounded in real data. Monte Carlo models quantify risk with transparency.',
      icon: Activity,
      accent: 'from-violet-500/90 to-purple-500/90',
      color: 'text-violet-300',
    },
    {
      num: '03',
      title: 'Act',
      desc: 'Trigger alerts when conditions change. Push intelligence via webhooks. Generate reports. Get the right signal to the right person at the right time.',
      icon: Crosshair,
      accent: 'from-emerald-500/90 to-green-500/90',
      color: 'text-emerald-300',
    },
  ]

  return (
    <section className="relative py-40 border-t border-white/[0.08]" style={{ background: '#070B11' }}>
      <div className="max-w-7xl mx-auto px-6 relative">
        <BlurIn className="text-center mb-24">
          <p className="text-[13px] font-bold text-blue-400 tracking-widest uppercase mb-5">Workflow</p>
          <h2 className="text-5xl md:text-6xl font-bold text-white tracking-tight mb-6">
            From raw signals to action.
          </h2>
          <p className="text-[16px] text-white/40 max-w-2xl mx-auto">
            A seamless three-step intelligence pipeline that transforms global data into decisions.
          </p>
        </BlurIn>

        <div className="relative grid md:grid-cols-3 gap-8">
          {/* Animated connector line (desktop) */}
          <svg className="hidden md:block absolute top-24 left-0 right-0 w-full h-2 pointer-events-none" viewBox="0 0 1200 20" preserveAspectRatio="none">
            <motion.path
              d="M 0,10 Q 300,5 600,10 T 1200,10"
              stroke="url(#gradientLine)"
              strokeWidth="2"
              fill="none"
              strokeDasharray="1200"
              initial={{ strokeDashoffset: 1200 }}
              whileInView={{ strokeDashoffset: 0 }}
              transition={{ duration: 2 }}
            />
            <defs>
              <linearGradient id="gradientLine" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(59,130,246,0.3)" />
                <stop offset="50%" stopColor="rgba(168,85,247,0.3)" />
                <stop offset="100%" stopColor="rgba(16,185,129,0.3)" />
              </linearGradient>
            </defs>
          </svg>

          {steps.map((step, i) => {
            const Icon = step.icon
            return (
              <FadeUp key={step.num} delay={i * 0.15}>
                <motion.div
                  className="relative p-8 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.03] to-white/[0.01] hover:border-white/[0.15] transition-all duration-300 h-full group"
                  whileHover={{ y: -4 }}
                >
                  {/* Step number circle */}
                  <div className="absolute -top-5 left-6">
                    <motion.div
                      className={`w-10 h-10 rounded-full bg-gradient-to-br ${step.accent} flex items-center justify-center border-2 border-[#070B11] shadow-lg`}
                      whileHover={{ scale: 1.15 }}
                    >
                      <span className="text-white font-bold text-[13px]">{step.num}</span>
                    </motion.div>
                  </div>

                  <motion.div
                    className={`w-14 h-14 rounded-xl bg-gradient-to-br ${step.accent} flex items-center justify-center mb-6 opacity-80 group-hover:opacity-100 transition-opacity duration-300 shadow-lg shadow-black/30`}
                    whileHover={{ scale: 1.1, rotate: 5 }}
                  >
                    <Icon size={24} className="text-white" />
                  </motion.div>

                  <h3 className={`text-2xl font-bold ${step.color} mb-3`}>{step.title}</h3>
                  <p className="text-[14px] text-white/50 leading-relaxed">{step.desc}</p>
                </motion.div>
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
    { role: 'NGO Security Managers', icon: Shield, desc: 'Monitor threat levels across operational areas. Get evacuation alerts before escalation. Duty-of-care tracking with real-time check-ins and proximity alerts.', points: ['Proximity alerts for field teams', 'Automated evacuation routing', 'Daily situation briefings', 'ISO 31030 compliance'] },
    { role: 'Conflict Journalists', icon: Search, desc: 'Verify events via multi-source correlation. Map actor networks and activity timelines. OSINT tools that turn investigative leads into confirmed intelligence.', points: ['Multi-source event verification', 'Actor relationship mapping', 'Geolocation verification tools', 'Source credibility scoring'] },
    { role: 'Corporate Security Teams', icon: Layers, desc: 'Supply chain disruption monitoring, travel risk assessments, sanctions screening. Protect operations and personnel with early warning intelligence.', points: ['Supply chain risk monitoring', 'Travel risk scoring', 'Sanctions compliance checks', 'Vendor due diligence'] },
    { role: 'Government & Defense', icon: Crosshair, desc: 'Situation rooms for active operations. Intelligence feeds, predictive modeling, secure team collaboration with full audit trails.', points: ['Event correlation dashboards', 'Predictive scenario modeling', 'Secure collaboration rooms', 'Complete audit logging'] },
  ]

  const handleSetActive = useCallback((i: number) => setActive(i), [])

  return (
    <section className="relative py-40 border-t border-white/[0.08]" style={{ background: '#070B11' }}>
      <div className="max-w-7xl mx-auto px-6 relative">
        <BlurIn className="text-center mb-20">
          <p className="text-[13px] font-bold text-blue-400 tracking-widest uppercase mb-5">Use Cases</p>
          <h2 className="text-5xl md:text-6xl font-bold text-white tracking-tight mb-6">
            Built for people on the ground.
          </h2>
          <p className="text-[16px] text-white/40 max-w-3xl mx-auto">
            Not another enterprise tool locked behind procurement. ConflictRadar serves the people and organizations who need intelligence most.
          </p>
        </BlurIn>

        <FadeUp>
          <div className="grid md:grid-cols-[300px_1fr] gap-8">
            {/* Tab list */}
            <div className="flex md:flex-col gap-3">
              {personas.map((p, i) => {
                const Icon = p.icon
                return (
                  <motion.button
                    key={p.role}
                    onClick={() => handleSetActive(i)}
                    whileHover={{ x: 4 }}
                    className={`flex items-center gap-4 px-5 py-4 rounded-xl text-left transition-all duration-300 w-full font-semibold ${
                      active === i
                        ? 'bg-gradient-to-r from-blue-500/20 to-blue-500/5 border border-blue-500/30 text-white shadow-lg shadow-blue-500/10'
                        : 'border border-transparent text-white/40 hover:text-white/60 hover:bg-white/[0.03]'
                    }`}
                  >
                    <Icon size={20} className={active === i ? 'text-blue-400' : 'text-white/20 group-hover:text-blue-400'} />
                    <span className="text-[14px]">{p.role}</span>
                  </motion.button>
                )
              })}
            </div>

            {/* Content panel */}
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.95 }}
                transition={{ duration: 0.35, type: 'spring' as const, stiffness: 200 }}
                className="p-10 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01]"
              >
                <h3 className="text-2xl font-bold text-white mb-4">{personas[active]?.role}</h3>
                <p className="text-[15px] text-white/45 leading-relaxed mb-8">{personas[active]?.desc}</p>
                <div className="space-y-3">
                  {(personas[active]?.points ?? []).map((pt) => (
                    <motion.div
                      key={pt}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-3.5"
                    >
                      <motion.div
                        className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500/30 to-blue-500/10 flex items-center justify-center flex-shrink-0 border border-blue-500/20"
                        whileHover={{ scale: 1.2, rotate: 360 }}
                        transition={{ duration: 0.6 }}
                      >
                        <Check size={14} className="text-blue-300" />
                      </motion.div>
                      <span className="text-[14px] text-white/50 font-medium">{pt}</span>
                    </motion.div>
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
    <section className="relative py-40 border-t border-white/[0.08]" style={{ background: '#070B11' }}>
      <div className="max-w-6xl mx-auto px-6">
        <BlurIn className="text-center mb-20">
          <p className="text-[13px] font-bold text-blue-400 tracking-widest uppercase mb-5">Why ConflictRadar</p>
          <h2 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
            <span className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
              Enterprise intelligence.
            </span>
            <br />
            <span className="text-white/40 text-4xl md:text-5xl">Startup pricing.</span>
          </h2>
        </BlurIn>

        <FadeUp>
          <div className="overflow-hidden rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.02] to-white/[0.005]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-gradient-to-r from-white/[0.02] to-transparent">
                    <th className="px-6 py-5 text-white/40 font-bold w-[220px] text-[12px] uppercase tracking-widest">Feature</th>
                    <th className="px-6 py-5 text-blue-300 font-bold bg-gradient-to-b from-blue-500/15 to-blue-500/5 text-[12px] uppercase tracking-widest">ConflictRadar</th>
                    <th className="px-6 py-5 text-white/30 font-bold text-[12px] uppercase tracking-widest">Dataminr</th>
                    <th className="px-6 py-5 text-white/30 font-bold text-[12px] uppercase tracking-widest">Recorded Future</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <motion.tr
                      key={row.feature}
                      className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      transition={{ delay: i * 0.05, duration: 0.4 }}
                    >
                      <td className="px-6 py-4 text-white/50 font-medium">{row.feature}</td>
                      <td className="px-6 py-4 bg-gradient-to-b from-blue-500/10 to-blue-500/5">
                        {typeof row.cr === 'boolean' ? (
                          row.cr ? (
                            <motion.div whileHover={{ scale: 1.2 }}>
                              <Check size={18} className="text-emerald-400" />
                            </motion.div>
                          ) : (
                            <span className="text-white/10">—</span>
                          )
                        ) : (
                          <span className="text-white font-semibold">{row.cr}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {typeof row.d === 'boolean' ? (
                          row.d ? (
                            <Check size={18} className="text-white/25" />
                          ) : (
                            <span className="text-white/10">—</span>
                          )
                        ) : (
                          <span className="text-white/30">{row.d}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {typeof row.rf === 'boolean' ? (
                          row.rf ? (
                            <Check size={18} className="text-white/25" />
                          ) : (
                            <span className="text-white/10">—</span>
                          )
                        ) : (
                          <span className="text-white/30">{row.rf}</span>
                        )}
                      </td>
                    </motion.tr>
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
    <section className="relative py-40 border-t border-white/[0.08] overflow-hidden" style={{ background: '#070B11' }}>
      {/* Premium gradient blooms */}
      <div className="absolute top-0 left-1/4 w-[800px] h-[600px] bg-blue-600/[0.06] rounded-full blur-[180px]" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[400px] bg-cyan-600/[0.05] rounded-full blur-[160px]" />

      <div className="relative max-w-4xl mx-auto px-6 text-center">
        <BlurIn>
          <motion.h2
            className="text-5xl md:text-6xl font-bold tracking-tight mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <span className="bg-gradient-to-b from-white via-white/95 to-white/70 bg-clip-text text-transparent">
              Start making better decisions.
            </span>
          </motion.h2>
          <motion.p
            className="text-[18px] text-white/40 max-w-2xl mx-auto mb-12 leading-relaxed"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
          >
            Free forever tier for individual analysts. No credit card required. Upgrade when your team needs the full operating picture.
          </motion.p>
          <motion.div
            className="flex flex-col sm:flex-row justify-center gap-4"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
              <Link href="/sign-up" className="inline-flex items-center justify-center gap-2.5 px-9 py-4.5 rounded-xl text-[16px] font-bold bg-gradient-to-r from-white to-blue-50 text-gray-900 hover:from-blue-50 hover:to-white transition-all shadow-[0_0_80px_rgba(255,255,255,0.12)]">
                Get Started Free <Rocket size={17} />
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.95 }}>
              <Link href="/pricing" className="inline-flex items-center justify-center gap-2 px-9 py-4.5 rounded-xl text-[16px] font-semibold border-2 border-white/[0.15] text-white/70 hover:text-white hover:border-white/30 transition-all backdrop-blur">
                View Plans <ArrowRight size={17} />
              </Link>
            </motion.div>
          </motion.div>
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
    <footer className="border-t border-white/[0.08] py-16 relative" style={{ background: 'linear-gradient(180deg, #070B11 0%, rgba(7,11,17,0.8) 100%)' }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-5 gap-10 mb-12">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <motion.div className="flex items-center gap-2.5 mb-5" whileHover={{ x: 4 }}>
              <motion.div whileHover={{ rotate: 12, scale: 1.1 }} transition={{ type: 'spring' as const, stiffness: 400 }}>
                <Shield size={20} className="text-blue-400" />
              </motion.div>
              <span className="font-bold text-white text-[15px] tracking-tight">ConflictRadar</span>
            </motion.div>
            <p className="text-[13px] text-white/35 leading-relaxed">
              Geopolitical intelligence for analysts, operators, and organizations in complex environments.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.5 }}>
            <h4 className="text-[12px] font-bold text-white/50 uppercase tracking-[0.15em] mb-5">Product</h4>
            <div className="flex flex-col gap-3">
              <Link href="/features" className="text-[13px] text-white/40 hover:text-blue-300 transition-colors duration-200 font-medium">Features</Link>
              <Link href="/pricing" className="text-[13px] text-white/40 hover:text-blue-300 transition-colors duration-200 font-medium">Pricing</Link>
              <Link href="/wire" className="text-[13px] text-white/40 hover:text-blue-300 transition-colors duration-200 font-medium">Live Wire</Link>
              <Link href="/methods" className="text-[13px] text-white/40 hover:text-blue-300 transition-colors duration-200 font-medium">Methods</Link>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}>
            <h4 className="text-[12px] font-bold text-white/50 uppercase tracking-[0.15em] mb-5">Company</h4>
            <div className="flex flex-col gap-3">
              <Link href="/security" className="text-[13px] text-white/40 hover:text-blue-300 transition-colors duration-200 font-medium">Security</Link>
              <Link href="/privacy" className="text-[13px] text-white/40 hover:text-blue-300 transition-colors duration-200 font-medium">Privacy</Link>
              <Link href="/terms" className="text-[13px] text-white/40 hover:text-blue-300 transition-colors duration-200 font-medium">Terms</Link>
              <Link href="/status" className="text-[13px] text-white/40 hover:text-blue-300 transition-colors duration-200 font-medium">Status</Link>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5 }} className="md:col-span-2">
            <h4 className="text-[12px] font-bold text-white/50 uppercase tracking-[0.15em] mb-5">Get in touch</h4>
            <div className="flex flex-col gap-3">
              <motion.a
                href="mailto:support@conflictradar.co"
                className="text-[13px] text-white/40 hover:text-blue-300 transition-colors duration-200 font-medium inline-flex items-center gap-2 w-fit"
                whileHover={{ x: 4 }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                support@conflictradar.co
              </motion.a>
              <motion.a
                href="mailto:security@conflictradar.co"
                className="text-[13px] text-white/40 hover:text-blue-300 transition-colors duration-200 font-medium inline-flex items-center gap-2 w-fit"
                whileHover={{ x: 4 }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                security@conflictradar.co
              </motion.a>
            </div>
          </motion.div>
        </div>

        <motion.div
          className="pt-10 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <span className="text-[12px] text-white/25">© 2026 ConflictRadar. All rights reserved.</span>
          <div className="flex items-center gap-4 text-[12px] text-white/25">
            <span className="flex items-center gap-1.5">
              <Check size={12} className="text-emerald-400/70" /> GDPR Compliant
            </span>
            <span className="w-1 h-1 rounded-full bg-white/15" />
            <span className="flex items-center gap-1.5">
              <Check size={12} className="text-emerald-400/70" /> SOC 2 In Progress
            </span>
          </div>
        </motion.div>
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
