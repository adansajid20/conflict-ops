'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface KpiStripProps {
  kpis: {
    eventsWindow: number
    hotRegionCount: number
    breaking2h: number
    activeConflictZones: number
    mostActiveRegion: string | null
    activeAlertsCount: number
  }
  lastUpdatedAt: string | null
}

function Dot({ colorClass, pulse = false }: { colorClass: string; pulse?: boolean }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${colorClass} ${pulse ? 'animate-pulse' : ''}`} />
}

function AnimatedCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const duration = 1000
    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setDisplay(Math.round(eased * value))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [value])
  return <>{display}</>
}

function StatCard({
  href,
  label,
  value,
  accentClass,
  meta,
}: {
  href: string
  label: string
  value: string | number
  accentClass?: string
  meta?: React.ReactNode
}) {
  const isNumeric = typeof value === 'number'

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    >
      <Link
        href={href}
        className="block bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 transition-all duration-200 hover:bg-white/[0.04] hover:border-white/[0.08]"
      >
        <div className="text-[10px] uppercase tracking-[0.15em] text-white/25 font-medium">
          {label}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className={`text-2xl font-bold ${accentClass ?? 'text-white'}`}>
            {isNumeric ? <AnimatedCounter value={value} /> : value}
          </div>
          {meta}
        </div>
      </Link>
    </motion.div>
  )
}

export function KpiStrip({ kpis }: KpiStripProps) {
  const activeConflictColorClass =
    kpis.activeConflictZones > 5 ? 'text-red-400' : kpis.activeConflictZones > 2 ? 'text-orange-400' : undefined

  const alertColorClass =
    kpis.activeAlertsCount > 10 ? 'text-red-400' : kpis.activeAlertsCount > 0 ? 'text-amber-400' : 'text-white/30'

  const cards = [
    <StatCard key="conflicts" href="/situations" label="Active Conflicts" value={kpis.activeConflictZones} accentClass={activeConflictColorClass} />,
    <StatCard key="breaking" href="/feed?severity=4&window=2h" label="Breaking" value={kpis.breaking2h} accentClass={kpis.breaking2h > 0 ? 'text-red-400' : undefined} meta={kpis.breaking2h > 0 ? <Dot colorClass="bg-red-400" pulse /> : undefined} />,
    <StatCard key="events" href="/feed?window=24h" label="Events Today" value={kpis.eventsWindow} />,
    <StatCard key="regions" href="/analysis/countries" label="Hot Regions" value={kpis.hotRegionCount} accentClass="text-orange-400" />,
    <StatCard key="alerts" href="/alerts" label="Unread Alerts" value={kpis.activeAlertsCount} accentClass={alertColorClass} meta={kpis.activeAlertsCount > 0 ? <Dot colorClass="bg-amber-400" pulse /> : undefined} />,
  ]

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((card, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24, delay: i * 0.08 }}
        >
          {card}
        </motion.div>
      ))}
    </div>
  )
}
