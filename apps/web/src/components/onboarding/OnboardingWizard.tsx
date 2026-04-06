'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STEPS = [
  { id: 'welcome',   title: 'Welcome to CONFLICTRADAR', icon: '◈' },
  { id: 'org',       title: 'Set Up Your Organization', icon: '⊕' },
  { id: 'mission',   title: 'Create Your First Mission', icon: '◉' },
  { id: 'pir',       title: 'Define Your Intelligence Requirements', icon: '⚠' },
  { id: 'done',      title: 'You\'re Operational', icon: '✓' },
]

const REGIONS = [
  'Eastern Europe', 'Middle East', 'Sub-Saharan Africa', 'East Asia',
  'South Asia', 'Central Asia', 'North Africa', 'Latin America', 'Global',
]

const INTEREST_TYPES = [
  'Armed Conflict', 'Political Instability', 'Terrorism', 'Maritime Security',
  'Nuclear / WMD', 'Cyber Attacks', 'Sanctions', 'Humanitarian Crisis',
  'Coups / Regime Change', 'Economic Warfare',
]

export function OnboardingWizard() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)

  const [orgName, setOrgName] = useState('')
  const [orgType, setOrgType] = useState('')
  const [missionName, setMissionName] = useState('')
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [pirName, setPirName] = useState('')
  const [pirKeyword, setPirKeyword] = useState('')

  const toggleRegion = (r: string) =>
    setSelectedRegions(p => p.includes(r) ? p.filter(x => x !== r) : [...p, r])
  const toggleInterest = (i: string) =>
    setSelectedInterests(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i])

  const canNext = () => {
    if (step === 1) return orgName.trim().length > 0
    if (step === 2) return missionName.trim().length > 0 && selectedRegions.length > 0
    if (step === 3) return true // PIR optional
    return true
  }

  const handleNext = async () => {
    if (step === STEPS.length - 1) {
      router.push('/overview')
      return
    }

    if (step === 3) {
      // Persist onboarding data
      setLoading(true)
      try {
        const res = await fetch('/api/v1/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            org_name: orgName,
            org_type: orgType,
            mission_name: missionName,
            regions: selectedRegions,
            interests: selectedInterests,
            pir_name: pirName || null,
            pir_keyword: pirKeyword || null,
          }),
        })
        if (!res.ok) {
          console.error('Onboarding save failed:', res.status)
        }
      } catch (e) {
        console.error('Onboarding save error:', e)
      } finally {
        setLoading(false)
      }
    }

    setStep(s => s + 1)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4" style={{ backgroundColor: '#070B11' }}>
      {/* Progress */}
      <div className="mb-8 w-full max-w-lg">
        <div className="mb-2 flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold mono"
                style={{
                  backgroundColor: i < step ? '#3B82F6' : i === step ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.015)',
                  border: `1px solid ${i <= step ? '#3B82F6' : 'rgba(255,255,255,0.05)'}`,
                  color: i <= step ? '#3B82F6' : 'rgba(255,255,255,0.5)',
                }}>
                {i < step ? '✓' : s.icon}
              </div>
              {i < STEPS.length - 1 && (
                <div className="mx-1 h-px w-12" style={{ backgroundColor: i < step ? '#3B82F6' : 'rgba(255,255,255,0.05)' }} />
              )}
            </div>
          ))}
        </div>
        <div className="text-center text-xs mono text-white/50">
          Step {step + 1} of {STEPS.length}
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-lg rounded-xl border border-white/[0.05] bg-white/[0.015] p-8">
        <h2 className="mb-6 text-xl font-bold mono tracking-wide text-white">
          {STEPS[step]?.title ?? ''}
        </h2>

        {/* Step content */}
        {step === 0 && (
          <div>
            <p className="mb-4 text-sm text-white/50">
              You have full access to the platform. This 2-minute setup will personalize your experience and create your first mission.
            </p>
            <div className="mb-4 grid grid-cols-3 gap-3">
              {[
                { icon: '▤', label: 'Real-time feed' },
                { icon: '⊞', label: 'Conflict map' },
                { icon: '⊡', label: 'AI workbench' },
              ].map(f => (
                <div key={f.label} className="rounded-lg border border-white/[0.05] bg-white/[0.025] p-3 text-center">
                  <div className="mb-1 text-xl text-blue-400">{f.icon}</div>
                  <div className="text-xs mono text-white/50">{f.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="mb-4">
              <label className="mb-1 block text-xs mono text-white/50">ORGANIZATION NAME *</label>
              <input value={orgName} onChange={e => setOrgName(e.target.value)}
                placeholder="e.g. Acme Security, Open Source Intel Unit"
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/20" />
            </div>
            <div>
              <label className="mb-2 block text-xs mono text-white/50">ORG TYPE</label>
              <div className="flex flex-wrap gap-2">
                {['Corporate Security', 'NGO / Humanitarian', 'Research / Academic', 'Media', 'Government / Defense', 'Insurance / Risk', 'Personal / OSINT'].map(t => (
                  <button key={t} onClick={() => setOrgType(t)}
                    className="rounded-lg border px-3 py-1 text-xs mono"
                    style={{
                      borderColor: orgType === t ? '#3B82F6' : 'rgba(255,255,255,0.05)',
                      color: orgType === t ? '#3B82F6' : 'rgba(255,255,255,0.5)',
                      backgroundColor: orgType === t ? 'rgba(59,130,246,0.15)' : 'transparent',
                    }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="mb-4">
              <label className="mb-1 block text-xs mono text-white/50">MISSION NAME *</label>
              <input value={missionName} onChange={e => setMissionName(e.target.value)}
                placeholder="e.g. Ukraine Conflict Monitor, Sahel Instability Watch"
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/20" />
            </div>
            <div className="mb-4">
              <label className="mb-2 block text-xs mono text-white/50">FOCUS REGIONS * (select all that apply)</label>
              <div className="flex flex-wrap gap-2">
                {REGIONS.map(r => (
                  <button key={r} onClick={() => toggleRegion(r)}
                    className="rounded-lg border px-3 py-1 text-xs mono"
                    style={{
                      borderColor: selectedRegions.includes(r) ? '#3B82F6' : 'rgba(255,255,255,0.05)',
                      color: selectedRegions.includes(r) ? '#3B82F6' : 'rgba(255,255,255,0.5)',
                      backgroundColor: selectedRegions.includes(r) ? 'rgba(59,130,246,0.15)' : 'transparent',
                    }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs mono text-white/50">INTEREST TYPES</label>
              <div className="flex flex-wrap gap-2">
                {INTEREST_TYPES.map(i => (
                  <button key={i} onClick={() => toggleInterest(i)}
                    className="rounded-lg border px-3 py-1 text-xs mono"
                    style={{
                      borderColor: selectedInterests.includes(i) ? '#3B82F6' : 'rgba(255,255,255,0.05)',
                      color: selectedInterests.includes(i) ? '#3B82F6' : 'rgba(255,255,255,0.5)',
                      backgroundColor: selectedInterests.includes(i) ? 'rgba(59,130,246,0.15)' : 'transparent',
                    }}>
                    {i}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="mb-4 text-sm text-white/50">
              Priority Intelligence Requirements (PIRs) trigger alerts when events match your criteria. You can skip this and configure later.
            </p>
            <div className="mb-4">
              <label className="mb-1 block text-xs mono text-white/50">PIR NAME (optional)</label>
              <input value={pirName} onChange={e => setPirName(e.target.value)}
                placeholder="e.g. Escalation in Eastern Ukraine"
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs mono text-white/50">ALERT KEYWORD</label>
              <input value={pirKeyword} onChange={e => setPirKeyword(e.target.value)}
                placeholder="e.g. Kharkiv, missile strike, mobilization"
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/20" />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="text-center">
            <div className="mb-4 text-4xl text-green-500">✓</div>
            <p className="mb-6 text-sm text-white/50">
              Your workspace is configured. The intel feed will populate as data flows in.
              You can refine missions, add more PIRs, and configure alerts from the dashboard.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: '/feed', label: 'Intel Feed', icon: '▤' },
                { href: '/map', label: 'Conflict Map', icon: '⊞' },
                { href: '/missions', label: 'Missions', icon: '◉' },
                { href: '/alerts', label: 'Alerts', icon: '⚠' },
              ].map(l => (
                <a key={l.href} href={l.href}
                  className="rounded-lg border border-white/[0.05] p-3 text-center text-xs mono text-white/50 hover:bg-white/5">
                  <div className="text-blue-400">{l.icon}</div>
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Nav buttons */}
        <div className="mt-8 flex justify-between">
          {step > 0 && step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s - 1)}
              className="rounded-lg border border-white/[0.05] px-4 py-2 text-xs mono text-white/50 hover:bg-white/5">
              ← BACK
            </button>
          ) : <div />}
          <button
            onClick={() => void handleNext()}
            disabled={!canNext() || loading}
            className="rounded-lg px-6 py-2 text-xs mono font-bold text-white hover:bg-blue-600 disabled:opacity-50"
            style={{ backgroundColor: canNext() ? '#3B82F6' : 'rgba(255,255,255,0.015)' }}>
            {loading ? 'SAVING...' : step === STEPS.length - 1 ? 'OPEN DASHBOARD →' : step === 3 ? 'FINISH SETUP' : 'NEXT →'}
          </button>
        </div>
      </div>
    </div>
  )
}
