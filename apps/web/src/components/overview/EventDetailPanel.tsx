'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ExternalLink, Bell, Bot, Copy, ChevronDown, ChevronUp } from 'lucide-react'
import type { EntityMention, OverviewEvent } from './types'
import { getBestDescription, cleanDescription, getOutletDisplay, getRegionDisplay } from '@/lib/event-presentation'

const IconX = X as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconExternalLink = ExternalLink as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconBell = Bell as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconBot = Bot as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconCopy = Copy as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconChevUp = ChevronUp as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconChevDown = ChevronDown as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>

const SEVERITY_CONFIG = {
  4: { label: 'Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  3: { label: 'High', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  2: { label: 'Medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  1: { label: 'Low', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
} as const

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Confirmed', color: '#10b981' },
  developing: { label: 'Developing', color: '#f59e0b' },
  disputed: { label: 'Disputed', color: '#8b5cf6' },
  corrected: { label: 'Corrected', color: '#6b7280' },
  pending: { label: 'Developing', color: '#f59e0b' },
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  armed_conflict: 'Armed Conflict',
  airstrike: 'Airstrike',
  terrorism: 'Terrorism',
  coup: 'Coup',
  civil_unrest: 'Civil Unrest',
  protest: 'Protest',
  political_crisis: 'Political Crisis',
  sanctions: 'Sanctions',
  ceasefire: 'Ceasefire',
  diplomacy: 'Diplomacy',
  wmd_threat: 'WMD Threat',
  humanitarian_crisis: 'Humanitarian Crisis',
  natural_disaster: 'Natural Disaster',
  security: 'Security',
  cyber: 'Cyber',
  displacement: 'Displacement',
  humanitarian: 'Humanitarian',
  border_incident: 'Border Incident',
  maritime_incident: 'Maritime Incident',
  aviation_incident: 'Aviation Incident',
  military: 'Military',
  mobilization: 'Mobilization',
  explosion: 'Explosion',
  attack: 'Attack',
  news: 'News',
}

type RelatedEvent = Pick<OverviewEvent, 'id' | 'title' | 'occurred_at' | 'region' | 'severity'>

interface EventDetailPanelProps {
  event: OverviewEvent | null
  onClose: () => void
  onSelect?: (event: OverviewEvent) => void
  hasOrg: boolean
}

function formatRelativeOccurredTime(occurredAt: string | null | undefined): string {
  if (!occurredAt) return '—'
  const diffMs = Date.now() - new Date(occurredAt).getTime()
  const minutes = Math.max(0, Math.floor(diffMs / 60000))
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
}

function formatPublishedUtc(occurredAt: string | null | undefined): string {
  if (!occurredAt) return 'Unknown'
  const date = new Date(occurredAt)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return `${date.toLocaleString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })} · ${date.toLocaleString('en-US', {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })} UTC`
}

function isBreakingEvent(event: OverviewEvent): boolean {
  const occurredAt = event.occurred_at
  if (!occurredAt) return false
  const ageMs = Date.now() - new Date(occurredAt).getTime()
  if (ageMs > 2 * 60 * 60 * 1000) return false
  if ((event.severity ?? 0) < 3) return false
  return new Set(['conflict', 'armed_conflict', 'airstrike', 'military', 'political', 'terrorism', 'coup', 'attack', 'explosion', 'border_incident', 'maritime_incident', 'aviation_incident']).has(event.event_type ?? '')
}

function isDevelopingEvent(event: OverviewEvent): boolean {
  const occurredAt = event.occurred_at
  if (!occurredAt) return false
  const ageMs = Date.now() - new Date(occurredAt).getTime()
  return ageMs <= 6 * 60 * 60 * 1000
}

function truncate(text: string, max = 80): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trim()}…`
}

function copyToClipboard(text: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    void navigator.clipboard.writeText(text)
  }
}

function getActorColor(type: string): string {
  switch (type.toLowerCase()) {
    case 'country': return '#3b82f6'
    case 'organization': return '#8b5cf6'
    case 'person': return '#14b8a6'
    case 'location': return '#6b7280'
    default: return '#6b7280'
  }
}

function getSeverityBarColor(score: number): string {
  if (score >= 80) return '#ef4444'
  if (score >= 60) return '#f97316'
  if (score >= 40) return '#f59e0b'
  return '#6b7280'
}

export function EventDetailPanel({ event, onClose, onSelect, hasOrg }: EventDetailPanelProps) {
  const [copied, setCopied] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [related, setRelated] = useState<RelatedEvent[]>([])

  useEffect(() => {
    setCopied(false)
    setDetailsOpen(false)
    setRelated([])
  }, [event?.id])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (!event?.id) return
    fetch(`/api/v1/events/${event.id}/related`)
      .then((r) => r.json() as Promise<{ related: RelatedEvent[] }>)
      .then((d) => setRelated(d.related ?? []))
      .catch(() => {})
  }, [event?.id])

  const linkUrl = event?.provenance_raw?.url ?? event?.source_id ?? null

  const actors: EntityMention[] = useMemo(() => (
    Array.isArray(event?.entities) ? (event.entities as EntityMention[]).slice(0, 6) : []
  ), [event?.entities])

  if (!event) return null

  const sevKey = (event.severity ?? 1) as 1 | 2 | 3 | 4
  const sev = SEVERITY_CONFIG[sevKey] ?? SEVERITY_CONFIG[1]
  const rawStatus = STATUS_CONFIG[event.status ?? 'pending'] ?? STATUS_CONFIG.pending ?? { label: 'Developing', color: '#f59e0b' }
  const statusPill = isBreakingEvent(event)
    ? { label: 'BREAKING', color: '#ef4444', background: 'rgba(239,68,68,0.14)', pulse: true }
    : isDevelopingEvent(event)
      ? { label: 'DEVELOPING', color: '#cbd5e1', background: 'rgba(148,163,184,0.14)', pulse: false }
      : { label: rawStatus.label.toUpperCase(), color: rawStatus.color, background: 'rgba(255,255,255,0.06)', pulse: false }

  const severityVisible = (event.severity ?? 1) > 1
  const outlet = getOutletDisplay(event.outlet_name, linkUrl)
  const region = getRegionDisplay(event.region) ?? 'Global'
  const timeAgo = formatRelativeOccurredTime(event.occurred_at)
  const eventId = event.id
  const description = cleanDescription(
    event.description ?? getBestDescription(event, 1600) ?? '',
    event.title ?? ''
  )
  const summaryShort = (event.summary_short ?? '').trim()
  const significanceScore = typeof event.significance_score === 'number' ? event.significance_score : null
  const significanceBarColor = significanceScore !== null ? getSeverityBarColor(significanceScore) : '#6b7280'
  const detailAccent = severityVisible ? sev.color : '#6b7280'

  function handleCopyLink() {
    copyToClipboard(`https://conflictradar.co/feed?event=${eventId}`)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  function handleCopilotOpen() {
    window.dispatchEvent(new CustomEvent('intel-copilot:open'))
  }

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />

      <motion.div
        key="panel"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 z-50 flex flex-col overflow-y-auto"
        style={{
          width: 'min(440px, 100vw)',
          height: 'auto',
          maxHeight: '90vh',
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border)',
          marginTop: '5vh',
          marginBottom: '5vh',
        }}
      >
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-5 py-4"
          style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            {severityVisible && (
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: sev.color, color: '#fff' }}
              >
                {sev.label}
              </span>
            )}
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ background: statusPill.background, color: statusPill.color }}
            >
              {statusPill.pulse && <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: '#ef4444' }} />}
              {statusPill.label}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {linkUrl && (
              <a
                href={linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg p-2 transition-colors hover:bg-white/10"
                style={{ color: 'var(--text-muted)' }}
                aria-label="Open source"
              >
                <IconExternalLink size={16} />
              </a>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-2 transition-colors hover:bg-white/10"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Close"
            >
              <IconX size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-6 px-5 py-5">
          <div>
            <h2 className="text-2xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
              {event.title ?? 'Untitled Event'}
            </h2>
            <div className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {[outlet, region, timeAgo].filter(Boolean).join(' · ')}
            </div>
          </div>

          <section
            className="rounded-xl p-4"
            style={{
              border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.03)',
              borderLeft: summaryShort ? `4px solid ${detailAccent}` : '1px solid var(--border)',
            }}
          >
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: summaryShort ? detailAccent : 'var(--text-muted)' }}>
              {summaryShort ? 'Intelligence Brief' : 'Details'}
            </div>

            {summaryShort ? (
              <>
                <p className="text-sm leading-7" style={{ color: 'var(--text-primary)' }}>
                  {summaryShort}
                </p>
                <button
                  onClick={() => setDetailsOpen((current) => !current)}
                  className="mt-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Full Details {detailsOpen ? <IconChevUp size={12} /> : <IconChevDown size={12} />}
                </button>
                {detailsOpen && (
                  <p className="mt-3 text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
                    {description || 'No additional details available.'}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
                {description || 'No additional details available.'}
              </p>
            )}
          </section>

          <section className={`grid gap-3 ${significanceScore && significanceScore > 0 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
            <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.02)' }}>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>Published</div>
              <div className="text-sm leading-6" style={{ color: 'var(--text-primary)' }}>{formatPublishedUtc(event.occurred_at)}</div>
            </div>
            <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.02)' }}>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>Event Type</div>
              <div className="text-sm leading-6" style={{ color: 'var(--text-primary)' }}>{EVENT_TYPE_LABELS[event.event_type ?? ''] ?? event.event_type ?? 'General'}</div>
            </div>
            {significanceScore !== null && significanceScore > 0 && (
              <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>Significance</div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{significanceScore} / 100</div>
                <div className="mt-2 h-1.5 w-full rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(significanceScore, 100))}%`, background: significanceBarColor }} />
                </div>
              </div>
            )}
          </section>

          {actors.length > 0 && (
            <section>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--text-muted)' }}>Key Actors</div>
              <div className="flex flex-wrap gap-2">
                {actors.map((actor, index) => (
                  <span
                    key={`${actor.name}-${index}`}
                    className="rounded-full px-3 py-1.5 text-xs font-medium"
                    style={{
                      background: `${getActorColor(actor.type)}22`,
                      color: getActorColor(actor.type),
                      border: `1px solid ${getActorColor(actor.type)}33`,
                    }}
                  >
                    {actor.name}
                  </span>
                ))}
              </div>
            </section>
          )}

          {related.length > 0 && (
            <section>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--text-muted)' }}>Related Events</div>
              <div className="space-y-2">
                {related.map((relatedEvent) => {
                  const dotColor = relatedEvent.severity && relatedEvent.severity >= 4
                    ? '#ef4444'
                    : relatedEvent.severity === 3
                      ? '#f97316'
                      : relatedEvent.severity === 2
                        ? '#f59e0b'
                        : '#6b7280'

                  return (
                    <button
                      key={relatedEvent.id}
                      onClick={() => onSelect?.({ ...event, ...relatedEvent })}
                      className="w-full rounded-xl border px-3 py-3 text-left transition-colors hover:bg-white/5"
                      style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.02)' }}
                    >
                      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                        <span className="h-2 w-2 rounded-full" style={{ background: dotColor }} />
                        <span>{truncate(relatedEvent.title ?? 'Untitled event')}</span>
                        <span style={{ color: 'var(--text-muted)' }}>· {formatRelativeOccurredTime(relatedEvent.occurred_at)}</span>
                      </div>
                      <div className="mt-1 pl-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {getRegionDisplay(relatedEvent.region) ?? 'Global'}
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        <div
          className="sticky bottom-0 grid grid-cols-3 gap-2 px-5 py-4"
          style={{
            background: 'rgba(10,10,10,0.78)',
            backdropFilter: 'blur(8px)',
            borderTop: '1px solid var(--border)',
          }}
        >
          <button
            onClick={handleCopyLink}
            className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-white/5"
            style={{ color: copied ? '#10b981' : 'var(--text-primary)', border: '1px solid var(--border)' }}
          >
            <IconCopy size={14} />
            {copied ? 'Copied!' : 'Copy Link'}
          </button>

          {hasOrg ? (
            <a
              href="/alerts"
              className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-white/5"
              style={{ color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            >
              <IconBell size={14} /> Create Alert
            </a>
          ) : (
            <button
              title="Workspace required — create a workspace to set alerts"
              className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)', opacity: 0.6, cursor: 'default' }}
            >
              <IconBell size={14} /> Create Alert
            </button>
          )}

          <button
            onClick={handleCopilotOpen}
            className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-white/5"
            style={{ color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          >
            <IconBot size={14} /> Intel Co-pilot
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
