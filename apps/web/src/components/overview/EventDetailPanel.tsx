'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, ExternalLink, Map, Bell, Globe, AlertTriangle,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { safeRelativeTime, safeAbsoluteTime } from '@/lib/utils/time'
import type { OverviewEvent } from './types'

// Cast all lucide icons to avoid React 18 JSX type mismatch
const IconX          = X as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconExternalLink = ExternalLink as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconMap        = Map as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconBell       = Bell as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconGlobe      = Globe as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconAlert      = AlertTriangle as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconChevUp     = ChevronUp as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconChevDown   = ChevronDown as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>

// Silence unused import lint — safeRelativeTime imported but only safeAbsoluteTime used below
void safeRelativeTime

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

const SOURCE_RELIABILITY: Record<string, { label: string; score: string }> = {
  gdelt:      { label: 'GDELT',      score: 'B — Automated news aggregation' },
  gdacs:      { label: 'GDACS / UN', score: 'A — UN-affiliated disaster tracking' },
  reliefweb:  { label: 'ReliefWeb',  score: 'A — UN OCHA humanitarian reporting' },
  unhcr:      { label: 'UNHCR',      score: 'A — UN refugee agency' },
  nasa_eonet: { label: 'NASA EONET', score: 'A — NASA Earth Observatory' },
}

// ─── utilities ───────────────────────────────────────────────────────────────

function parseCoords(location: unknown): { lat: number; lng: number } | null {
  if (!location) return null
  if (typeof location === 'string') {
    const m = location.match(/POINT\(([-.0-9]+)\s+([-.0-9]+)\)/)
    if (!m || m[1] === undefined || m[2] === undefined) return null
    return { lng: parseFloat(m[1]), lat: parseFloat(m[2]) }
  }
  if (typeof location === 'object' && location !== null) {
    const loc = location as { type?: string; coordinates?: number[] }
    if (loc.type === 'Point' && Array.isArray(loc.coordinates) &&
        loc.coordinates[0] !== undefined && loc.coordinates[1] !== undefined) {
      return { lng: loc.coordinates[0], lat: loc.coordinates[1] }
    }
  }
  return null
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
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setEvidenceOpen(false)
    setCopied(false)
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
  const source = SOURCE_RELIABILITY[event.source ?? ''] ?? { label: event.source ?? 'Unknown', score: 'Unknown' }
  const coords = parseCoords(event.location)
  const mapHref = coords ? `/tracking?lat=${coords.lat}&lng=${coords.lng}` : null
  const provenanceUrl = event.provenance_raw?.url
  const provenanceAttr = event.provenance_raw?.attribution

  const hoursAgo = event.occurred_at
    ? Math.floor((Date.now() - new Date(event.occurred_at).getTime()) / 3600000)
    : null

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
          width: 'min(400px, 100vw)',
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
        <div className="flex-1 px-5 py-4 space-y-5">

          {/* Intel Header */}
          <div>
            <h2 className="text-base font-semibold leading-snug mb-2" style={{ color: 'var(--text-primary)' }}>
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
                  {event.event_type}
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
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{source.label}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{source.score}</div>
          </div>

          {/* Timeline */}
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
              Timeline
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>First seen</span>
                <span style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {safeAbsoluteTime(event.occurred_at)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>Ingested</span>
                <span style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {safeAbsoluteTime(event.ingested_at)}
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Details
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {event.description ?? 'No additional details available for this event.'}
            </p>
          </div>

          {/* Evidence (collapsible) */}
          {(provenanceUrl ?? provenanceAttr) && (
            <div>
              <button
                onClick={() => setEvidenceOpen((v) => !v)}
                className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold w-full"
                style={{ color: 'var(--text-muted)' }}
              >
                Evidence
                {evidenceOpen ? <IconChevUp size={12} /> : <IconChevDown size={12} />}
              </button>
              {evidenceOpen && (
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
                  {provenanceAttr && (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{provenanceAttr}</p>
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
              Detected from{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{source.label}</strong>{' '}
              {hoursAgo !== null ? `within the last ${hoursAgo < 1 ? '1' : hoursAgo}h` : 'recently'}.{' '}
              Included based on severity level{' '}
              <strong style={{ color: sev.color }}>{sev.label}</strong>.
            </p>
          </div>
        </div>

        {/* Actions — sticky bottom */}
        <div
          className="sticky bottom-0 px-5 py-4 space-y-2"
          style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}
        >
          {mapHref ? (
            <a
              href={mapHref}
              className="flex items-center justify-center gap-2 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
              style={{ background: 'var(--primary)', color: '#fff' }}
            >
              <IconMap size={14} /> View on Map
            </a>
          ) : (
            <button
              disabled
              className="flex items-center justify-center gap-2 w-full rounded-lg px-4 py-2.5 text-sm font-medium cursor-not-allowed"
              style={{ background: 'var(--border)', color: 'var(--text-muted)' }}
            >
              <IconMap size={14} /> View on Map
              <span className="ml-auto text-xs">(No coordinates)</span>
            </button>
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
                disabled
                className="flex items-center justify-center gap-1.5 flex-1 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
                style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' }}
                title="Workspace required"
              >
                <IconBell size={13} /> Create Alert
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
