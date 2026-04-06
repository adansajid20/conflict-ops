'use client'

import { useEffect, useMemo, useState } from 'react'

type MissionRecord = {
  id: string
  name: string
  created_at: string
}

type EventRecord = {
  id: string
  title: string
  event_type?: string | null
  severity?: number | null
  occurred_at?: string | null
  region?: string | null
}

type ApiResponse<T> = {
  success?: boolean
  data?: T
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function CaseTimeline() {
  const [missions, setMissions] = useState<MissionRecord[]>([])
  const [events, setEvents] = useState<EventRecord[]>([])
  const [selectedMissionId, setSelectedMissionId] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    void fetch('/api/v1/missions', { cache: 'no-store' })
      .then((response) => response.json() as Promise<ApiResponse<MissionRecord[]>>)
      .then((json) => {
        const nextMissions = json.data ?? []
        setMissions(nextMissions)
        if (nextMissions[0]?.id) setSelectedMissionId((current) => current || nextMissions[0]?.id || '')
      })
      .catch(() => undefined)

    void fetch('/api/v1/events?window=30d&limit=200', { cache: 'no-store' })
      .then((response) => response.json() as Promise<ApiResponse<EventRecord[]>>)
      .then((json) => setEvents(json.data ?? []))
      .catch(() => undefined)
  }, [])

  const selectedMission = useMemo(() => missions.find((mission) => mission.id === selectedMissionId) ?? missions[0] ?? null, [missions, selectedMissionId])

  const missionStart = selectedMission ? new Date(selectedMission.created_at).getTime() : Date.now() - (7 * 24 * 60 * 60 * 1000)
  const missionEnd = Date.now()

  const filteredEvents = useMemo(() => {
    return [...events]
      .filter((event) => {
        const occurredAt = event.occurred_at ? new Date(event.occurred_at).getTime() : 0
        if (occurredAt < missionStart || occurredAt > missionEnd) return false
        if (typeFilter !== 'all' && (event.event_type ?? 'unknown') !== typeFilter) return false
        if (severityFilter !== 'all' && String(event.severity ?? 0) !== severityFilter) return false
        return true
      })
      .sort((left, right) => new Date(left.occurred_at ?? 0).getTime() - new Date(right.occurred_at ?? 0).getTime())
  }, [events, missionEnd, missionStart, severityFilter, typeFilter])

  const visibleEvents = filteredEvents.slice(0, currentIndex + 1)
  const activeEvent = filteredEvents[currentIndex] ?? null
  const typeOptions = useMemo(() => [...new Set(events.map((event) => event.event_type ?? 'unknown'))], [events])

  useEffect(() => {
    setCurrentIndex(0)
    setIsPlaying(false)
  }, [selectedMissionId, typeFilter, severityFilter])

  useEffect(() => {
    if (!isPlaying || filteredEvents.length === 0) return
    const timer = window.setInterval(() => {
      setCurrentIndex((current) => {
        if (current >= filteredEvents.length - 1) {
          window.clearInterval(timer)
          setIsPlaying(false)
          return current
        }
        return current + 1
      })
    }, 200)

    return () => window.clearInterval(timer)
  }, [filteredEvents.length, isPlaying])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <label>
            <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/50">Mission</div>
            <select value={selectedMission?.id ?? ''} onChange={(e) => setSelectedMissionId(e.target.value)} className="w-full rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-sm text-white">
              {missions.length === 0 ? <option value="">No missions</option> : missions.map((mission) => <option key={mission.id} value={mission.id}>{mission.name}</option>)}
            </select>
          </label>
          <label>
            <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/50">Type</div>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-full rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-sm text-white">
              <option value="all">All</option>
              {typeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/50">Severity</div>
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="w-full rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-sm text-white">
              <option value="all">All</option>
              {[1, 2, 3, 4, 5].map((value) => <option key={value} value={String(value)}>{value}</option>)}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button onClick={() => setIsPlaying((current) => !current)} disabled={filteredEvents.length === 0} className="rounded-lg px-3 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50" style={{ backgroundColor: '#3B82F6' }}>{isPlaying ? 'Pause' : 'Play'}</button>
            <button onClick={() => setCurrentIndex(0)} className="rounded-lg border border-white/[0.05] px-3 py-2 text-sm text-white/80 hover:bg-white/5">Reset</button>
          </div>
        </div>

        <div className="mt-4">
          <input type="range" min={0} max={Math.max(filteredEvents.length - 1, 0)} value={clamp(currentIndex, 0, Math.max(filteredEvents.length - 1, 0))} onChange={(e) => setCurrentIndex(Number(e.target.value))} className="w-full" />
          <div className="mt-1 flex justify-between text-xs text-white/50">
            <span>{selectedMission ? new Date(selectedMission.created_at).toLocaleDateString() : 'Mission start'}</span>
            <span>{activeEvent?.occurred_at ? new Date(activeEvent.occurred_at).toLocaleString() : 'No event selected'}</span>
            <span>{new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-4">
        <div className="mb-4 text-xs uppercase tracking-[0.16em] text-white/50">Timeline playback</div>
        <div className="relative overflow-x-auto pb-4">
          <div className="relative h-24 min-w-[900px]">
            <div className="absolute left-0 right-0 top-10 h-px bg-white/[0.05]" />
            {visibleEvents.map((event) => {
              const occurredAt = event.occurred_at ? new Date(event.occurred_at).getTime() : missionStart
              const position = missionEnd === missionStart ? 0 : ((occurredAt - missionStart) / (missionEnd - missionStart)) * 100
              const severity = event.severity ?? 1
              const isActive = activeEvent?.id === event.id
              return (
                <div key={event.id} className="absolute top-0 -translate-x-1/2" style={{ left: `${clamp(position, 0, 100)}%` }}>
                  <div className="mx-auto h-5 w-5 rounded-full border-2" style={{ background: isActive ? '#3B82F6' : 'rgba(255,255,255,0.025)', borderColor: severity >= 4 ? '#EF4444' : severity >= 3 ? '#F97316' : '#22C55E' }} />
                  <div className="mt-2 w-32 rounded-lg border border-white/[0.05] bg-white/[0.025] p-2 text-[11px] text-white" style={{ borderColor: isActive ? '#3B82F6' : undefined }}>
                    <div className="truncate font-medium">{event.title}</div>
                    <div className="text-white/50">{event.event_type ?? 'unknown'} · sev {severity}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="mt-2 text-sm text-white/50">
          {filteredEvents.length === 0 ? 'No events found in the selected mission window.' : `Showing ${visibleEvents.length} of ${filteredEvents.length} events`}
        </div>
      </div>

      {activeEvent && (
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-4">
          <div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/50">Current event</div>
          <div className="text-sm font-medium text-white">{activeEvent.title}</div>
          <div className="mt-1 text-sm text-white/50">{activeEvent.event_type ?? 'unknown'} · severity {activeEvent.severity ?? 'n/a'} · {activeEvent.region ?? 'Unknown region'}</div>
        </div>
      )}
    </div>
  )
}
