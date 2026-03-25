'use client'

import { useState } from 'react'

type TravelRiskLevel = 1 | 2 | 3 | 4 | 5

const RISK_LABELS: Record<TravelRiskLevel, string> = {
  1: 'LOW', 2: 'MODERATE', 3: 'HIGH', 4: 'EXTREME', 5: 'DO NOT TRAVEL',
}
const RISK_COLORS: Record<TravelRiskLevel, string> = {
  1: '#10B981', 2: '#3B82F6', 3: '#F59E0B', 4: '#EF4444', 5: '#FF0000',
}
const RISK_ICONS: Record<TravelRiskLevel, string> = {
  1: '●', 2: '◈', 3: '▲', 4: '⬥', 5: '✕',
}

type RiskData = {
  country_code: string
  risk_level: TravelRiskLevel
  risk_label: string
  risk_score: number
  key_threats: string[]
  note?: string
}

type BriefData = {
  destination: string
  risk_level: TravelRiskLevel
  pre_departure_checklist: string[]
  emergency_contacts: string[]
  check_in_schedule: string
  communications_plan: string
  extraction_plan: string
  generated_at: string
}

export function TravelRiskWidget() {
  const [country, setCountry] = useState('')
  const [risk, setRisk] = useState<RiskData | null>(null)
  const [brief, setBrief] = useState<BriefData | null>(null)
  const [loading, setLoading] = useState(false)
  const [briefing, setBriefing] = useState(false)
  const [travelerName, setTravelerName] = useState('')
  const [departure, setDeparture] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [showBriefForm, setShowBriefForm] = useState(false)

  const lookup = async () => {
    if (!country.trim()) return
    setLoading(true)
    setRisk(null)
    setBrief(null)
    try {
      const res = await fetch(`/api/v1/travel?country=${encodeURIComponent(country.trim().toUpperCase())}`)
      const json = await res.json() as { data?: RiskData }
      if (json.data) setRisk(json.data)
    } finally { setLoading(false) }
  }

  const generateBrief = async () => {
    if (!risk || !departure || !returnDate) return
    setBriefing(true)
    try {
      const res = await fetch('/api/v1/travel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          traveler_name: travelerName || null,
          destination: country.toUpperCase(),
          country_code: risk.country_code,
          departure,
          return: returnDate,
          purpose: 'Business travel',
        }),
      })
      const json = await res.json() as { data?: BriefData }
      if (json.data) { setBrief(json.data); setShowBriefForm(false) }
    } finally { setBriefing(false) }
  }

  const riskColor = risk ? RISK_COLORS[risk.risk_level] : 'var(--text-muted)'

  return (
    <div className="rounded border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
      <h3 className="text-sm font-bold mono tracking-widest mb-3" style={{ color: 'var(--text-primary)' }}>
        TRAVEL RISK ASSESSMENT — ISO 31030
      </h3>

      {/* Lookup */}
      <div className="flex gap-2 mb-4">
        <input
          value={country}
          onChange={e => setCountry(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && void lookup()}
          placeholder="COUNTRY CODE (e.g. UA, SY, YE)"
          maxLength={2}
          className="flex-1 px-3 py-2 text-xs mono rounded border"
          style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
        />
        <button
          onClick={() => void lookup()}
          disabled={loading}
          className="px-4 py-2 text-xs mono rounded font-bold"
          style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
        >
          {loading ? '...' : 'ASSESS'}
        </button>
      </div>

      {/* Risk result */}
      {risk && (
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl" style={{ color: riskColor }}>{RISK_ICONS[risk.risk_level]}</span>
            <div>
              <div className="text-lg font-bold mono" style={{ color: riskColor }}>
                {risk.risk_label}
              </div>
              <div className="text-xs mono" style={{ color: 'var(--text-muted)' }}>
                {risk.country_code} · Score: {risk.risk_score}/100
              </div>
            </div>
          </div>

          {risk.key_threats.length > 0 && (
            <div className="mb-3">
              <div className="text-xs mono font-bold mb-1" style={{ color: 'var(--text-muted)' }}>KEY THREATS</div>
              {risk.key_threats.map((t, i) => (
                <div key={i} className="text-xs mono flex gap-2 mb-1">
                  <span style={{ color: riskColor }}>›</span>
                  <span style={{ color: 'var(--text-primary)' }}>{t}</span>
                </div>
              ))}
            </div>
          )}

          {risk.note && (
            <p className="text-xs mono italic" style={{ color: 'var(--text-muted)' }}>{risk.note}</p>
          )}

          {!showBriefForm && !brief && (
            <button
              onClick={() => setShowBriefForm(true)}
              className="mt-2 w-full py-2 text-xs mono rounded border font-bold"
              style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
            >
              GENERATE TRAVEL BRIEF
            </button>
          )}
        </div>
      )}

      {/* Brief form */}
      {showBriefForm && (
        <div className="border rounded p-3 mb-4" style={{ borderColor: 'var(--border)' }}>
          <div className="text-xs mono font-bold mb-2" style={{ color: 'var(--text-muted)' }}>BRIEF PARAMETERS</div>
          {[
            { label: 'Traveler Name (optional)', val: travelerName, set: setTravelerName, placeholder: 'John Smith' },
            { label: 'Departure Date', val: departure, set: setDeparture, placeholder: 'YYYY-MM-DD' },
            { label: 'Return Date', val: returnDate, set: setReturnDate, placeholder: 'YYYY-MM-DD' },
          ].map(f => (
            <div key={f.label} className="mb-2">
              <div className="text-xs mono mb-1" style={{ color: 'var(--text-muted)' }}>{f.label}</div>
              <input
                value={f.val}
                onChange={e => f.set(e.target.value)}
                placeholder={f.placeholder}
                className="w-full px-3 py-2 text-xs mono rounded border"
                style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
          ))}
          <button onClick={() => void generateBrief()} disabled={briefing}
            className="w-full py-2 text-xs mono rounded font-bold"
            style={{ backgroundColor: 'var(--primary)', color: '#fff' }}>
            {briefing ? 'GENERATING...' : 'GENERATE'}
          </button>
        </div>
      )}

      {/* Generated brief */}
      {brief && (
        <div className="border rounded p-3" style={{ borderColor: riskColor }}>
          <div className="text-xs mono font-bold mb-2" style={{ color: riskColor }}>
            PRE-DEPARTURE BRIEF — {brief.destination}
          </div>
          <div className="mb-2">
            <div className="text-xs mono font-bold mb-1" style={{ color: 'var(--text-muted)' }}>CHECKLIST</div>
            {brief.pre_departure_checklist.map((item, i) => (
              <div key={i} className="text-xs mono flex gap-2 mb-1">
                <span style={{ color: 'var(--text-muted)' }}>□</span>
                <span style={{ color: 'var(--text-primary)' }}>{item}</span>
              </div>
            ))}
          </div>
          <div className="mb-2">
            <div className="text-xs mono font-bold mb-1" style={{ color: 'var(--text-muted)' }}>CHECK-IN SCHEDULE</div>
            <p className="text-xs mono" style={{ color: 'var(--text-primary)' }}>{brief.check_in_schedule}</p>
          </div>
          <div>
            <div className="text-xs mono font-bold mb-1" style={{ color: 'var(--text-muted)' }}>EMERGENCY CONTACTS</div>
            {brief.emergency_contacts.map((c, i) => (
              <div key={i} className="text-xs mono" style={{ color: 'var(--text-primary)' }}>› {c}</div>
            ))}
          </div>
          <div className="mt-2 text-xs mono" style={{ color: 'var(--text-muted)' }}>
            Generated {new Date(brief.generated_at).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  )
}
