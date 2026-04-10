'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Database,
  Users,
  Radio,
  BookOpen,
  Clock,
  Shield,
} from 'lucide-react'

interface Indicator {
  indicator: string
  code: string
  weight: string
  scale: string
  definition: string
  calculation: string[]
  interpretation: Record<string, string>
  example: string
  data_sources: string[]
  limitations?: string
}

interface MethodologyData {
  methodology_version: string
  publication_date: string
  title: string
  abstract: string
  principles: string[]
  indicators: Indicator[]
  overall_score_calculation: {
    formula: string
    description: string
    result_range: string
    grade_mapping: Record<string, string>
  }
  data_quality: {
    confidence_levels: Record<string, string>
    date_ranges: Record<string, string>
    event_count_note: string
  }
  limitations: string[]
  use_cases: string[]
  future_enhancements: string[]
  contact_and_updates: {
    organization: string
    methodology_version: string
    last_updated: string
    update_frequency: string
    contact: string
    feedback: string
  }
}

interface Props {
  initialData: MethodologyData | null
}

// Icon type casting
const IconChevronDown = ChevronDown as React.ComponentType<{ className?: string; size?: number }>
const IconCheck = CheckCircle2 as React.ComponentType<{ className?: string; size?: number }>
const IconAlert = AlertCircle as React.ComponentType<{ className?: string; size?: number }>
const IconTrend = TrendingUp as React.ComponentType<{ className?: string; size?: number }>
const IconDatabase = Database as React.ComponentType<{ className?: string; size?: number }>
const IconUsers = Users as React.ComponentType<{ className?: string; size?: number }>
const IconRadio = Radio as React.ComponentType<{ className?: string; size?: number }>
const IconBook = BookOpen as React.ComponentType<{ className?: string; size?: number }>
const IconClock = Clock as React.ComponentType<{ className?: string; size?: number }>
const IconShield = Shield as React.ComponentType<{ className?: string; size?: number }>

const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 400, damping: 30 }

function GradeMapping() {
  const grades = [
    { grade: 'A', range: '90-100', label: 'Very Stable', color: 'from-green-600 to-green-400', text: 'text-green-300' },
    { grade: 'B', range: '80-89', label: 'Stable', color: 'from-emerald-600 to-emerald-400', text: 'text-emerald-300' },
    { grade: 'C', range: '70-79', label: 'Mixed', color: 'from-yellow-600 to-yellow-400', text: 'text-yellow-300' },
    { grade: 'D', range: '60-69', label: 'Concerning', color: 'from-orange-600 to-orange-400', text: 'text-orange-300' },
    { grade: 'E', range: '50-59', label: 'Very Concerning', color: 'from-red-700 to-red-400', text: 'text-red-300' },
    { grade: 'F', range: '0-49', label: 'Critical', color: 'from-red-800 to-red-500', text: 'text-red-200' },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {grades.map((item, idx) => (
        <motion.div
          key={item.grade}
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_SNAPPY, delay: idx * 0.05 }}
          className="rounded-lg border border-white/10 p-4 bg-white/[0.02]"
        >
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg mb-3 bg-gradient-to-br ${item.color}`}>
            <span className={`text-2xl font-bold ${item.text}`}>{item.grade}</span>
          </div>
          <div className="text-sm font-semibold text-white mb-1">{item.label}</div>
          <div className="text-xs text-white/50 font-mono">{item.range}</div>
        </motion.div>
      ))}
    </div>
  )
}

function IndicatorCard({ indicator, index }: { indicator: Indicator; index: number }) {
  const [expanded, setExpanded] = useState(false)

  const IconMap: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
    'CI': IconTrend,
    'GS': IconDatabase,
    'ET': IconChevronDown,
    'AF': IconUsers,
    'IA': IconRadio,
  }

  const Icon = IconMap[indicator.code] || IconDatabase

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_SNAPPY, delay: index * 0.05 }}
      className="rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden hover:border-white/20 transition-colors"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-4 p-5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon className="w-5 h-5 text-blue-400" />
        </div>

        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-white">{indicator.indicator}</h3>
            <span className="text-xs font-mono text-cyan-400 bg-cyan-500/20 px-2 py-1 rounded">
              {indicator.code}
            </span>
            <span className="text-xs font-mono text-white/40">{indicator.weight}</span>
          </div>
          <p className="text-sm text-white/60">{indicator.definition}</p>
        </div>

        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ type: 'spring' as const, stiffness: 300, damping: 30 }}
          className="flex-shrink-0"
        >
          <IconChevronDown className="w-5 h-5 text-white/40" />
        </motion.div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t border-white/10"
          >
            <div className="p-5 space-y-4">
              {/* Calculation */}
              <div>
                <h4 className="text-xs uppercase font-bold text-white/60 mb-3 flex items-center gap-2">
                  <IconBook className="w-4 h-4" />
                  Calculation Steps
                </h4>
                <ol className="space-y-2">
                  {indicator.calculation.map((step, i) => (
                    <li key={i} className="text-sm text-white/70 pl-5 relative">
                      <span className="absolute left-0 text-white/30 font-mono text-xs">{i + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Interpretation */}
              <div>
                <h4 className="text-xs uppercase font-bold text-white/60 mb-3">Score Interpretation</h4>
                <div className="space-y-2">
                  {Object.entries(indicator.interpretation).map(([range, desc]) => (
                    <div key={range} className="flex gap-3 text-sm bg-white/[0.03] rounded p-2 border border-white/5">
                      <span className="font-mono text-cyan-400 flex-shrink-0 font-bold">{range}</span>
                      <span className="text-white/70">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Example */}
              <div className="bg-green-500/10 border border-green-500/20 rounded p-3">
                <p className="text-xs uppercase font-bold text-green-400 mb-1 flex items-center gap-2">
                  <IconCheck className="w-4 h-4" />
                  Example
                </p>
                <p className="text-sm text-green-300/80">{indicator.example}</p>
              </div>

              {/* Data Sources */}
              <div>
                <h4 className="text-xs uppercase font-bold text-white/60 mb-2 flex items-center gap-2">
                  <IconDatabase className="w-4 h-4" />
                  Data Sources
                </h4>
                <div className="flex flex-wrap gap-2">
                  {indicator.data_sources.map((source) => (
                    <span key={source} className="text-xs text-white/60 font-mono bg-white/[0.05] px-2 py-1 rounded">
                      {source}
                    </span>
                  ))}
                </div>
              </div>

              {/* Limitations */}
              {indicator.limitations && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded p-3">
                  <p className="text-xs uppercase font-bold text-orange-400 mb-1 flex items-center gap-2">
                    <IconAlert className="w-4 h-4" />
                    Limitations
                  </p>
                  <p className="text-sm text-orange-300/80">{indicator.limitations}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function MethodologyClient({ initialData }: Props) {
  const [activeTab, setActiveTab] = useState<'indicators' | 'sources' | 'limits' | 'faq'>('indicators')
  const [data, setData] = useState<MethodologyData | null>(initialData)
  const [fetchError, setFetchError] = useState(false)

  // Client-side fetch when server-side data is unavailable
  useEffect(() => {
    if (initialData) return // Already have data from server
    fetch('/api/v1/risk-scores/methodology')
      .then(r => {
        if (!r.ok) throw new Error('Failed')
        return r.json()
      })
      .then(json => {
        setData(json.data || json)
      })
      .catch(() => setFetchError(true))
  }, [initialData])

  if (!data && !fetchError) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/50">Loading methodology...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-white/60">Failed to load methodology data.</p>
          <button
            onClick={() => {
              setFetchError(false)
              fetch('/api/v1/risk-scores/methodology')
                .then(r => r.json())
                .then(json => setData(json.data || json))
                .catch(() => setFetchError(true))
            }}
            className="px-4 py-2 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 transition-colors text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full overflow-auto">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING_SNAPPY, delay: 0.1 }}
        className="border-b border-white/10 bg-gradient-to-r from-white/[0.02] via-white/[0.01] to-white/[0.02] backdrop-blur px-6 py-8"
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <IconShield className="w-6 h-6 text-cyan-400" />
            <span className="text-xs uppercase font-bold text-cyan-400 tracking-widest">Transparency</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">{data.title}</h1>
          <p className="text-white/60 text-lg max-w-4xl">{data.abstract}</p>

          {/* Version Info */}
          <div className="flex items-center gap-6 mt-6 text-xs text-white/40 font-mono">
            <div className="flex items-center gap-2">
              <IconShield className="w-4 h-4 text-cyan-400" />
              {data.methodology_version}
            </div>
            <div className="flex items-center gap-2">
              <IconClock className="w-4 h-4 text-cyan-400" />
              Last updated: {data.publication_date}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <div className="border-b border-white/10 bg-white/[0.01] sticky top-0 z-10 px-6">
        <div className="max-w-6xl mx-auto flex items-center gap-1">
          {[
            { key: 'indicators', label: 'Indicators' },
            { key: 'sources', label: 'Data Quality' },
            { key: 'limits', label: 'Limitations' },
            { key: 'faq', label: 'FAQ' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-white/50 hover:text-white/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-8 max-w-6xl mx-auto">
        {/* Indicators Tab */}
        {activeTab === 'indicators' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            {/* Principles */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <IconShield className="w-6 h-6 text-cyan-400" />
                Core Principles
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.principles.map((principle, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ ...SPRING_SNAPPY, delay: idx * 0.05 }}
                    className="flex gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/10"
                  >
                    <IconCheck className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-white/70">{principle}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Overall Scoring */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <IconTrend className="w-6 h-6 text-cyan-400" />
                Overall Score Calculation
              </h2>
              <div className="space-y-4">
                <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-6">
                  <div className="text-center mb-4">
                    <p className="text-sm text-white/60 mb-2">Formula</p>
                    <p className="text-2xl font-mono text-cyan-400 font-bold">
                      {data.overall_score_calculation.formula}
                    </p>
                  </div>
                  <p className="text-sm text-white/70 text-center">
                    {data.overall_score_calculation.description}
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Grade Mapping</h3>
                  <GradeMapping />
                </div>
              </div>
            </div>

            {/* Indicators */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <IconDatabase className="w-6 h-6 text-cyan-400" />
                Six Indicators ({data.indicators.length})
              </h2>
              <div className="space-y-4">
                {data.indicators.map((indicator, idx) => (
                  <IndicatorCard key={indicator.code} indicator={indicator} index={idx} />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Data Quality Tab */}
        {activeTab === 'sources' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            <div>
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <IconDatabase className="w-6 h-6 text-cyan-400" />
                Data Quality & Confidence
              </h2>

              {/* Confidence Levels */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-white mb-4">Confidence Levels</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(data.data_quality.confidence_levels).map(([level, desc]) => (
                    <motion.div
                      key={level}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={SPRING_SNAPPY}
                      className="rounded-lg border border-white/10 bg-white/[0.02] p-4"
                    >
                      <h4 className="text-sm font-bold text-white capitalize mb-2">{level}</h4>
                      <p className="text-sm text-white/60">{desc}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Date Ranges */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-white mb-4">Date Ranges</h3>
                <div className="space-y-3">
                  {Object.entries(data.data_quality.date_ranges).map(([key, value]) => (
                    <div key={key} className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                      <div className="text-sm font-mono text-cyan-400 mb-1">{key}</div>
                      <p className="text-sm text-white/60">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Event Count Note */}
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-5">
                <p className="text-sm text-blue-300">{data.data_quality.event_count_note}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Limitations Tab */}
        {activeTab === 'limits' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            <div>
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <IconAlert className="w-6 h-6 text-orange-400" />
                Limitations & Caveats
              </h2>

              <p className="text-white/60 mb-6 text-base">
                We believe in radical transparency. Here are the honest limitations of our methodology that stakeholders should understand.
              </p>

              <div className="space-y-4">
                {data.limitations.map((limitation, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ ...SPRING_SNAPPY, delay: idx * 0.05 }}
                    className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-5"
                  >
                    <div className="flex gap-3">
                      <IconAlert className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-white/80">{limitation}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-8">
                <h3 className="text-lg font-semibold text-white mb-4">Future Enhancements</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.future_enhancements.map((enhancement, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ ...SPRING_SNAPPY, delay: idx * 0.05 }}
                      className="flex gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20"
                    >
                      <IconTrend className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-blue-300/90">{enhancement}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* FAQ Tab */}
        {activeTab === 'faq' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            <div>
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <IconBook className="w-6 h-6 text-cyan-400" />
                Frequently Asked Questions
              </h2>

              <div className="space-y-4">
                {[
                  {
                    q: 'How often are scores updated?',
                    a: 'Risk scores are recalculated whenever new events are ingested (typically every 15 minutes to 1 hour depending on the data source). Scores update in real-time as new data arrives.',
                  },
                  {
                    q: 'What is the difference between ConflictRadar and ACLED?',
                    a: 'ConflictRadar extends ACLED methodology with additional data sources (humanitarian, environmental, cyber) and broader risk indicators. We measure not just armed conflict but overall instability risk.',
                  },
                  {
                    q: 'Can I use these scores for investment decisions?',
                    a: 'Our scores provide a data-driven baseline for risk assessment, but should be supplemented with human judgment, sector-specific analysis, and your organization\'s risk tolerance. We recommend using scores as one input among many.',
                  },
                  {
                    q: 'How do you handle data gaps or underreporting?',
                    a: 'We acknowledge that some regions have lower reporting density. Low event counts reduce confidence levels. Absence of events may indicate true stability or underreporting—we flag this distinction in data quality fields.',
                  },
                  {
                    q: 'What is your update schedule for methodology changes?',
                    a: `We review methodology quarterly. Significant changes are published as new versions (e.g., v1.0 to v1.1). Minor clarifications and thresholds may be updated monthly.`,
                  },
                  {
                    q: 'How can I provide feedback or validation?',
                    a: `We welcome external validation and research. Contact ${data.contact_and_updates.contact} with feedback, questions, or validation studies.`,
                  },
                ].map((faq, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ ...SPRING_SNAPPY, delay: idx * 0.05 }}
                    className="rounded-lg border border-white/10 bg-white/[0.02] p-5"
                  >
                    <h3 className="text-base font-semibold text-white mb-3">{faq.q}</h3>
                    <p className="text-sm text-white/70">{faq.a}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Contact */}
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-6">
              <h3 className="text-lg font-semibold text-cyan-300 mb-3 flex items-center gap-2">
                <IconRadio className="w-5 h-5" />
                Get in Touch
              </h3>
              <p className="text-sm text-cyan-300/80 mb-4">
                Questions about methodology? We&apos;d love to hear from you.
              </p>
              <div className="text-sm text-cyan-400 font-mono">
                {data.contact_and_updates.contact}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={SPRING_SNAPPY}
        className="border-t border-white/10 bg-white/[0.01] mt-12 px-6 py-8"
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h4 className="text-sm font-bold text-white/60 uppercase mb-3">Version Info</h4>
              <div className="space-y-2 text-xs text-white/50 font-mono">
                <div>{data.contact_and_updates.methodology_version}</div>
                <div>Last updated: {data.contact_and_updates.last_updated}</div>
                <div>Review: {data.contact_and_updates.update_frequency}</div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white/60 uppercase mb-3">Use Cases</h4>
              <ul className="space-y-1 text-xs text-white/60">
                {data.use_cases.slice(0, 3).map((useCase, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="text-cyan-400">•</span>
                    <span>{useCase}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white/60 uppercase mb-3">Contact</h4>
              <p className="text-xs text-cyan-400 font-mono">
                {data.contact_and_updates.contact}
              </p>
            </div>
          </div>
          <div className="border-t border-white/10 mt-6 pt-6">
            <p className="text-xs text-white/40 text-center">
              ConflictRadar Methodology © 2026. All rights reserved. This documentation is provided for transparency and educational purposes.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
