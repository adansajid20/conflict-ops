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
        await fetch('/api/v1/onboarding', {
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
      } finally {
        setLoading(false)
      }
    }

    setStep(s => s + 1)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ backgroundColor: 'var(--bg-base)' }}>
      {/* Progress */}
      <div className="w-full max-w-lg mb-8">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mono"
                style={{
                  backgroundColor: i < step ? 'var(--primary)' : i === step ? 'var(--primary)20' : 'var(--bg-surface)',
                  border: `1px solid ${i <= step ? 'var(--primary)' : 'var(--border)'}`,
                  color: i <= step ? 'var(--primary)' : 'var(--text-muted)',
                }}>
                {i < step ? '✓' : s.icon}
              </div>
              {i < STEPS.length - 1 && (
                <div className="h-px w-12 mx-1" style={{ backgroundColor: i < step ? 'var(--primary)' : 'var(--border)' }} />
              )}
            </div>
          ))}
        </div>
        <div className="text-xs mono text-center" style={{ color: 'var(--text-muted)' }}>
          Step {step + 1} of {STEPS.length}
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-lg rounded border p-8" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        <h2 className="text-xl font-bold mono tracking-wide mb-6" style={{ color: 'var(--text-primary)' }}>
          {STEPS[step]?.title ?? ''}
        </h2>

        {/* Step content */}
        {step === 0 && (
          <div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              You have full access to the platform. This 2-minute setup will personalize your experience and create your first mission.
            </p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { icon: '▤', label: 'Real-time feed' },
                { icon: '⊞', label: 'Conflict map' },
                { icon: '⊡', label: 'AI workbench' },
              ].map(f => (
                <div key={f.label} className="p-3 rounded border text-center" style={{ borderColor: 'var(--border)' }}>
                  <div className="text-xl mb-1" style={{ color: 'var(--primary)' }}>{f.icon}</div>
                  <div className="text-xs mono" style={{ color: 'var(--text-muted)' }}>{f.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="mb-4">
              <label className="text-xs mono block mb-1" style={{ color: 'var(--text-muted)' }}>ORGANIZATION NAME *</label>
              <input value={orgName} onChange={e => setOrgName(e.target.value)}
                placeholder="e.g. Acme Security, Open Source Intel Unit"
                className="w-full px-3 py-2 text-sm rounded border"
                style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="text-xs mono block mb-2" style={{ color: 'var(--text-muted)' }}>ORG TYPE</label>
              <div className="flex flex-wrap gap-2">
                {['Corporate Security', 'NGO / Humanitarian', 'Research / Academic', 'Media', 'Government / Defense', 'Insurance / Risk', 'Personal / OSINT'].map(t => (
                  <button key={t} onClick={() => setOrgType(t)}
                    className="px-3 py-1 text-xs mono rounded border"
                    style={{
                      borderColor: orgType === t ? 'var(--primary)' : 'var(--border)',
                      color: orgType === t ? 'var(--primary)' : 'var(--text-muted)',
                      backgroundColor: orgType === t ? 'var(--primary)15' : 'transparent',
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
              <label className="text-xs mono block mb-1" style={{ color: 'var(--text-muted)' }}>MISSION NAME *</label>
              <input value={missionName} onChange={e => setMissionName(e.target.value)}
                placeholder="e.g. Ukraine Conflict Monitor, Sahel Instability Watch"
                className="w-full px-3 py-2 text-sm rounded border"
                style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <div className="mb-4">
              <label className="text-xs mono block mb-2" style={{ color: 'var(--text-muted)' }}>FOCUS REGIONS * (select all that apply)</label>
              <div className="flex flex-wrap gap-2">
                {REGIONS.map(r => (
                  <button key={r} onClick={() => toggleRegion(r)}
                    className="px-3 py-1 text-xs mono rounded border"
                    style={{
                      borderColor: selectedRegions.includes(r) ? 'var(--primary)' : 'var(--border)',
                      color: selectedRegions.includes(r) ? 'var(--primary)' : 'var(--text-muted)',
                      backgroundColor: selectedRegions.includes(r) ? 'var(--primary)15' : 'transparent',
                    }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs mono block mb-2" style={{ color: 'var(--text-muted)' }}>INTEREST TYPES</label>
              <div className="flex flex-wrap gap-2">
                {INTEREST_TYPES.map(i => (
                  <button key={i} onClick={() => toggleInterest(i)}
                    className="px-3 py-1 text-xs mono rounded border"
                    style={{
                      borderColor: selectedInterests.includes(i) ? 'var(--primary)' : 'var(--border)',
                      color: selectedInterests.includes(i) ? 'var(--primary)' : 'var(--text-muted)',
                      backgroundColor: selectedInterests.includes(i) ? 'var(--primary)15' : 'transparent',
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
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              Priority Intelligence Requirements (PIRs) trigger alerts when events match your criteria. You can skip this and configure later.
            </p>
            <div className="mb-4">
              <label className="text-xs mono block mb-1" style={{ color: 'var(--text-muted)' }}>PIR NAME (optional)</label>
              <input value={pirName} onChange={e => setPirName(e.target.value)}
                placeholder="e.g. Escalation in Eastern Ukraine"
                className="w-full px-3 py-2 text-sm rounded border"
                style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="text-xs mono block mb-1" style={{ color: 'var(--text-muted)' }}>ALERT KEYWORD</label>
              <input value={pirKeyword} onChange={e => setPirKeyword(e.target.value)}
                placeholder="e.g. Kharkiv, missile strike, mobilization"
                className="w-full px-3 py-2 text-sm rounded border"
                style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="text-center">
            <div className="text-4xl mb-4" style={{ color: '#10B981' }}>✓</div>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
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
                  className="p-3 rounded border text-center text-xs mono"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  <div style={{ color: 'var(--primary)' }}>{l.icon}</div>
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Nav buttons */}
        <div className="flex justify-between mt-8">
          {step > 0 && step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s - 1)}
              className="px-4 py-2 text-xs mono rounded border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              ← BACK
            </button>
          ) : <div />}
          <button
            onClick={() => void handleNext()}
            disabled={!canNext() || loading}
            className="px-6 py-2 text-xs mono rounded font-bold"
            style={{ backgroundColor: canNext() ? 'var(--primary)' : 'var(--bg-surface)', color: canNext() ? '#fff' : 'var(--text-muted)' }}>
            {loading ? 'SAVING...' : step === STEPS.length - 1 ? 'OPEN DASHBOARD →' : step === 3 ? 'FINISH SETUP' : 'NEXT →'}
          </button>
        </div>
      </div>
    </div>
  )
}
