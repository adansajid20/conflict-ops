'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, ExternalLink, Map, Bell, Globe, AlertTriangle,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import type { OverviewEvent } from './types'
import { getPublicSourceName } from '@/lib/utils/source-display'

// Cast all lucide icons to avoid React 18 JSX type mismatch
const IconX          = X as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconExternalLink = ExternalLink as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconMap        = Map as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconBell       = Bell as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconGlobe      = Globe as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconAlert      = AlertTriangle as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconChevUp     = ChevronUp as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconChevDown   = ChevronDown as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>

// ─── configs ─────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  4: { label: 'Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  3: { label: 'High',     color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  2: { label: 'Medium',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  1: { label: 'Low',      color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
} as const

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  confirmed:  { label: 'Confirmed',  color: '#10b981' },
  developing: { label: 'Developing', color: '#f59e0b' },
  disputed:   { label: 'Disputed',   color: '#8b5cf6' },
  corrected:  { label: 'Corrected',  color: '#6b7280' },
  pending:    { label: 'Developing', color: '#f59e0b' },
}

// ─── event type human labels ──────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<string, string> = {
  armed_conflict:      'Armed Conflict',
  airstrike:           'Airstrike',
  terrorism:           'Terrorism',
  coup:                'Coup',
  civil_unrest:        'Civil Unrest',
  protest:             'Protest',
  political_crisis:    'Political Crisis',
  sanctions:           'Sanctions',
  ceasefire:           'Ceasefire',
  diplomacy:           'Diplomacy',
  wmd_threat:          'WMD Threat',
  humanitarian_crisis: 'Humanitarian Crisis',
  natural_disaster:    'Natural Disaster',
  security:            'Security',
  cyber:               'Cyber',
  displacement:        'Displacement',
  humanitarian:        'Humanitarian',
  border_incident:     'Border Incident',
  maritime_incident:   'Maritime Incident',
  aviation_incident:   'Aviation Incident',
  military:            'Military',
  mobilization:        'Mobilization',
  explosion:           'Explosion',
  attack:              'Attack',
  news:                'News',
}

// ─── source display names ─────────────────────────────────────────────────────

export const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  'noaa':       'NOAA National Weather Service',
  'usgs':       'USGS Earthquake Hazards Program',
  'gdacs':      'GDACS (Global Disaster Alert)',
  'unhcr':      'UNHCR (UN Refugee Agency)',
  'nasa_eonet': 'NASA EONET (Natural Events)',
  'reliefweb':  'ReliefWeb (OCHA)',
  'gdelt':      'GDELT Project',
  'acled':      'ACLED Armed Conflict Database',
  'news_rss':   'News Wire',
  'newsapi':    'News Aggregator',
}

// ─── country centroids ────────────────────────────────────────────────────────

const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  'US': [37.09, -95.71], 'RU': [61.52, 105.32], 'UA': [48.37, 31.16],
  'IL': [31.05, 34.85],  'PS': [31.95, 35.23],  'LB': [33.85, 35.86],
  'SY': [34.80, 38.99],  'IQ': [33.22, 43.68],  'IR': [32.43, 53.69],
  'YE': [15.55, 48.52],  'SA': [23.89, 45.08],  'AF': [33.93, 67.71],
  'PK': [30.37, 69.35],  'SD': [12.86, 30.22],  'SS': [6.88, 31.31],
  'ET': [9.14, 40.49],   'SO': [5.15, 46.20],   'NG': [9.08, 8.68],
  'ML': [17.57, -3.99],  'LY': [26.34, 17.23],  'MM': [21.91, 95.96],
  'CN': [35.86, 104.19], 'IN': [20.59, 78.96],  'TR': [38.96, 35.24],
  'DE': [51.16, 10.45],  'FR': [46.23, 2.21],   'GB': [55.38, -3.44],
  'MX': [23.63, -102.55],'BR': [-14.24, -51.93],'JP': [36.20, 138.25],
}

// ─── utilities ───────────────────────────────────────────────────────────────

function getEventCoords(
  event: { location?: unknown; country_code?: string | null }
): { lat: number; lng: number } | null {
  const loc = event.location
  if (loc) {
    if (typeof loc === 'string') {
      const m = (loc as string).match(/POINT\(([-.0-9]+)\s+([-.0-9]+)\)/)
      if (m && m[1] !== undefined && m[2] !== undefined) {
        return { lng: parseFloat(m[1]), lat: parseFloat(m[2]) }
      }
    }
    if (typeof loc === 'object' && loc !== null) {
      const l = loc as { type?: string; coordinates?: number[] }
      if (l.type === 'Point' && Array.isArray(l.coordinates) &&
          l.coordinates[0] !== undefined && l.coordinates[1] !== undefined) {
        return { lng: l.coordinates[0], lat: l.coordinates[1] }
      }
    }
  }
  // Fallback: country centroid
  if (event.country_code) {
    const centroid = COUNTRY_CENTROIDS[event.country_code]
    if (centroid) return { lat: centroid[0], lng: centroid[1] }
  }
  return null
}

function formatEventTime(dateStr: string | null): { local: string; utc: string } {
  if (!dateStr) return { local: 'Unknown', utc: 'Unknown' }
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return { local: 'Unknown', utc: 'Unknown' }

  const utc = d.toLocaleString('en-US', {
    timeZone: 'UTC',
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }) + ' UTC'

  // Local uses browser's timezone
  const local = d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZoneName: 'short',
  })

  return { local, utc }
}

function cleanEventDescription(text: string): string {
  if (!text) return ''

  let cleaned = text

  // Convert ALL CAPS to sentence case (if >50% uppercase)
  const upperRatio = (text.match(/[A-Z]/g)?.length ?? 0) / text.length
  if (upperRatio > 0.5) {
    cleaned = text
      .toLowerCase()
      .replace(/\.\s+([a-z])/g, (_m, c: string) => '. ' + c.toUpperCase())
      .replace(/^([a-z])/, (c: string) => c.toUpperCase())
  }

  // Remove NOAA ellipsis separators
  cleaned = cleaned.replace(/\.\.\./g, ' ').replace(/\s+/g, ' ').trim()

  // Remove technical zone codes
  cleaned = cleaned.replace(/fire weather zones? \d+( and \d+)?/gi, 'affected fire weather zones')
  cleaned = cleaned.replace(/\bzone \d+/gi, 'the affected zone')

  return cleaned
}

function copyToClipboard(text: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    void navigator.clipboard.writeText(text)
  }
}

// ─── component ───────────────────────────────────────────────────────────────

interface EventDetailPanelProps {
  event: OverviewEvent | null
  onClose: () => void
  hasOrg: boolean
}

export function EventDetailPanel({ event, onClose, hasOrg }: EventDetailPanelProps) {
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [fetchedSnippet, setFetchedSnippet] = useState<string | null>(null)
  const [snippetLoading, setSnippetLoading] = useState(false)

  useEffect(() => {
    setSourcesOpen(false)
    setCopied(false)
    setDescExpanded(false)
    setFetchedSnippet(null)
  }, [event?.id])

  // Auto-fetch article preview when description is missing and URL is available
  useEffect(() => {
    if (!event) return
    const hasDesc = !!(event.description ?? '').trim()
    const url = event.provenance_raw?.url as string | undefined
    if (hasDesc || !url) return
    setSnippetLoading(true)
    fetch(`/api/v1/article-preview?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then(d => { if (d.snippet) setFetchedSnippet(d.snippet) })
      .catch(() => {})
      .finally(() => setSnippetLoading(false))
  }, [event?.id])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!event) return null

  const sevKey = (event.severity ?? 1) as 1 | 2 | 3 | 4
  const sev = SEVERITY_CONFIG[sevKey] ?? SEVERITY_CONFIG[1]
  const status = STATUS_CONFIG[event.status ?? 'pending'] ?? STATUS_CONFIG['pending']!

  const sourceKey = event.source ?? ''
  const sourceDisplayName = getPublicSourceName(sourceKey, event.provenance_raw ?? null, event.title ?? null)

  // Coordinates — with country centroid fallback
  const coords = getEventCoords(event)
  const mapHref = coords ? `/tracking?lat=${coords.lat}&lng=${coords.lng}&zoom=5` : null

  // Provenance
  const provenanceUrl = event.provenance_raw?.url
  const provenanceAttr = event.provenance_raw?.attribution

  // Severity label for "why" text
  const severityLabels = ['', 'Low', 'Medium', 'High', 'Critical']
  const severityLabel = severityLabels[event.severity ?? 1] ?? 'High'

  // Event time (client-side, browser timezone)
  const eventTime = formatEventTime(event.occurred_at)
  const detectedTime = formatEventTime(event.ingested_at ?? event.occurred_at)

  // Description — cleaned; fall back to auto-fetched snippet for GDELT/no-desc events
  const rawDesc = event.description ?? fetchedSnippet ?? ''
  const cleanedDesc = cleanEventDescription(rawDesc)
  const DESC_LIMIT = 600
  const descTooLong = cleanedDesc.length > DESC_LIMIT
  const displayedDesc = descTooLong && !descExpanded
    ? cleanedDesc.slice(0, DESC_LIMIT).trim() + '…'
    : cleanedDesc

  function handleShare() {
    copyToClipboard(typeof window !== 'undefined' ? window.location.href : '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <AnimatePresence>
      {/* Backdrop */}
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

      {/* Panel */}
      <motion.div
        key="panel"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 h-full z-50 overflow-y-auto flex flex-col"
        style={{
          width: 'min(420px, 100vw)',
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
          style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ background: sev.bg, color: sev.color }}
            >
              {sev.label}
            </span>
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{ background: 'rgba(255,255,255,0.06)', color: status.color }}
            >
              {status.label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors hover:bg-white/10"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Close"
          >
            <IconX size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 px-5 py-4 space-y-5 overflow-y-auto">

          {/* Intel Header */}
          <div>
            <h2
              className="text-base font-semibold leading-snug mb-2 overflow-hidden"
              style={{
                color: 'var(--text-primary)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              } as React.CSSProperties}
            >
              {event.title ?? 'Untitled Event'}
            </h2>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <span className="flex items-center gap-1">
                <IconGlobe size={11} />
                {event.country_code ? `${event.country_code} / ` : ''}{event.region ?? 'Global'}
              </span>
              {event.event_type && (
                <span className="flex items-center gap-1">
                  <IconAlert size={11} />
                  {EVENT_TYPE_LABELS[event.event_type] ?? event.event_type.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            {coords && (
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
              </p>
            )}
          </div>

          <div className="h-px" style={{ background: 'var(--border)' }} />

          {/* Source */}
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Source
            </div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {sourceDisplayName}
            </div>
            {/* Only show attribution if it's not a pipeline internal (GDELT, NewsAPI etc.) */}
            {provenanceAttr && provenanceAttr.trim() &&
             !provenanceAttr.toLowerCase().includes('gdelt') &&
             !provenanceAttr.toLowerCase().includes('newsapi') &&
             !provenanceAttr.toLowerCase().includes('news_rss') &&
             provenanceAttr.toLowerCase() !== 'unknown' && (
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {provenanceAttr}
              </div>
            )}
          </div>

          {/* Timeline */}
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
              Event Time
            </div>
            <div className="space-y-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Published</div>
                <div
                  className="text-xs"
                  style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}
                >
                  {eventTime.utc}
                </div>
              </div>
              {event.ingested_at && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Detected</div>
                  <div
                    className="text-xs"
                    style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}
                  >
                    {detectedTime.utc}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Details
            </div>
            {cleanedDesc ? (
              <>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {displayedDesc}
                </p>
                {descTooLong && (
                  <button
                    onClick={() => setDescExpanded((v) => !v)}
                    className="mt-1.5 text-xs font-medium"
                    style={{ color: 'var(--primary)' }}
                  >
                    {descExpanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {snippetLoading
                  ? 'Loading preview…'
                  : provenanceUrl
                    ? 'Full article available at the source link below.'
                    : 'No additional details available for this event.'}
              </p>
            )}
          </div>

          {/* Read original — direct link if provenance URL is available */}
          {provenanceUrl && (
            <a
              href={provenanceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium"
              style={{ color: 'var(--primary)' }}
            >
              <IconExternalLink size={13} />
              Read original →
            </a>
          )}

          {/* Sources (formerly Evidence — collapsible) */}
          {(provenanceUrl ?? (provenanceAttr && provenanceAttr.toLowerCase() !== 'unknown')) && (
            <div>
              <button
                onClick={() => setSourcesOpen((v) => !v)}
                className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold w-full"
                style={{ color: 'var(--text-muted)' }}
              >
                Sources
                {sourcesOpen ? <IconChevUp size={12} /> : <IconChevDown size={12} />}
              </button>
              {sourcesOpen && (
                <div className="mt-2 space-y-2">
                  {provenanceUrl && (
                    <a
                      href={provenanceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs underline"
                      style={{ color: 'var(--primary)' }}
                    >
                      <IconExternalLink size={11} />
                      View source article
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Why am I seeing this */}
          <div
            className="rounded-lg p-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}
          >
            <div className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
              Why am I seeing this?
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Reported by{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{sourceDisplayName}</strong>.{' '}
              Severity rated{' '}
              <strong style={{ color: sev.color }}>{severityLabel}</strong>
              {' '}— included in your feed.
            </p>
          </div>
        </div>

        {/* Actions — sticky bottom */}
        <div
          className="sticky bottom-0 px-5 py-4 space-y-2"
          style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}
        >
          {mapHref && (
            <a
              href={mapHref}
              className="flex items-center justify-center gap-2 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
              style={{ background: 'var(--primary)', color: '#fff' }}
            >
              <IconMap size={14} /> View on Map
            </a>
          )}
          <div className="flex gap-2">
            {hasOrg ? (
              <a
                href="/alerts"
                className="flex items-center justify-center gap-1.5 flex-1 rounded-lg px-3 py-2 text-sm transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)' }}
              >
                <IconBell size={13} /> Create Alert
              </a>
            ) : (
              <button
                title="Workspace required — create a workspace to set alerts"
                className="flex items-center justify-center gap-1.5 flex-1 rounded-lg px-3 py-2 text-sm"
                style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'default', opacity: 0.6 }}
              >
                🔒 Create Alert
              </button>
            )}
            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-1.5 flex-1 rounded-lg px-3 py-2 text-sm transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', color: copied ? '#10b981' : 'var(--text-primary)' }}
            >
              <IconExternalLink size={13} />
              {copied ? 'Copied!' : 'Share'}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
