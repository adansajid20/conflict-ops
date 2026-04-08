'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ExternalLink, Bell, Bot, Copy, ChevronDown, ChevronUp, Clock, Tag, BarChart3 } from 'lucide-react'
import type { EntityMention, OverviewEvent } from './types'
import { getBestDescription, cleanDescription, getOutletDisplay, getRegionDisplay } from '@/lib/event-presentation'

const IconX = X as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconExternalLink = ExternalLink as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconBell = Bell as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconBot = Bot as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconCopy = Copy as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconChevUp = ChevronUp as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconChevDown = ChevronDown as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconClock = Clock as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconTag = Tag as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconBar = BarChart3 as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>

const SEVERITY_CONFIG = {
  4: { label: 'Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  3: { label: 'High', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  2: { label: 'Medium', color: '#eab308', bg: 'rgba(234,179,8,0.12)' },
  1: { label: 'Low', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
} as const

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Confirmed', color: '#10b981' },
  developing: { label: 'Developing', color: '#94a3b8' },
  disputed: { label: 'Disputed', color: '#8b5cf6' },
  corrected: { label: 'Corrected', color: '#6b7280' },
  pending: { label: 'Developing', color: '#94a3b8' },
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  armed_conflict: 'Armed Conflict',
  airstrike: 'Airstrike',
  terrorism: 'Terrorism',
  coup: 'Coup',
  civil_unrest: 'Civil Unrest',
  protest: 'Protest',
  political_crisis: 'Political Crisis',
  political: 'Political',
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
  const rawStatus = STATUS_CONFIG[event.status ?? 'pending'] ?? STATUS_CONFIG.pending ?? { label: 'Developing', color: '#94a3b8' }
  const statusPill = isBreakingEvent(event)
    ? { label: 'BREAKING', color: '#ef4444', background: 'rgba(239,68,68,0.14)', pulse: true }
    : isDevelopingEvent(event)
      ? { label: 'DEVELOPING', color: '#94a3b8', background: 'rgba(148,163,184,0.10)', pulse: false }
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
  const eventTypeLabel = EVENT_TYPE_LABELS[event.event_type ?? ''] ?? event.event_type ?? 'General'

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
        style={{ background: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      />

      <motion.div
        key="panel"
        initial={{ opacity: 0, x: 40, scale: 0.97 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 40, scale: 0.97 }}
        transition={{ type: 'spring' as const, damping: 28, stiffness: 320 }}
        className="fixed right-4 top-4 z-50 flex flex-col overflow-y-auto rounded-2xl"
        style={{
          width: 'min(440px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 32px)',
          background: '#0C1222',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 8px 24px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3" style={{ background: 'rgba(12,18,34,0.95)', borderRadius: '16px 16px 0 0' }}>
          <div className="flex items-center gap-2">
            {severityVisible && (
              <span
                className="rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
                style={{ background: sev.bg, color: sev.color, border: `1px solid ${sev.color}30` }}
              >
                {sev.label}
              </span>
            )}
            <span
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
              style={{ background: statusPill.background, color: statusPill.color, border: `1px solid ${statusPill.color}20` }}
            >
              {statusPill.pulse && <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: '#ef4444' }} />}
              {statusPill.label}
            </span>
          </div>

          <div className="flex items-center gap-0.5">
            {linkUrl && (
              <a
                href={linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg p-2 text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/60"
                aria-label="Open source"
              >
                <IconExternalLink size={15} />
              </a>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/60"
              aria-label="Close"
            >
              <IconX size={15} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-5 px-5 py-5">
          {/* Title + source line */}
          <div>
            <h2 className="text-xl font-bold leading-snug text-white">
              {event.title ?? 'Untitled Event'}
            </h2>
            <div className="mt-2 flex items-center gap-1.5 text-[13px] text-white/40">
              {linkUrl ? (
                <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400/70 hover:text-blue-400 transition-colors">{outlet}</a>
              ) : (
                <span>{outlet}</span>
              )}
              <span className="text-white/15">·</span>
              <span>{region}</span>
              <span className="text-white/15">·</span>
              <span>{timeAgo}</span>
            </div>
          </div>

          {/* Description — flat, no nested box */}
          <div>
            {summaryShort ? (
              <>
                <p className="text-[14px] leading-7 text-white/80">
                  {summaryShort}
                </p>
                {description && description !== summaryShort && (
                  <>
                    <button
                      onClick={() => setDetailsOpen((c) => !c)}
                      className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-white/30 transition-colors hover:text-white/50"
                    >
                      {detailsOpen ? 'Hide details' : 'Show full details'}
                      {detailsOpen ? <IconChevUp size={12} /> : <IconChevDown size={12} />}
                    </button>
                    {detailsOpen && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-3 text-[13px] leading-7 text-white/50"
                      >
                        {description}
                      </motion.p>
                    )}
                  </>
                )}
              </>
            ) : (
              <p className="text-[14px] leading-7 text-white/70">
                {description || 'No details available for this event.'}
              </p>
            )}
          </div>

          {/* Metadata row — flat inline instead of separate boxes */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
            <div className="flex items-center gap-2">
              <IconClock size={13} className="text-white/20" />
              <div>
                <div className="text-[10px] font-medium uppercase tracking-widest text-white/25">Published</div>
                <div className="text-[12px] text-white/70">{formatPublishedUtc(event.occurred_at)}</div>
              </div>
            </div>
            <div className="h-6 w-px bg-white/[0.06]" />
            <div className="flex items-center gap-2">
              <IconTag size={13} className="text-white/20" />
              <div>
                <div className="text-[10px] font-medium uppercase tracking-widest text-white/25">Type</div>
                <div className="text-[12px] text-white/70">{eventTypeLabel}</div>
              </div>
            </div>
            {significanceScore !== null && significanceScore > 0 && (
              <>
                <div className="h-6 w-px bg-white/[0.06]" />
                <div className="flex items-center gap-2">
                  <IconBar size={13} className="text-white/20" />
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-widest text-white/25">Significance</div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold" style={{ color: significanceBarColor }}>{significanceScore}</span>
                      <div className="h-1.5 w-16 rounded-full bg-white/[0.06]">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: significanceBarColor }}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(0, Math.min(significanceScore, 100))}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Key Actors */}
          {actors.length > 0 && (
            <section>
              <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">Key Actors</div>
              <div className="flex flex-wrap gap-2">
                {actors.map((actor, index) => (
                  <span
                    key={`${actor.name}-${index}`}
                    className="rounded-md px-2.5 py-1 text-[11px] font-medium"
                    style={{
                      background: `${getActorColor(actor.type)}15`,
                      color: getActorColor(actor.type),
                      border: `1px solid ${getActorColor(actor.type)}25`,
                    }}
                  >
                    {actor.name}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Related Events */}
          {related.length > 0 && (
            <section>
              <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">Related Events</div>
              <div className="space-y-1.5">
                {related.map((relatedEvent) => {
                  const dotColor = relatedEvent.severity && relatedEvent.severity >= 4
                    ? '#ef4444'
                    : relatedEvent.severity === 3
                      ? '#f97316'
                      : relatedEvent.severity === 2
                        ? '#eab308'
                        : '#6b7280'

                  return (
                    <button
                      key={relatedEvent.id}
                      onClick={() => onSelect?.({ ...event, ...relatedEvent })}
                      className="w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-2 text-[13px]">
                        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: dotColor }} />
                        <span className="text-white/70">{truncate(relatedEvent.title ?? 'Untitled event')}</span>
                        <span className="ml-auto text-[11px] text-white/25">{formatRelativeOccurredTime(relatedEvent.occurred_at)}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        {/* Footer actions */}
        <div
          className="flex gap-2 border-t border-white/[0.06] px-5 py-3"
          style={{ background: 'rgba(12,18,34,0.95)', borderRadius: '0 0 16px 16px' }}
        >
          <button
            onClick={handleCopyLink}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/[0.06] py-2.5 text-[12px] font-medium text-white/50 transition-all hover:bg-white/[0.04] hover:text-white/70"
          >
            <IconCopy size={13} />
            {copied ? 'Copied!' : 'Copy Link'}
          </button>

          {hasOrg ? (
            <a
              href="/alerts"
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/[0.06] py-2.5 text-[12px] font-medium text-white/50 transition-all hover:bg-white/[0.04] hover:text-white/70"
            >
              <IconBell size={13} /> Create Alert
            </a>
          ) : (
            <button
              title="Workspace required"
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/[0.06] py-2.5 text-[12px] font-medium text-white/20 cursor-not-allowed"
            >
              <IconBell size={13} /> Create Alert
            </button>
          )}

          <button
            onClick={handleCopilotOpen}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 py-2.5 text-[12px] font-medium text-blue-400 transition-all hover:bg-blue-500/15"
          >
            <IconBot size={13} /> Intel Co-pilot
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
