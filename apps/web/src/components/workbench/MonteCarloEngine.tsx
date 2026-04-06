'use client'

import { useState, useCallback } from 'react'

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
      <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-8 text-center">
        <div className="mb-2 text-sm mono text-blue-400">MONTE CARLO SCENARIO ENGINE</div>
        <div className="text-xs mono text-white/50">
          UPGRADE TO PRO TO ACCESS SCENARIO MODELING
        </div>
        <a href="/settings/billing" className="mt-4 inline-block rounded-lg border border-blue-500 px-4 py-2 text-xs mono text-white hover:bg-blue-600" style={{ backgroundColor: '#3B82F6' }}>
          UPGRADE PLAN →
        </a>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.015]">
      <div className="border-b border-white/[0.05] px-4 py-3">
        <div className="text-xs mono tracking-widest text-white/50">
          MONTE CARLO SCENARIO ENGINE — 1,000 ITERATIONS
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 p-4 lg:grid-cols-2">
        <div>
          <div className="mb-3 text-xs mono tracking-widest text-white/50">
            ASSUMPTIONS (±20% UNIFORM DISTRIBUTION)
          </div>
          {assumptions.map(assumption => (
            <div key={assumption.id} className="mb-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs mono text-white">
                  {assumption.parameter}
                </span>
                <span className="text-xs mono text-blue-400">
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
                className="w-full h-1 appearance-none cursor-pointer rounded"
                style={{ accentColor: '#3B82F6' }}
              />
              <div className="flex justify-between text-xs mono text-white/50">
                <span>{assumption.min}</span>
                <span>{assumption.max}</span>
              </div>
            </div>
          ))}

          <button
            onClick={runSimulation}
            disabled={running}
            className="w-full rounded-lg border border-blue-500 px-4 py-2 text-xs mono font-bold tracking-wider text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
            style={{ backgroundColor: '#3B82F6' }}
          >
            {running ? 'RUNNING SIMULATION...' : 'RUN 1,000 ITERATIONS'}
          </button>
        </div>

        <div>
          <div className="mb-3 text-xs mono tracking-widest text-white/50">
            SIMULATION RESULTS
          </div>

          {!result ? (
            <div className="py-12 text-center text-xs mono text-white/50">
              ADJUST ASSUMPTIONS AND RUN SIMULATION
            </div>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-3 gap-2">
                {[
                  { label: 'P10 (OPTIMISTIC)', value: result.p10, color: '#22C55E' },
                  { label: 'P50 (BASE CASE)', value: result.p50, color: '#3B82F6' },
                  { label: 'P90 (PESSIMISTIC)', value: result.p90, color: '#EF4444' },
                ].map(stat => (
                  <div key={stat.label} className="rounded-lg border border-white/[0.05] bg-white/[0.025] p-2 text-center">
                    <div className="mono text-2xl font-bold" style={{ color: stat.color }}>
                      {Math.round(stat.value * 100)}%
                    </div>
                    <div className="mono mt-1 text-xs text-white/50">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-white/[0.05] bg-white/[0.025] p-3">
                <div className="flex h-32 items-end gap-1">
                  {result.histogram.map((bar, idx) => {
                    const maxCount = Math.max(...result.histogram.map(h => h.count), 1)
                    const height = `${Math.max((bar.count / maxCount) * 100, 4)}%`
                    const isMedianBucket = idx === Math.min(Math.floor(result.p50 * 10), 9)
                    return (
                      <div key={bar.bucket} className="flex h-full flex-1 flex-col items-center justify-end">
                        <div
                          className="w-full rounded-t"
                          style={{
                            height,
                            backgroundColor: isMedianBucket ? '#3B82F6' : '#3B82F6',
                            opacity: 0.85,
                            minHeight: '4px',
                          }}
                          title={`${bar.bucket}: ${bar.count}`}
                        />
                        <div className="mono mt-1 text-[9px] text-white/50">
                          {bar.bucket.split('-')[0]}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="mono mt-2 text-xs text-white/50">
                  Mean: {Math.round(result.mean * 100)}% · Median bucket highlighted in blue
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
