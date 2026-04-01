'use client'

import { useEffect, useMemo, useState } from 'react'
import type { IntelReport, ReportSection, ReportSectionType } from '@/lib/reports/types'

type EventRecord = {
  id: string
  title: string
  description: string | null
  severity: number | null
  country_code: string | null
  occurred_at: string | null
}

const SECTION_TYPES: ReportSectionType[] = ['header', 'text', 'events', 'ai_summary']

export function IntelReportBuilder() {
  const [reports, setReports] = useState<IntelReport[]>([])
  const [current, setCurrent] = useState<IntelReport | null>(null)
  const [events, setEvents] = useState<EventRecord[]>([])
  const [query, setQuery] = useState('')

  const loadReports = async () => {
    const res = await fetch('/api/v1/reports', { cache: 'no-store' })
    const json = await res.json() as { data?: IntelReport[] }
    const list = json.data ?? []
    setReports(list)
    if (!current && list[0]) setCurrent(list[0])
  }

  const loadEvents = async () => {
    const res = await fetch('/api/v1/events?limit=25', { cache: 'no-store' })
    const json = await res.json() as { data?: EventRecord[] }
    setEvents(json.data ?? [])
  }

  useEffect(() => { void loadReports(); void loadEvents() }, [])

  const createReport = async () => {
    const res = await fetch('/api/v1/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'New Intel Report', classification_banner: 'UNCLASSIFIED' }) })
    const json = await res.json() as { data?: IntelReport }
    if (json.data) {
      setCurrent(json.data)
      setReports((existing) => [json.data as IntelReport, ...existing])
    }
  }

  const save = async (next: IntelReport) => {
    setCurrent(next)
    await fetch(`/api/v1/reports/${next.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: next.title, classification_banner: next.classification_banner, sections: next.sections }) })
    setReports((existing) => existing.map((report) => report.id === next.id ? next : report))
  }

  const addSection = (type: ReportSectionType) => {
    if (!current) return
    const section: ReportSection = { type, content: type === 'header' ? 'Section header' : '' }
    void save({ ...current, sections: [...current.sections, section] })
  }

  const generateSummary = async () => {
    if (!current) return
    const res = await fetch(`/api/v1/reports/${current.id}/ai-summary`, { method: 'POST' })
    const json = await res.json() as { data?: { summary: string } }
    if (json.data?.summary) {
      void save({ ...current, sections: [...current.sections, { type: 'ai_summary', content: json.data.summary }] })
    }
  }

  const share = async () => {
    if (!current) return
    const res = await fetch(`/api/v1/reports/${current.id}/share`, { method: 'POST' })
    const json = await res.json() as { data?: { share_url: string } }
    if (json.data?.share_url) await navigator.clipboard.writeText(json.data.share_url)
  }

  const filteredEvents = useMemo(() => events.filter((event) => `${event.title} ${event.description ?? ''}`.toLowerCase().includes(query.toLowerCase())), [events, query])

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
      <aside className="rounded border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs mono font-bold" style={{ color: 'var(--text-primary)' }}>REPORTS</div>
          <button onClick={() => void createReport()} className="text-xs mono" style={{ color: 'var(--primary)' }}>+ NEW</button>
        </div>
        <div className="space-y-2">
          {reports.map((report) => (
            <button key={report.id} onClick={() => setCurrent(report)} className="block w-full rounded border p-3 text-left"
              style={{ borderColor: current?.id === report.id ? 'var(--primary)' : 'var(--border)', background: current?.id === report.id ? 'var(--primary-dim)' : 'var(--bg-surface-2)' }}>
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{report.title}</div>
              <div className="text-[10px] mono" style={{ color: 'var(--text-muted)' }}>{report.classification_banner}</div>
            </button>
          ))}
        </div>
      </aside>

      <section className="rounded border p-6 print-surface" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        {!current ? (
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Create a report to begin.</div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <input value={current.title} onChange={(event) => setCurrent({ ...current, title: event.target.value })}
                onBlur={() => void save(current)} className="flex-1 rounded border px-3 py-2 text-lg font-semibold"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }} />
              <select value={current.classification_banner} onChange={(event) => void save({ ...current, classification_banner: event.target.value })}
                className="rounded border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
                <option>UNCLASSIFIED</option><option>CONFIDENTIAL</option><option>SECRET</option>
              </select>
              <button onClick={() => window.print()} className="rounded px-3 py-2 text-xs mono" style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}>EXPORT PDF</button>
              <button onClick={() => void share()} className="rounded px-3 py-2 text-xs mono" style={{ background: 'var(--primary)', color: '#fff' }}>SHARE</button>
            </div>
            <div className="mb-5 rounded border px-4 py-2 text-center text-xs mono font-bold" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)' }}>
              {current.classification_banner}
            </div>
            <div className="space-y-4">
              {current.sections.map((section, index) => (
                <div key={`${section.type}-${index}`} className="rounded border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)' }}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] mono" style={{ color: 'var(--text-muted)' }}>{section.type.toUpperCase()}</span>
                    <button onClick={() => void save({ ...current, sections: current.sections.filter((_, i) => i !== index) })} className="text-[10px] mono" style={{ color: 'var(--sev-critical)' }}>REMOVE</button>
                  </div>
                  {section.type === 'events' ? (
                    <div className="space-y-2">
                      <textarea value={section.content} onChange={(event) => {
                        const next = [...current.sections]
                        next[index] = { ...section, content: event.target.value }
                        setCurrent({ ...current, sections: next })
                      }} onBlur={() => void save(current)} rows={2}
                        className="w-full rounded border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }} />
                      <div className="flex flex-wrap gap-2">
                        {(section.event_ids ?? []).map((eventId) => {
                          const event = events.find((candidate) => candidate.id === eventId)
                          return <span key={eventId} className="rounded px-2 py-1 text-[11px] mono" style={{ background: 'var(--primary-dim)', color: 'var(--primary)' }}>{event?.title ?? eventId}</span>
                        })}
                      </div>
                    </div>
                  ) : section.type === 'header' ? (
                    <input value={section.content} onChange={(event) => {
                      const next = [...current.sections]
                      next[index] = { ...section, content: event.target.value }
                      setCurrent({ ...current, sections: next })
                    }} onBlur={() => void save(current)} className="w-full rounded border px-3 py-2 text-base font-semibold" style={{ borderColor: 'var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }} />
                  ) : (
                    <textarea value={section.content} onChange={(event) => {
                      const next = [...current.sections]
                      next[index] = { ...section, content: event.target.value }
                      setCurrent({ ...current, sections: next })
                    }} onBlur={() => void save(current)} rows={5} className="w-full rounded border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }} />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {SECTION_TYPES.map((type) => <button key={type} onClick={() => addSection(type)} className="rounded px-3 py-2 text-xs mono" style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}>+ {type}</button>)}
              <button onClick={() => void generateSummary()} className="rounded px-3 py-2 text-xs mono" style={{ background: 'var(--primary)', color: '#fff' }}>GENERATE AI SUMMARY</button>
            </div>
          </>
        )}
      </section>

      <aside className="rounded border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <div className="mb-3 text-xs mono font-bold" style={{ color: 'var(--text-primary)' }}>RECENT EVENTS</div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events"
          className="mb-3 w-full rounded border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }} />
        <div className="space-y-2 max-h-[720px] overflow-y-auto">
          {filteredEvents.map((event) => (
            <button key={event.id} draggable onDragStart={(dragEvent) => dragEvent.dataTransfer.setData('text/plain', event.id)}
              onClick={() => {
                if (!current) return
                const existingEvents = current.sections.find((section) => section.type === 'events')
                if (existingEvents) {
                  const nextSections = current.sections.map((section) => section.type === 'events'
                    ? { ...section, event_ids: [...new Set([...(section.event_ids ?? []), event.id])] }
                    : section)
                  void save({ ...current, sections: nextSections })
                } else {
                  void save({ ...current, sections: [...current.sections, { type: 'events', content: 'Referenced events', event_ids: [event.id] }] })
                }
              }}
              className="block w-full rounded border p-3 text-left" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)' }}>
              <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{event.title}</div>
              <div className="text-[10px] mono" style={{ color: 'var(--text-muted)' }}>{event.country_code ?? '—'} · SEV {event.severity ?? '—'}</div>
            </button>
          ))}
        </div>
      </aside>
    </div>
  )
}
