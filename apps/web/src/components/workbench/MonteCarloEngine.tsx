'use client'

import { useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface Assumption {
  id: string
  parameter: string
  value: number
  min: number
  max: number
  unit?: string
}

interface MonteCarloResult {
  p10: number
  p50: number
  p90: number
  mean: number
  histogram: Array<{ bucket: string; count: number }>
  iterations: number
}

const DEFAULT_ASSUMPTIONS: Assumption[] = [
  { id: '1', parameter: 'Event Frequency', value: 50, min: 0, max: 100, unit: 'events/month' },
  { id: '2', parameter: 'Avg Severity', value: 3, min: 1, max: 5, unit: '/5' },
  { id: '3', parameter: 'Actor Count', value: 4, min: 1, max: 15, unit: 'actors' },
  { id: '4', parameter: 'Displacement Rate', value: 30, min: 0, max: 100, unit: '%' },
]

function runMonteCarlo(assumptions: Assumption[], iterations = 1000): MonteCarloResult {
  const results: number[] = []

  for (let i = 0; i < iterations; i++) {
    let score = 0
    const weights = [0.30, 0.25, 0.20, 0.15]

    assumptions.slice(0, 4).forEach((assumption, idx) => {
      // Uniform distribution ±20% around value
      const range = (assumption.max - assumption.min) * 0.2
      const sampled = assumption.value + (Math.random() * 2 - 1) * range
      const normalized = (sampled - assumption.min) / (assumption.max - assumption.min)
      score += (weights[idx] ?? 0.1) * Math.max(0, Math.min(1, normalized))
    })

    results.push(Math.max(0, Math.min(1, score)))
  }

  results.sort((a, b) => a - b)

  const p10 = results[Math.floor(iterations * 0.1)] ?? 0
  const p50 = results[Math.floor(iterations * 0.5)] ?? 0
  const p90 = results[Math.floor(iterations * 0.9)] ?? 0
  const mean = results.reduce((a, b) => a + b, 0) / iterations

  // Build histogram (10 buckets)
  const bucketSize = 0.1
  const histogram = Array.from({ length: 10 }, (_, i) => {
    const bucketMin = i * bucketSize
    const bucketMax = bucketMin + bucketSize
    const count = results.filter(r => r >= bucketMin && r < bucketMax).length
    return {
      bucket: `${Math.round(bucketMin * 100)}-${Math.round(bucketMax * 100)}%`,
      count,
    }
  })

  return { p10, p50, p90, mean, histogram, iterations }
}

export function MonteCarloEngine({ planHasScenarios }: { planHasScenarios: boolean }) {
  const [assumptions, setAssumptions] = useState<Assumption[]>(DEFAULT_ASSUMPTIONS)
  const [result, setResult] = useState<MonteCarloResult | null>(null)
  const [running, setRunning] = useState(false)

  const runSimulation = useCallback(() => {
    setRunning(true)
    setTimeout(() => {
      const r = runMonteCarlo(assumptions, 1000)
      setResult(r)
      setRunning(false)
    }, 100)
  }, [assumptions])

  if (!planHasScenarios) {
    return (
      <div className="rounded border p-8 text-center" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <div className="text-sm mono mb-2" style={{ color: 'var(--primary)' }}>MONTE CARLO SCENARIO ENGINE</div>
        <div className="text-xs mono" style={{ color: 'var(--text-muted)' }}>
          UPGRADE TO PRO TO ACCESS SCENARIO MODELING
        </div>
        <a href="/settings/billing" className="inline-block mt-4 px-4 py-2 rounded text-xs mono border" style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>
          UPGRADE PLAN →
        </a>
      </div>
    )
  }

  return (
    <div className="rounded border" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="text-xs mono tracking-widest" style={{ color: 'var(--text-muted)' }}>
          MONTE CARLO SCENARIO ENGINE — 1,000 ITERATIONS
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Assumptions */}
        <div>
          <div className="text-xs mono tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
            ASSUMPTIONS (±20% UNIFORM DISTRIBUTION)
          </div>
          {assumptions.map(assumption => (
            <div key={assumption.id} className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs mono" style={{ color: 'var(--text-primary)' }}>
                  {assumption.parameter}
                </span>
                <span className="text-xs mono" style={{ color: 'var(--primary)' }}>
                  {assumption.value}{assumption.unit ? ` ${assumption.unit}` : ''}
                </span>
              </div>
              <input
                type="range"
                min={assumption.min}
                max={assumption.max}
                value={assumption.value}
                onChange={e => {
                  setAssumptions(prev => prev.map(a =>
                    a.id === assumption.id ? { ...a, value: parseFloat(e.target.value) } : a
                  ))
                  setResult(null)
                }}
                className="w-full h-1 rounded appearance-none cursor-pointer"
                style={{ accentColor: 'var(--primary)' }}
              />
              <div className="flex justify-between text-xs mono" style={{ color: 'var(--text-muted)' }}>
                <span>{assumption.min}</span>
                <span>{assumption.max}</span>
              </div>
            </div>
          ))}

          <button
            onClick={runSimulation}
            disabled={running}
            className="w-full py-2 rounded text-xs mono font-bold tracking-wider border transition-colors hover:bg-white/5 disabled:opacity-50"
            style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
          >
            {running ? 'RUNNING SIMULATION...' : 'RUN 1,000 ITERATIONS'}
          </button>
        </div>

        {/* Results */}
        <div>
          <div className="text-xs mono tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
            SIMULATION RESULTS
          </div>

          {!result ? (
            <div className="text-xs mono text-center py-12" style={{ color: 'var(--text-muted)' }}>
              ADJUST ASSUMPTIONS AND RUN SIMULATION
            </div>
          ) : (
            <>
              {/* P10/P50/P90 */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: 'P10 (OPTIMISTIC)', value: result.p10, color: 'var(--alert-green)' },
                  { label: 'P50 (BASE CASE)', value: result.p50, color: 'var(--accent-blue)' },
                  { label: 'P90 (PESSIMISTIC)', value: result.p90, color: 'var(--alert-red)' },
                ].map(stat => (
                  <div key={stat.label} className="rounded border p-2 text-center" style={{ borderColor: 'var(--border)' }}>
                    <div className="text-2xl font-bold mono" style={{ color: stat.color }}>
                      {Math.round(stat.value * 100)}%
                    </div>
                    <div className="text-xs mono mt-1" style={{ color: 'var(--text-muted)' }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Histogram */}
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={result.histogram} margin={{ top: 0, right: 0, bottom: 0, left: -30 }}>
                    <XAxis dataKey="bucket" tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'monospace' }} />
                    <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'monospace' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--bg-surface-2)',
                        border: '1px solid var(--border)',
                        fontSize: 11,
                        fontFamily: 'monospace',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <Bar dataKey="count" fill="var(--primary)" opacity={0.8} />
                    <ReferenceLine x={`${Math.round(result.p50 * 100)}-${Math.round(result.p50 * 100) + 10}%`} stroke="var(--accent-blue)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
