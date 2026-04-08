'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, FileText, Clock, Download, Share2, Zap } from 'lucide-react'

type Report = { id: string; report_type: string; title: string; summary: string | null; region: string | null; created_at: string }

const TYPE_COLORS: Record<string, string> = {
  daily_briefing: '#3b82f6',
  weekly_summary: '#a78bfa',
  region_deep_dive: '#22c55e',
  incident_report: '#ef4444',
  flash_report: '#f97316',
  prediction_report: '#eab308',
  custom: '#64748b',
}
const TYPE_ICONS: Record<string, string> = {
  daily_briefing: '📅',
  weekly_summary: '📊',
  region_deep_dive: '🔍',
  incident_report: '🚨',
  flash_report: '⚡',
  prediction_report: '🔮',
  custom: '📝',
}

const SPRING_SNAPPY = { stiffness: 400, damping: 30 }

export function ReportsClient() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genRegion, setGenRegion] = useState('')
  const [selectedType, setSelectedType] = useState<string>('region_deep_dive')

  useEffect(() => {
    fetch('/api/v1/reports?limit=30')
      .then(r => r.json())
      .then(d => { setReports((d as { reports: Report[] }).reports ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const generateReport = async () => {
    if (!genRegion.trim()) return
    setGenerating(true)
    try {
      const res = await fetch('/api/v1/reports/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ report_type: selectedType, region: genRegion }),
      })
      const data = await res.json() as { report?: Report }
      if (data.report) {
        setReports(prev => [data.report as Report, ...prev])
        setGenRegion('')
      }
    } catch { /* ok */ }
    setGenerating(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#070B11] flex items-center justify-center">
      <motion.div
        className="text-white/50 text-sm"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        Loading reports…
      </motion.div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#070B11] px-8 py-10 space-y-8">
      {/* Header */}
      <motion.div
        className="space-y-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
            <FileText className="w-8 h-8 text-blue-400" />
            Intelligence Reports
          </h1>
          <p className="text-sm text-white/40">Curated geopolitical intelligence for your stakeholders</p>
        </div>

        {/* Report Generator Card */}
        <motion.div
          className="rounded-2xl border overflow-hidden p-6"
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(59,130,246,0.05) 100%)',
            borderColor: 'rgba(59,130,246,0.2)',
          }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, type: 'spring' as const, ...SPRING_SNAPPY }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent" />

          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-400" />
            Generate New Report
          </h2>

          <div className="space-y-4">
            {/* Report type selector */}
            <div>
              <label className="text-xs uppercase text-white/40 font-semibold tracking-wider mb-2 block">
                Report Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(TYPE_COLORS).map(([type, color]) => (
                  <motion.button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className="px-3 py-2 rounded-lg text-xs font-semibold border transition-all uppercase tracking-wider"
                    style={{
                      background: selectedType === type ? color + '15' : 'transparent',
                      borderColor: selectedType === type ? color : 'rgba(255,255,255,0.1)',
                      color: selectedType === type ? color : 'rgba(255,255,255,0.5)',
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {TYPE_ICONS[type]} {type.replace(/_/g, ' ')}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Region input */}
            <div>
              <label className="text-xs uppercase text-white/40 font-semibold tracking-wider mb-2 block">
                Region or Focus
              </label>
              <div className="flex gap-3">
                <input
                  value={genRegion}
                  onChange={e => setGenRegion(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && generateReport()}
                  placeholder="e.g., Ukraine, Middle East, Taiwan…"
                  className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 text-white placeholder:text-white/30 transition-colors"
                />
                <motion.button
                  onClick={generateReport}
                  disabled={generating || !genRegion.trim()}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold border border-blue-500 text-blue-400 hover:border-blue-400 transition-all disabled:opacity-50"
                  style={{
                    background: generating ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)',
                  }}
                >
                  <Plus className="w-4 h-4" />
                  {generating ? 'Generating…' : 'Generate'}
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Reports List */}
      {reports.length === 0 ? (
        <motion.div
          className="text-center py-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <FileText className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/40 text-sm">No reports yet. Generate your first one above.</p>
        </motion.div>
      ) : (
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ staggerChildren: 0.05 }}
        >
          <h2 className="text-lg font-bold text-white">Recent Reports</h2>
          <AnimatePresence>
            {reports.map((report, i) => {
              const color = TYPE_COLORS[report.report_type] ?? '#64748b'
              const icon = TYPE_ICONS[report.report_type] ?? '📝'

              return (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: i * 0.05 }}
                  className="group rounded-2xl border overflow-hidden p-6 cursor-pointer transition-all"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
                    borderColor: 'rgba(255,255,255,0.06)',
                  }}
                  whileHover={{
                    borderColor: color + '60',
                    boxShadow: `0 0 20px ${color}20`,
                  }}
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <motion.span
                          className="text-sm font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider"
                          style={{ color, background: color + '15', border: `1px solid ${color}30` }}
                        >
                          {icon} {report.report_type.replace(/_/g, ' ')}
                        </motion.span>
                        {report.region && (
                          <span className="text-xs text-white/50">📍 {report.region}</span>
                        )}
                      </div>
                      <motion.h3 className="text-lg font-bold text-white line-clamp-2">
                        {report.title}
                      </motion.h3>
                      {report.summary && (
                        <p className="text-sm text-white/60 line-clamp-2">
                          {report.summary.slice(0, 150)}…
                        </p>
                      )}
                    </div>

                    <motion.div
                      className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      initial={{ opacity: 0 }}
                      whileHover={{ opacity: 1 }}
                    >
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="p-2 rounded-lg hover:bg-white/[0.05] transition-colors"
                        title="Download PDF"
                      >
                        <Download className="w-4 h-4 text-white/60" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="p-2 rounded-lg hover:bg-white/[0.05] transition-colors"
                        title="Share Report"
                      >
                        <Share2 className="w-4 h-4 text-white/60" />
                      </motion.button>
                    </motion.div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-white/40 pt-4 border-t border-white/[0.05]">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(report.created_at).toLocaleDateString()} at {new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}
