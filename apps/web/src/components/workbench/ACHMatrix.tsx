'use client'

import { useState } from 'react'

type EvidenceRating = 'consistent' | 'inconsistent' | 'neutral' | 'na'

interface Evidence {
  id: string
  title: string
  credibility: 1 | 2 | 3 | 4 | 5
}

interface Hypothesis {
  id: string
  title: string
  description: string
  status: 'active' | 'confirmed' | 'refuted' | 'suspended'
  probability: number
}

type Matrix = Record<string, Record<string, EvidenceRating>>

const STATUS_COLORS: Record<string, string> = {
  active: 'var(--accent-blue)',
  confirmed: 'var(--alert-green)',
  refuted: 'var(--alert-red)',
  suspended: 'var(--text-muted)',
}

const RATING_STYLES: Record<EvidenceRating, { color: string; label: string }> = {
  consistent: { color: 'var(--alert-green)', label: 'C' },
  inconsistent: { color: 'var(--alert-red)', label: 'I' },
  neutral: { color: 'var(--text-muted)', label: 'N' },
  na: { color: 'var(--border)', label: '—' },
}

function computeInconsistencyScore(
  hypothesis: Hypothesis,
  evidenceList: Evidence[],
  matrix: Matrix
): number {
  let score = 0
  for (const evidence of evidenceList) {
    const rating = matrix[hypothesis.id]?.[evidence.id] ?? 'na'
    if (rating === 'inconsistent') {
      score += evidence.credibility
    }
  }
  return score
}

export function ACHMatrix({ planHasACH }: { planHasACH: boolean }) {
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([
    { id: '1', title: 'State-sponsored escalation', description: 'Actor A is being directed by a state sponsor to escalate conflict', status: 'active', probability: 0.45 },
    { id: '2', title: 'Resource conflict', description: 'Violence is driven by competition for natural resources', status: 'active', probability: 0.35 },
  ])
  const [evidence, setEvidence] = useState<Evidence[]>([
    { id: 'e1', title: 'Satellite imagery shows military buildup', credibility: 4 },
    { id: 'e2', title: 'Intercepted communications reference foreign handler', credibility: 3 },
    { id: 'e3', title: 'Local reports of resource disputes', credibility: 2 },
  ])
  const [matrix, setMatrix] = useState<Matrix>({})
  const [newHypothesis, setNewHypothesis] = useState('')

  if (!planHasACH) {
    return (
      <div className="rounded border p-8 text-center" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <div className="text-sm mono mb-2" style={{ color: 'var(--primary)' }}>ACH MATRIX</div>
        <div className="text-xs mono" style={{ color: 'var(--text-muted)' }}>
          UPGRADE TO PRO TO ACCESS ANALYSIS OF COMPETING HYPOTHESES
        </div>
      </div>
    )
  }

  const cycleRating = (hypId: string, evId: string) => {
    const current = matrix[hypId]?.[evId] ?? 'na'
    const cycle: EvidenceRating[] = ['na', 'consistent', 'inconsistent', 'neutral']
    const nextIdx = (cycle.indexOf(current) + 1) % cycle.length
    setMatrix(prev => ({
      ...prev,
      [hypId]: { ...(prev[hypId] ?? {}), [evId]: cycle[nextIdx] ?? 'na' },
    }))
  }

  const rankedHypotheses = [...hypotheses].sort(
    (a, b) =>
      computeInconsistencyScore(a, evidence, matrix) -
      computeInconsistencyScore(b, evidence, matrix)
  )

  return (
    <div className="rounded border" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="text-xs mono tracking-widest" style={{ color: 'var(--text-muted)' }}>
          ANALYSIS OF COMPETING HYPOTHESES (ACH)
        </div>
        <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          CLICK CELLS TO CYCLE: — → C (consistent) → I (inconsistent) → N (neutral)
        </div>
      </div>

      <div className="p-4 overflow-x-auto">
        {/* Matrix table */}
        <table className="w-full text-xs mono" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="text-left p-2" style={{ color: 'var(--text-muted)', minWidth: '200px' }}>
                HYPOTHESIS
              </th>
              {evidence.map(ev => (
                <th key={ev.id} className="p-2 text-center" style={{ color: 'var(--text-muted)', minWidth: '80px' }}>
                  <div className="truncate max-w-20 text-xs">{ev.title.substring(0, 20)}</div>
                  <div style={{ color: 'var(--accent-blue)' }}>CR:{ev.credibility}</div>
                </th>
              ))}
              <th className="p-2 text-center" style={{ color: 'var(--text-muted)' }}>INCON. SCORE</th>
              <th className="p-2 text-center" style={{ color: 'var(--text-muted)' }}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {rankedHypotheses.map((hyp, idx) => {
              const inconsistencyScore = computeInconsistencyScore(hyp, evidence, matrix)
              return (
                <tr key={hyp.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="p-2">
                    <div style={{ color: 'var(--text-primary)' }}>{hyp.title}</div>
                    <div style={{ color: 'var(--text-muted)' }} className="text-xs truncate">{hyp.description}</div>
                    {idx === 0 && <div className="text-xs mt-1" style={{ color: 'var(--primary)' }}>★ MOST LIKELY</div>}
                  </td>
                  {evidence.map(ev => {
                    const rating = matrix[hyp.id]?.[ev.id] ?? 'na'
                    const style = RATING_STYLES[rating]
                    return (
                      <td key={ev.id} className="p-2 text-center cursor-pointer" onClick={() => cycleRating(hyp.id, ev.id)}>
                        <span
                          className="inline-block w-6 h-6 rounded text-center leading-6 font-bold border"
                          style={{
                            color: style.color,
                            borderColor: style.color,
                            backgroundColor: `${style.color}15`,
                          }}
                        >
                          {style.label}
                        </span>
                      </td>
                    )
                  })}
                  <td className="p-2 text-center">
                    <span
                      className="font-bold text-sm"
                      style={{ color: inconsistencyScore > 5 ? 'var(--alert-red)' : inconsistencyScore > 2 ? 'var(--alert-amber)' : 'var(--alert-green)' }}
                    >
                      {inconsistencyScore}
                    </span>
                  </td>
                  <td className="p-2 text-center">
                    <span className="px-2 py-1 rounded text-xs" style={{ color: STATUS_COLORS[hyp.status] ?? 'var(--text-muted)', border: `1px solid ${STATUS_COLORS[hyp.status] ?? 'var(--border)'}` }}>
                      {hyp.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Add hypothesis */}
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={newHypothesis}
            onChange={e => setNewHypothesis(e.target.value)}
            placeholder="ADD HYPOTHESIS..."
            className="flex-1 px-3 py-2 rounded text-xs mono border bg-transparent"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', outline: 'none' }}
          />
          <button
            onClick={() => {
              if (!newHypothesis.trim()) return
              setHypotheses(prev => [...prev, {
                id: String(Date.now()),
                title: newHypothesis,
                description: '',
                status: 'active',
                probability: 0.5,
              }])
              setNewHypothesis('')
            }}
            className="px-4 py-2 rounded text-xs mono border"
            style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
          >
            + ADD
          </button>
        </div>
      </div>
    </div>
  )
}
