'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity, Building2, FileText, HeartPulse, MapPin, Plane, Printer, Shield } from 'lucide-react'

type Assessment = { country_code?: string; risk_level?: number; risk_label?: string; risk_score?: number; key_threats?: string[]; note?: string; last_updated?: string }
type Brief = { destination: string; risk_level: number; emergency_contacts?: string[]; pre_departure_checklist?: string[]; check_in_schedule?: string; communications_plan?: string; extraction_plan?: string }
type EventRow = { id: string; title: string; occurred_at?: string | null; source: string }

const COUNTRY_ISO: Record<string, string> = {
  'Afghanistan': 'AF', 'Algeria': 'DZ', 'Argentina': 'AR', 'Armenia': 'AM',
  'Australia': 'AU', 'Austria': 'AT', 'Bahrain': 'BH', 'Bangladesh': 'BD',
  'Belgium': 'BE', 'Brazil': 'BR', 'Bulgaria': 'BG', 'Canada': 'CA',
  'Chile': 'CL', 'China': 'CN', 'Colombia': 'CO', 'Czech Republic': 'CZ',
  'Denmark': 'DK', 'Egypt': 'EG', 'Ethiopia': 'ET', 'Finland': 'FI',
  'France': 'FR', 'Georgia': 'GE', 'Germany': 'DE', 'Ghana': 'GH',
  'Greece': 'GR', 'Hungary': 'HU', 'India': 'IN', 'Indonesia': 'ID',
  'Iran': 'IR', 'Iraq': 'IQ', 'Ireland': 'IE', 'Israel': 'IL',
  'Italy': 'IT', 'Japan': 'JP', 'Jordan': 'JO', 'Kenya': 'KE',
  'Lebanon': 'LB', 'Libya': 'LY', 'Malaysia': 'MY', 'Mexico': 'MX',
  'Morocco': 'MA', 'Netherlands': 'NL', 'Nigeria': 'NG', 'Norway': 'NO',
  'Pakistan': 'PK', 'Philippines': 'PH', 'Poland': 'PL', 'Portugal': 'PT',
  'Qatar': 'QA', 'Romania': 'RO', 'Russia': 'RU', 'Saudi Arabia': 'SA',
  'Singapore': 'SG', 'Somalia': 'SO', 'South Africa': 'ZA', 'South Korea': 'KR',
  'Spain': 'ES', 'Sudan': 'SD', 'Sweden': 'SE', 'Syria': 'SY',
  'Taiwan': 'TW', 'Thailand': 'TH', 'Tunisia': 'TN', 'Turkey': 'TR',
  'Ukraine': 'UA', 'United Arab Emirates': 'AE', 'United Kingdom': 'GB',
  'United States': 'US', 'Venezuela': 'VE', 'Yemen': 'YE',
}

const COUNTRIES = ['Afghanistan','Algeria','Argentina','Armenia','Australia','Austria','Bahrain','Bangladesh','Belgium','Brazil','Bulgaria','Canada','Chile','China','Colombia','Czech Republic','Denmark','Egypt','Ethiopia','Finland','France','Georgia','Germany','Ghana','Greece','Hungary','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Japan','Jordan','Kenya','Lebanon','Libya','Malaysia','Mexico','Morocco','Netherlands','Nigeria','Norway','Pakistan','Philippines','Poland','Portugal','Qatar','Romania','Russia','Saudi Arabia','Singapore','Somalia','South Africa','South Korea','Spain','Sudan','Sweden','Syria','Taiwan','Thailand','Tunisia','Turkey','Ukraine','United Arab Emirates','United Kingdom','United States','Venezuela','Yemen']
const FLAGS: Record<string, string> = { Ukraine: '🇺🇦', Israel: '🇮🇱', Sudan: '🇸🇩', Taiwan: '🇹🇼', Russia: '🇷🇺', Syria: '🇸🇾', Yemen: '🇾🇪', UnitedStates: '🇺🇸', UnitedKingdom: '🇬🇧' }
const riskColor = (level: number) => ({ 1: '#22C55E', 2: '#EAB308', 3: '#F97316', 4: '#EF4444', 5: '#7f1d1d' }[level] || '#64748B')
const riskLabel = (level: number) => ({ 1: 'Low', 2: 'Moderate', 3: 'High', 4: 'Very High', 5: 'Critical' }[level] || 'Unknown')
function timeAgo(input?: string | null) { if (!input) return 'unknown'; const d = Date.now() - new Date(input).getTime(); const m = Math.floor(d / 60000); if (m < 60) return `${m}m ago`; const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`; return `${Math.floor(h / 24)}d ago` }

export default function TravelPage() {
  const PlaneIcon = Plane as any
  const MapPinIcon = MapPin as any
  const ShieldIcon = Shield as any
  const ActivityIcon = Activity as any
  const Building2Icon = Building2 as any
  const HeartPulseIcon = HeartPulse as any
  const FileTextIcon = FileText as any
  const PrinterIcon = Printer as any
  const [country, setCountry] = useState('')
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [brief, setBrief] = useState<Brief | null>(null)
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(false)
  const [briefLoading, setBriefLoading] = useState(false)
  const [showBriefModal, setShowBriefModal] = useState(false)
  const matches = useMemo(() => country ? COUNTRIES.filter((item) => item.toLowerCase().includes(country.toLowerCase())).slice(0, 8) : [], [country])

  const assessRisk = async (targetCountry: string) => {
    setLoading(true)
    const code = COUNTRY_ISO[targetCountry] ?? targetCountry.slice(0, 2).toUpperCase()
    const res = await fetch(`/api/v1/travel?country=${code}`, { cache: 'no-store' })
    const json = await res.json() as { data?: Assessment }
    setAssessment(json.data ?? null)
    const eventsRes = await fetch(`/api/v1/events?search=${encodeURIComponent(targetCountry)}&limit=10`, { cache: 'no-store' })
    const eventsJson = await eventsRes.json() as { data?: EventRow[] }
    setEvents(eventsJson.data ?? [])
    setLoading(false)
  }
  const generateBrief = async () => {
    if (!assessment) return
    setBriefLoading(true)
    const res = await fetch('/api/v1/travel/brief', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ traveler_name: 'Operator', destination: country, country_code: (assessment.country_code || country.slice(0, 2)).toUpperCase(), departure: new Date().toISOString().slice(0,10), return: new Date(Date.now() + 7*86400000).toISOString().slice(0,10), purpose: 'Business travel' }) })
    const json = await res.json() as { data?: Brief }
    setBrief(json.data ?? null)
    setShowBriefModal(true)
    setBriefLoading(false)
  }

  return (
    <div className="p-6">
      <div className="mb-6"><h1 className="text-[22px] font-semibold" style={{ color: 'var(--text-primary)' }}>Travel Risk Assessment</h1><p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>ISO 31030 compliant duty of care intelligence</p></div>
      <div className="mx-auto mt-8 max-w-lg"><div className="relative"><MapPinIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} /><input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Search country..." className="h-12 w-full rounded-lg border pl-12 pr-4 text-base" style={{ borderColor: 'var(--border-emphasis)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }} /></div>{matches.length > 0 && <div className="mt-2 rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>{matches.map((match) => <button key={match} onClick={() => { setCountry(match); void assessRisk(match) }} className="block w-full px-4 py-2 text-left text-sm hover:bg-white/5" style={{ color: 'var(--text-primary)' }}>{match}</button>)}</div>}<button onClick={() => void assessRisk(country)} disabled={!country || loading} className="mt-4 h-12 w-full rounded-lg text-base font-medium btn-primary" style={{ background: 'var(--primary)', color: '#fff' }}>{loading ? 'Assessing...' : 'Assess Risk →'}</button></div>
      {assessment && <div className="mx-auto mt-8 max-w-2xl"><div className="mb-4 flex items-center gap-3"><div className="text-[24px] font-semibold" style={{ color: 'var(--text-primary)' }}>{FLAGS[country.replace(/\s/g, '')] || '🌍'} {country}</div></div><div className="mb-2 flex gap-1 overflow-hidden rounded-full">{[1,2,3,4,5].map((level) => <div key={level} className="h-3 flex-1" style={{ background: level <= (assessment.risk_level || 1) ? riskColor(level) : 'var(--bg-surface-3)', opacity: level <= (assessment.risk_level || 1) ? 1 : 0.3 }} />)}</div><p className="mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>Risk Level {assessment.risk_level}/5: {riskLabel(assessment.risk_level || 1)}</p><div className="grid gap-4 md:grid-cols-2">{[{ icon: ShieldIcon, label: 'Conflict & Security', value: `${assessment.risk_score || 0} score`, desc: `${events.length} conflict events in last 30 days` }, { icon: ActivityIcon, label: 'Political Stability', value: riskLabel(Math.max(1, (assessment.risk_level || 1) - 1)), desc: 'Government continuity and unrest profile' }, { icon: Building2Icon, label: 'Infrastructure', value: (assessment.risk_level || 1) >= 4 ? 'Degraded' : 'Operational', desc: 'Transport, utilities, and border access' }, { icon: HeartPulseIcon, label: 'Health Advisory', value: (assessment.risk_level || 1) >= 3 ? 'Elevated' : 'Routine', desc: 'Medical support and outbreak posture' }].map((card, idx) => { const Icon = card.icon; return <div key={idx} className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}><div className="mb-2 flex items-center gap-2"><Icon size={16} style={{ color: 'var(--primary)' }} /><span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{card.label}</span></div><div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{card.value}</div><div className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{card.desc}</div></div> })}</div><div className="mt-6 rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}><div className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Recent events</div>{events.map((event) => <div key={event.id} className="mb-2 rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)' }}><div className="text-sm" style={{ color: 'var(--text-primary)' }}>{event.title}</div><div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{event.source} · {timeAgo(event.occurred_at)}</div></div>)}<button onClick={() => void generateBrief()} disabled={briefLoading} className="mt-4 w-full rounded-lg px-3 py-3 text-sm font-medium btn-primary" style={{ background: 'var(--primary)', color: '#fff' }}>{briefLoading ? 'Generating...' : 'Generate Pre-Departure Brief'}</button></div></div>}
      <AnimatePresence>{showBriefModal && brief && <><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:50 }} onClick={() => setShowBriefModal(false)} /><motion.div initial={{ opacity: 0, scale: 0.94, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 10 }} transition={{ duration: 0.2, ease: [0.25,0.46,0.45,0.94] }} className="fixed inset-0 z-[51] overflow-auto p-4"><div className="mx-auto max-w-3xl rounded-xl border p-6" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}><div className="mb-6 flex items-center justify-between"><div><div className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Pre-Departure Brief: {country}</div><div className="text-sm" style={{ color: 'var(--text-muted)' }}>Risk level {brief.risk_level}/5</div></div><button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm btn-ghost" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}><PrinterIcon size={14} /> Print Brief</button></div>{[{ icon: ShieldIcon, title: 'Emergency Contacts', items: brief.emergency_contacts || [] }, { icon: PlaneIcon, title: 'Security Recommendations', items: brief.pre_departure_checklist || [] }, { icon: FileTextIcon, title: 'Communications Security', items: [brief.communications_plan || 'Use approved encrypted channels.'] }, { icon: HeartPulseIcon, title: 'Medical & Health', items: ['Pack trauma/medical kit', 'Verify local hospital capability', 'Confirm medevac insurance'] }, { icon: MapPinIcon, title: 'Evacuation Planning', items: [brief.extraction_plan || 'Define primary/alternate extraction routes.'] }].map((section, idx) => { const Icon = section.icon; return <div key={idx} className="mb-5 rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)' }}><div className="mb-2 flex items-center gap-2"><Icon size={16} style={{ color: 'var(--primary)' }} /><span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{section.title}</span></div><ul className="list-disc pl-5 text-sm" style={{ color: 'var(--text-secondary)' }}>{section.items.map((item, i) => <li key={i}>{item}</li>)}</ul></div> })}</div></motion.div></>}</AnimatePresence>
    </div>
  )
}
