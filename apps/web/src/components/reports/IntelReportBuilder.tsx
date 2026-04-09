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

  useEffect(() => {
    const loadReports = async () => {
      const res = await fetch('/api/v1/reports', { cache: 'no-store' })
      const json = await res.json() as { data?: IntelReport[] }
      const list = json.data ?? []
      setReports(list)
      if (list[0]) setCurrent(list[0])
    }

    const loadEvents = async () => {
      const res = await fetch('/api/v1/events?limit=25', { cache: 'no-store' })
      const json = await res.json() as { data?: EventRecord[] }
      setEvents(json.data ?? [])
    }

    void loadReports(); void loadEvents()
  }, [])

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
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
      <aside className="rounded-xl border border-white/[0.05] p-4 bg-white/[0.015] hover:bg-white/[0.03] transition-colors">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.15em] font-bold text-white/25">REPORTS</div>
          <button onClick={() => void createReport()} className="text-xs uppercase tracking-[0.15em] text-blue-400 hover:text-blue-300">+ NEW</button>
        </div>
        <div className="space-y-2">
          {reports.map((report) => (
            <button key={report.id} onClick={() => setCurrent(report)} className={`block w-full rounded-lg border p-3 text-left transition-all ${current?.id === report.id ? 'bg-blue-500/20 border-blue-400 text-white' : 'bg-white/[0.03] border-white/[0.05] text-white hover:bg-white/[0.05]'}`}>
              <div className="text-sm font-semibold text-white">{report.title}</div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-white/50 mt-1">{report.classification_banner}</div>
            </button>
          ))}
        </div>
      </aside>

      <section className="rounded-xl border border-white/[0.05] p-6 bg-white/[0.015] hover:bg-white/[0.03] transition-colors">
        {!current ? (
          <div className="text-sm text-white/50">Create a report to begin.</div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <input value={current.title} onChange={(event) => setCurrent({ ...current, title: event.target.value })}
                onBlur={() => void save(current)} className="flex-1 rounded-lg border border-white/[0.05] bg-white/[0.03] px-3 py-2 text-lg font-semibold text-white placeholder:text-white/20 focus:outline-none focus:border-blue-400/50" />
              <select value={current.classification_banner} onChange={(event) => void save({ ...current, classification_banner: event.target.value })}
                className="rounded-lg border border-white/[0.05] bg-white/[0.03] px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400/50">
                <option>UNCLASSIFIED</option><option>CONFIDENTIAL</option><option>SECRET</option>
              </select>
              <button onClick={() => window.print()} className="rounded-lg border border-white/[0.05] bg-white/[0.03] px-3 py-2 text-xs uppercase tracking-[0.15em] text-white/60 hover:text-white hover:bg-white/[0.05]">Export PDF</button>
              <button onClick={() => void share()} className="rounded-lg bg-blue-500 px-3 py-2 text-xs uppercase tracking-[0.15em] text-white hover:bg-blue-600">Share</button>
            </div>
            <div className="mb-5 rounded-lg border border-white/[0.05] bg-white/[0.03] px-4 py-2 text-center text-xs uppercase tracking-[0.15em] font-bold text-white/25">
              {current.classification_banner}
            </div>
            <div className="space-y-4">
              {current.sections.map((section, index) => (
                <div key={`${section.type}-${index}`} className="rounded-lg border border-white/[0.05] bg-white/[0.015] p-4 hover:bg-white/[0.03] transition-colors">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.15em] text-white/25">{section.type.replace('_', ' ')}</span>
                    <button onClick={() => void save({ ...current, sections: current.sections.filter((_, i) => i !== index) })} className="text-[10px] uppercase tracking-[0.15em] text-red-400 hover:text-red-300">Remove</button>
                  </div>
                  {section.type === 'events' ? (
                    <div className="space-y-2">
                      <textarea value={section.content} onChange={(event) => {
                        const next = [...current.sections]
                        next[index] = { ...section, content: event.target.value }
                        setCurrent({ ...current, sections: next })
                      }} onBlur={() => void save(current)} rows={2}
                        className="w-full rounded-lg border border-white/[0.05] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-blue-400/50" />
                      <div className="flex flex-wrap gap-2">
                        {(section.event_ids ?? []).map((eventId) => {
                          const event = events.find((candidate) => candidate.id === eventId)
                          return <span key={eventId} className="rounded-lg bg-blue-500/20 px-2 py-1 text-[11px] uppercase tracking-[0.15em] text-blue-400">{event?.title ?? eventId}</span>
                        })}
                      </div>
                    </div>
                  ) : section.type === 'header' ? (
                    <input value={section.content} onChange={(event) => {
                      const next = [...current.sections]
                      next[index] = { ...section, content: event.target.value }
                      setCurrent({ ...current, sections: next })
                    }} onBlur={() => void save(current)} className="w-full rounded-lg border border-white/[0.05] bg-white/[0.03] px-3 py-2 text-base font-semibold text-white placeholder:text-white/20 focus:outline-none focus:border-blue-400/50" />
                  ) : (
                    <textarea value={section.content} onChange={(event) => {
                      const next = [...current.sections]
                      next[index] = { ...section, content: event.target.value }
                      setCurrent({ ...current, sections: next })
                    }} onBlur={() => void save(current)} rows={5} className="w-full rounded-lg border border-white/[0.05] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-blue-400/50" />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {SECTION_TYPES.map((type) => <button key={type} onClick={() => addSection(type)} className="rounded-lg border border-white/[0.05] bg-white/[0.03] px-3 py-2 text-xs uppercase tracking-[0.15em] text-white/60 hover:text-white hover:bg-white/[0.05]">+ {type}</button>)}
              <button onClick={() => void generateSummary()} className="rounded-lg bg-blue-500 px-3 py-2 text-xs uppercase tracking-[0.15em] text-white hover:bg-blue-600">Generate AI Summary</button>
            </div>
          </>
        )}
      </section>

      <aside className="rounded-xl border border-white/[0.05] p-4 bg-white/[0.015] hover:bg-white/[0.03] transition-colors">
        <div className="mb-3 text-xs uppercase tracking-[0.15em] font-bold text-white/25">Recent Events</div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events"
          className="mb-3 w-full rounded-lg border border-white/[0.05] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-blue-400/50" />
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
              className="block w-full rounded-lg border border-white/[0.05] bg-white/[0.015] p-3 text-left hover:bg-white/[0.03] transition-colors">
              <div className="text-sm text-white">{event.title}</div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-white/50 mt-1">{event.country_code ?? '—'} · SEV {event.severity ?? '—'}</div>
            </button>
          ))}
        </div>
      </aside>
    </div>
  )
}
