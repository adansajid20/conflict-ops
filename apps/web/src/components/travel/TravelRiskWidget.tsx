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
    <div className="rounded border border-white/[0.05] bg-white/[0.015] p-4 hover:bg-white/[0.03]">
      <h3 className="mb-3 text-sm font-bold tracking-widest text-white">
        TRAVEL RISK ASSESSMENT — ISO 31030
      </h3>

      {/* Lookup */}
      <div className="mb-4 flex gap-2">
        <input
          value={country}
          onChange={e => setCountry(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && void lookup()}
          placeholder="COUNTRY CODE (e.g. UA, SY, YE)"
          maxLength={2}
          className="flex-1 rounded border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-white placeholder:text-white/20"
        />
        <button
          onClick={() => void lookup()}
          disabled={loading}
          className="rounded bg-blue-500 px-4 py-2 text-xs font-bold text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? '...' : 'ASSESS'}
        </button>
      </div>

      {/* Risk result */}
      {risk && (
        <div className="mb-4">
          <div className="mb-3 flex items-center gap-3">
            <span className="text-2xl" style={{ color: riskColor }}>{RISK_ICONS[risk.risk_level]}</span>
            <div>
              <div className="text-lg font-bold" style={{ color: riskColor }}>
                {risk.risk_label}
              </div>
              <div className="text-xs text-white/50">
                {risk.country_code} · Score: {risk.risk_score}/100
              </div>
            </div>
          </div>

          {risk.key_threats.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 text-[10px] uppercase tracking-[0.15em] text-white/25">KEY THREATS</div>
              {risk.key_threats.map((t, i) => (
                <div key={i} className="mb-1 flex gap-2 text-xs">
                  <span style={{ color: riskColor }}>›</span>
                  <span className="text-white">{t}</span>
                </div>
              ))}
            </div>
          )}

          {risk.note && (
            <p className="text-xs italic text-white/50">{risk.note}</p>
          )}

          {!showBriefForm && !brief && (
            <button
              onClick={() => setShowBriefForm(true)}
              className="mt-2 w-full rounded border border-blue-400 bg-blue-500/20 py-2 text-xs font-bold text-blue-400 hover:bg-blue-500/30"
            >
              GENERATE TRAVEL BRIEF
            </button>
          )}
        </div>
      )}

      {/* Brief form */}
      {showBriefForm && (
        <div className="mb-4 rounded border border-white/[0.05] bg-white/[0.015] p-3">
          <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-white/25">BRIEF PARAMETERS</div>
          {[
            { label: 'Traveler Name (optional)', val: travelerName, set: setTravelerName, placeholder: 'John Smith' },
            { label: 'Departure Date', val: departure, set: setDeparture, placeholder: 'YYYY-MM-DD' },
            { label: 'Return Date', val: returnDate, set: setReturnDate, placeholder: 'YYYY-MM-DD' },
          ].map(f => (
            <div key={f.label} className="mb-2">
              <div className="mb-1 text-[10px] uppercase tracking-[0.15em] text-white/25">{f.label}</div>
              <input
                value={f.val}
                onChange={e => f.set(e.target.value)}
                placeholder={f.placeholder}
                className="w-full rounded border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-white placeholder:text-white/20"
              />
            </div>
          ))}
          <button onClick={() => void generateBrief()} disabled={briefing}
            className="w-full rounded bg-blue-500 py-2 text-xs font-bold text-white hover:bg-blue-600 disabled:opacity-50">
            {briefing ? 'GENERATING...' : 'GENERATE'}
          </button>
        </div>
      )}

      {/* Generated brief */}
      {brief && (
        <div className="rounded border p-3" style={{ borderColor: riskColor }}>
          <div className="mb-2 text-xs font-bold" style={{ color: riskColor }}>
            PRE-DEPARTURE BRIEF — {brief.destination}
          </div>
          <div className="mb-2">
            <div className="mb-1 text-[10px] uppercase tracking-[0.15em] text-white/25">CHECKLIST</div>
            {brief.pre_departure_checklist.map((item, i) => (
              <div key={i} className="mb-1 flex gap-2 text-xs">
                <span className="text-white/50">□</span>
                <span className="text-white">{item}</span>
              </div>
            ))}
          </div>
          <div className="mb-2">
            <div className="mb-1 text-[10px] uppercase tracking-[0.15em] text-white/25">CHECK-IN SCHEDULE</div>
            <p className="text-xs text-white">{brief.check_in_schedule}</p>
          </div>
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-[0.15em] text-white/25">EMERGENCY CONTACTS</div>
            {brief.emergency_contacts.map((c, i) => (
              <div key={i} className="text-xs text-white">› {c}</div>
            ))}
          </div>
          <div className="mt-2 text-xs text-white/50">
            Generated {new Date(brief.generated_at).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  )
}
