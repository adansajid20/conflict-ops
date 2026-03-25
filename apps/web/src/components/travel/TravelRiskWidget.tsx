'use client'

import { useState } from 'react'
import { RISK_LABELS, RISK_COLORS, RISK_ICONS } from '@/lib/travel/risk-engine'
import type { TravelRiskLevel, TravelBrief } from '@/lib/travel/risk-engine'

export function TravelRiskWidget() {
  const [country, setCountry] = useState('')
  const [riskData, setRiskData] = useState<{ risk_level: TravelRiskLevel; risk_label: string; risk_score: number; key_threats: string[] } | null>(null)
  const [brief, setBrief] = useState<TravelBrief | null>(null)
  const [loading, setLoading] = useState(false)
  const [showBriefForm, setShowBriefForm] = useState(false)
  const [briefForm, setBriefForm] = useState({ destination: '', departure: '', return: '', purpose: 'Business travel', name: '' })

  const checkRisk = async () => {
    if (!country.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/travel?country=${encodeURIComponent(country.toUpperCase())}`)
      const json = await res.json() as { success: boolean; data?: typeof riskData }
      if (json.success && json.data) setRiskData(json.data)
    } finally {
      setLoading(false)
    }
  }

  const generateBrief = async () => {
    if (!country || !briefForm.destination || !briefForm.departure || !briefForm.return) return
    setLoading(true)
    try {
      const res = await fetch('/api/v1/travel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country_code: country.toUpperCase(),
          destination: briefForm.destination,
          departure: briefForm.departure,
          return: briefForm.return,
          purpose: briefForm.purpose,
          traveler_name: briefForm.name || undefined,
        }),
      })
      const json = await res.json() as { success: boolean; data?: TravelBrief }
      if (json.success && json.data) setBrief(json.data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded border" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="text-xs mono tracking-widest" style={{ color: 'var(--text-muted)' }}>
          TRAVEL RISK — ISO 31030
        </div>
      </div>

      <div className="p-4">
        {/* Country lookup */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={country}
            onChange={e => { setCountry(e.target.value.toUpperCase()); setRiskData(null); setBrief(null) }}
            placeholder="ISO CODE (e.g. UA, YE, SD)"
            maxLength={2}
            className="flex-1 px-3 py-2 rounded text-xs mono border bg-transparent uppercase"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', outline: 'none' }}
          />
          <button
            onClick={checkRisk}
            disabled={loading || !country.trim()}
            className="px-4 py-2 rounded text-xs mono border disabled:opacity-50"
            style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
          >
            {loading ? '...' : 'CHECK'}
          </button>
        </div>

        {/* Risk result */}
        {riskData && (
          <div className="mb-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl" style={{ color: RISK_COLORS[riskData.risk_level] }}>
                {RISK_ICONS[riskData.risk_level]}
              </span>
              <div>
                <div className="text-lg font-bold mono" style={{ color: RISK_COLORS[riskData.risk_level] }}>
                  {RISK_LABELS[riskData.risk_level]}
                </div>
                <div className="text-xs mono" style={{ color: 'var(--text-muted)' }}>
                  Risk score: {riskData.risk_score}/100
                </div>
              </div>
            </div>

            {riskData.key_threats.length > 0 && (
              <ul className="mb-3 space-y-1">
                {riskData.key_threats.map(t => (
                  <li key={t} className="text-xs mono flex gap-2" style={{ color: 'var(--text-muted)' }}>
                    <span style={{ color: 'var(--alert-amber)' }}>▸</span>{t}
                  </li>
                ))}
              </ul>
            )}

            <button
              onClick={() => setShowBriefForm(!showBriefForm)}
              className="text-xs mono px-3 py-1.5 rounded border"
              style={{ borderColor: 'var(--accent-blue)', color: 'var(--accent-blue)' }}
            >
              {showBriefForm ? 'CANCEL' : 'GENERATE TRAVEL BRIEF →'}
            </button>
          </div>
        )}

        {/* Brief form */}
        {showBriefForm && (
          <div className="border rounded p-3 space-y-2" style={{ borderColor: 'var(--border)' }}>
            {[
              { key: 'name', label: 'TRAVELER NAME (OPTIONAL)', placeholder: 'J. Smith' },
              { key: 'destination', label: 'DESTINATION CITY', placeholder: 'Kyiv' },
              { key: 'departure', label: 'DEPARTURE DATE', placeholder: '2026-04-01', type: 'date' },
              { key: 'return', label: 'RETURN DATE', placeholder: '2026-04-07', type: 'date' },
              { key: 'purpose', label: 'PURPOSE', placeholder: 'Business travel' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs mono mb-1" style={{ color: 'var(--text-muted)' }}>{f.label}</label>
                <input
                  type={f.type ?? 'text'}
                  value={briefForm[f.key as keyof typeof briefForm]}
                  onChange={e => setBriefForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full px-2 py-1.5 rounded text-xs mono border bg-transparent"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>
            ))}
            <button
              onClick={generateBrief}
              disabled={loading}
              className="w-full py-2 rounded text-xs mono border font-bold disabled:opacity-50"
              style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
            >
              {loading ? 'GENERATING...' : 'GENERATE BRIEF'}
            </button>
          </div>
        )}

        {/* Brief output */}
        {brief && (
          <div className="mt-4 border rounded p-3" style={{ borderColor: 'var(--border)' }}>
            <div className="text-xs mono font-bold mb-2" style={{ color: 'var(--primary)' }}>
              PRE-DEPARTURE BRIEF — {brief.destination.toUpperCase()} — {RISK_LABELS[brief.risk_level]}
            </div>
            <div className="space-y-3 text-xs mono">
              <div>
                <div className="font-bold mb-1" style={{ color: 'var(--text-muted)' }}>CHECKLIST</div>
                {brief.pre_departure_checklist.map((item, i) => (
                  <div key={i} className="flex gap-2" style={{ color: 'var(--text-muted)' }}>
                    <span style={{ color: 'var(--alert-green)' }}>□</span>{item}
                  </div>
                ))}
              </div>
              <div>
                <div className="font-bold mb-1" style={{ color: 'var(--text-muted)' }}>CHECK-IN SCHEDULE</div>
                <div style={{ color: 'var(--text-muted)' }}>{brief.check_in_schedule}</div>
              </div>
              <div>
                <div className="font-bold mb-1" style={{ color: 'var(--text-muted)' }}>COMMS PLAN</div>
                <div style={{ color: 'var(--text-muted)' }}>{brief.communications_plan}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
