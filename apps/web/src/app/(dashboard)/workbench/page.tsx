'use client'

import { useEffect, useState, type CSSProperties, type ComponentType } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BarChart3 } from 'lucide-react'
import { MonteCarloEngine } from '@/components/workbench/MonteCarloEngine'
import { ACHMatrix } from '@/components/workbench/ACHMatrix'
import { SATTools } from '@/components/workbench/SATTools'
import { Corkboard } from '@/components/workbench/Corkboard'
import { CaseTimeline } from '@/components/workbench/CaseTimeline'
import { ForecastCalibration } from '@/components/workbench/ForecastCalibration'
import { EscalationLadder } from '@/components/workbench/EscalationLadder'
import { SignalCorrelation } from '@/components/workbench/SignalCorrelation'
import { ForecastSignals } from '@/components/workbench/ForecastSignals'

type ForecastRow = { id: string; country_code?: string | null; region?: string | null; score?: number | null; event_count?: number | null; updated_at?: string | null }
type ForecastSignal = { id: string; conflict_zone?: string | null; country_code?: string | null; signal_type?: string | null; confidence?: number | null; basis?: string | null; valid_until?: string | null }
type CountryRiskScore = { country_code: string; risk_score: number; trend: 'rising' | 'stable' | 'falling'; event_count_7d: number }
type ForecastResponse = { forecasts: ForecastRow[]; signals: ForecastSignal[]; countryRiskScores: CountryRiskScore[] }

const TABS = ['Monte Carlo', 'ACH Matrix', 'SAT Tools', 'Corkboard', 'Timeline', 'Forecasts', 'Calibration', 'Escalation', 'Correlations'] as const
type Tab = (typeof TABS)[number]
const BarChart3Icon = BarChart3 as unknown as ComponentType<{ size?: number; style?: CSSProperties }>

function timeAgo(input?: string | null): string {
  if (!input) return 'unknown'
  const diff = Math.max(0, Date.now() - new Date(input).getTime())
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function WorkbenchPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Monte Carlo')
  const [forecastData, setForecastData] = useState<ForecastResponse>({ forecasts: [], signals: [], countryRiskScores: [] })

  useEffect(() => {
    if (activeTab !== 'Forecasts') return
    void fetch('/api/v1/forecasts', { cache: 'no-store' })
      .then((response) => response.json() as Promise<{ data?: ForecastResponse }>)
      .then((json) => setForecastData(json.data ?? { forecasts: [], signals: [], countryRiskScores: [] }))
      .catch(() => setForecastData({ forecasts: [], signals: [], countryRiskScores: [] }))
  }, [activeTab])

  return (
    <div className="h-full">
      <div className="border-b border-white/[0.05] px-4">
        {TABS.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className="px-4 py-3 text-sm font-medium active:scale-[0.97]" style={{ borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent', color: activeTab === tab ? '#3b82f6' : 'text-white/30' }}>
            {tab}
          </button>
        ))}
      </div>

      <div className="p-6">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            {activeTab === 'Monte Carlo' && <MonteCarloEngine planHasScenarios />}
            {activeTab === 'ACH Matrix' && <ACHMatrix planHasACH />}
            {activeTab === 'SAT Tools' && <SATTools />}
            {activeTab === 'Corkboard' && <Corkboard />}
            {activeTab === 'Timeline' && <CaseTimeline />}
            {activeTab === 'Calibration' && <ForecastCalibration />}
            {activeTab === 'Escalation' && <EscalationLadder />}
            {activeTab === 'Correlations' && <SignalCorrelation />}
            {activeTab === 'Forecasts' && (
              <div className="space-y-6">
                <div className="rounded-xl border border-white/[0.05] bg-white/[0.015]">
                  {forecastData.forecasts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
                      <BarChart3Icon size={32} style={{ color: 'rgba(255,255,255,0.3)' }} />
                      <div className="text-white">Run ingest to generate forecasts</div>
                      <a href="/admin" className="btn-primary rounded-lg bg-blue-500 px-3 py-2 text-sm text-white">Go to Admin</a>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-white/30">
                          <th className="px-4 py-3">Region</th>
                          <th className="px-4 py-3">P50 Score</th>
                          <th className="px-4 py-3">Events 7d</th>
                          <th className="px-4 py-3">Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {forecastData.forecasts.map((row) => {
                          const pct = Math.round((row.score ?? 0) * 100)
                          return (
                            <tr key={row.id} className="border-t border-white/[0.05]">
                              <td className="px-4 py-3 text-white">{row.region || row.country_code || 'Unknown'}</td>
                              <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="h-2 w-40 rounded-full bg-white/[0.05]"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct > 70 ? 'var(--sev-critical)' : pct > 40 ? 'var(--sev-medium)' : 'var(--sev-low)' }} /></div><span className="text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{pct}%</span></div></td>
                              <td className="px-4 py-3 text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{row.event_count ?? 0}</td>
                              <td className="px-4 py-3 text-white/30">{timeAgo(row.updated_at)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                <ForecastSignals signals={forecastData.signals} countryRiskScores={forecastData.countryRiskScores} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
