'use client'

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, ScanSearch, X } from 'lucide-react'

type Submission = { id?: string | null; source_url: string; confidence_score: number; tier: string; checks?: Array<{ method: string; status?: string; result?: string; summary?: string; notes?: string }>; notes?: string | null; created_at?: string }

const METHOD_OPTIONS = ['Reverse Image Search', 'EXIF Analysis', 'Geolocation Cross-reference', 'Solar Angle Check', 'Shadow Analysis']
const methodKey: Record<string, string> = { 'Reverse Image Search': 'reverse_image_search', 'EXIF Analysis': 'exif_metadata_analysis', 'Geolocation Cross-reference': 'geolocation_cross_reference', 'Solar Angle Check': 'solar_angle_check', 'Shadow Analysis': 'shadow_analysis' }
function statusColor(status: string) { const key = status.toUpperCase(); if (key === 'VERIFIED') return '#22C55E'; if (key === 'PROBABLE') return '#4ADE80'; if (key === 'POSSIBLE') return '#EAB308'; if (key === 'UNVERIFIED') return '#F97316'; if (key === 'FALSE') return '#EF4444'; if (key === 'ANALYZING') return '#60A5FA'; return '#94A3B8' }
function timeAgo(input?: string) { if (!input) return 'now'; const d = Date.now() - new Date(input).getTime(); const m = Math.floor(d / 60000); if (m < 60) return `${m}m ago`; const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`; return `${Math.floor(h / 24)}d ago` }

export function GeoverifyPanel() {
  const ScanSearchIcon = ScanSearch as any
  const ExternalLinkIcon = ExternalLink as any
  const XIcon = X as any
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [submitForm, setSubmitForm] = useState<{ url: string; methods: string[] }>({ url: '', methods: METHOD_OPTIONS.slice(0, 2) })
  const [notes, setNotes] = useState('')

  useEffect(() => { void fetch('/api/v1/geoverify', { cache: 'no-store' }).then((r) => r.json()).then((json: { data?: Submission[] }) => { setSubmissions(json.data ?? []); setSelectedSub((json.data ?? [])[0] ?? null) }) }, [])
  useEffect(() => { setNotes(selectedSub?.notes ?? '') }, [selectedSub])

  const submit = async () => {
    const res = await fetch('/api/v1/geoverify/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: submitForm.url, methods: submitForm.methods.map((m) => methodKey[m]) }) })
    const json = await res.json() as { data?: Submission }
    if (json.data) { const next = [json.data, ...submissions]; setSubmissions(next); setSelectedSub(json.data); setShowSubmitModal(false); setSubmitForm({ url: '', methods: METHOD_OPTIONS.slice(0, 2) }) }
  }
  const exportReport = () => {
    if (!selectedSub) return
    const blob = new Blob([JSON.stringify(selectedSub, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `geoverify-${selectedSub.id || 'report'}.json`; a.click(); URL.revokeObjectURL(url)
  }
  const notePreview = useMemo(() => notes.trim() || 'No analyst notes yet.', [notes])

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
      <div className="rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}><div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Evidence Verification Queue</div><button onClick={() => setShowSubmitModal(true)} className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--primary)', color: '#fff' }}>Submit Evidence</button></div>
        <div className="max-h-[680px] overflow-auto p-3">{submissions.map((item, index) => <button key={`${item.id}-${index}`} onClick={() => setSelectedSub(item)} className="mb-2 block w-full rounded-lg border p-3 text-left" style={{ borderColor: selectedSub?.id === item.id ? 'var(--primary)' : 'var(--border)', background: 'var(--bg-surface-2)' }}><div className="flex items-center justify-between gap-3"><span className="truncate text-sm" style={{ color: 'var(--text-primary)' }}>{item.source_url}</span><span className="rounded-full px-2 py-1 text-[10px]" style={{ background: `${statusColor(item.tier)}22`, color: statusColor(item.tier) }}>{item.tier.toUpperCase()}</span></div><div className="mt-2 flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}><span>{item.confidence_score}% confidence</span><span>{timeAgo(item.created_at)}</span></div></button>)}</div>
      </div>
      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>{!selectedSub ? <div className="flex h-full flex-col items-center justify-center gap-3 text-center"><ScanSearchIcon size={42} style={{ color: 'var(--text-muted)' }} /><div style={{ color: 'var(--text-muted)' }}>Select a submission to review.</div></div> : <div><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm" style={{ color: 'var(--text-primary)' }}>{selectedSub.source_url}</div><a href={selectedSub.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm" style={{ color: 'var(--primary)' }}>Open source <ExternalLinkIcon size={14} /></a></div><div><div className="rounded-full px-3 py-1 text-sm" style={{ background: `${statusColor(selectedSub.tier)}22`, color: statusColor(selectedSub.tier) }}>{selectedSub.tier.toUpperCase()}</div><div className="mt-2 text-right text-[28px]" style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>{selectedSub.confidence_score}%</div></div></div><div className="mt-6"><div className="mb-3 text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>Methods breakdown</div>{(selectedSub.checks ?? []).map((check, i) => <div key={i} className="mb-3 rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)' }}><div className="flex items-center justify-between"><span className="text-sm" style={{ color: 'var(--text-primary)' }}>{check.method.replaceAll('_', ' ')}</span><span className="text-xs" style={{ color: statusColor(check.status || check.result || 'POSSIBLE') }}>{(check.status || check.result || 'possible').toUpperCase()}</span></div><div className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{check.summary || check.notes || 'Analyst evidence attached.'}</div></div>)}</div><div className="mt-6"><div className="mb-2 text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>Notes</div><textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => setSubmissions((prev) => prev.map((item) => item === selectedSub ? { ...item, notes } : item))} rows={5} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)' }} /><div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>{notePreview}</div></div><button onClick={exportReport} className="mt-6 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>Export Report</button></div>}</div>
      {showSubmitModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-lg rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}><div className="mb-4 flex items-center justify-between"><div className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Submit Evidence</div><button onClick={() => setShowSubmitModal(false)}><XIcon size={18} /></button></div><input value={submitForm.url} onChange={(e) => setSubmitForm((prev) => ({ ...prev, url: e.target.value }))} placeholder="https://..." className="mb-4 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)' }} /><div className="space-y-2">{METHOD_OPTIONS.map((method) => <label key={method} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}><input type="checkbox" checked={submitForm.methods.includes(method)} onChange={() => setSubmitForm((prev) => ({ ...prev, methods: prev.methods.includes(method) ? prev.methods.filter((item) => item !== method) : [...prev.methods, method] }))} /> {method}</label>)}</div><button onClick={() => void submit()} className="mt-5 w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--primary)', color: '#fff' }}>Submit</button></div></div>}
    </div>
  )
}
