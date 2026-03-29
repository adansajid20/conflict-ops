'use client'

import { useEffect, useCallback, useRef, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { safeTimeAgo, severityLabel, severityColor, type IntelItem } from '@/types/intel-item'
import { safeAbsoluteTime, getFreshness, safeRelativeTime, type FreshnessLevel } from '@/lib/utils/time'
import { displayLocation, COUNTRY_NAMES } from '@/lib/utils/location'
import { getPublicSourceName } from '@/lib/utils/source-display'

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
  'KR': [35.91, 127.77], 'EG': [26.82, 30.80],
  'AZ': [40.14, 47.58],  'AM': [40.07, 45.04],  'CD': [-4.04, 21.76],
  'KE': [-0.02, 37.91],  'VE': [6.42, -66.59],  'CO': [4.57, -74.29],
}

function getIntelCoords(item: IntelItem): { lat: number; lng: number; isCentroid: boolean } | null {
  const exact = parseCoords(item.location)
  if (exact) return { ...exact, isCentroid: false }
  if (item.country_code && item.country_code.length === 2 && item.country_code !== 'UN') {
    const centroid = COUNTRY_CENTROIDS[item.country_code]
    if (centroid) return { lat: centroid[0], lng: centroid[1], isCentroid: true }
  }
  return null
}

function parseCoords(location: unknown): { lat: number; lng: number } | null {
  if (!location) return null
  if (typeof location === 'string') {
    const wkt = location.includes(';') ? (location.split(';')[1] ?? '') : location
    const m = wkt.match(/POINT\(([-.0-9]+)\s+([-.0-9]+)\)/)
    if (!m) return null
    const lng = parseFloat(m[1] ?? '')
    const lat = parseFloat(m[2] ?? '')
    return isNaN(lng) || isNaN(lat) ? null : { lng, lat }
  }
  if (typeof location === 'object' && location !== null) {
    const loc = location as { type?: string; coordinates?: number[] }
    if (loc.type === 'Point' && Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
      const lng = loc.coordinates[0] ?? NaN
      const lat = loc.coordinates[1] ?? NaN
      return isNaN(lng) || isNaN(lat) ? null : { lng, lat }
    }
  }
  return null
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="text-[10px] mono font-bold tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
    </div>
  )
}

function FreshnessBadge({ freshness }: { freshness: FreshnessLevel }) {
  const config = {
    live: { label: 'LIVE', bg: 'rgba(34,197,94,0.12)', color: '#22C55E', dot: true },
    delayed: { label: 'DELAYED', bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', dot: false },
    stale: { label: 'STALE', bg: 'rgba(239,68,68,0.12)', color: '#EF4444', dot: false },
    unknown: { label: 'UNKNOWN', bg: 'rgba(100,116,139,0.12)', color: '#64748B', dot: false },
  }[freshness]

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold mono"
      style={{ background: config.bg, color: config.color }}>
      {config.dot && <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: config.color }} />}
      {config.label}
    </span>
  )
}

function SeverityBadge({ severity }: { severity: number | null }) {
  if (!severity) return null
  const label = severityLabel(severity)
  const color = severityColor(severity)
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold mono"
      style={{ background: `${color}1A`, color, border: `1px solid ${color}40` }}>
      SEV {severity} · {label}
    </span>
  )
}

function DescriptionBlock({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false)
  const DESC_LIMIT = 300
  const tooLong = description.length > DESC_LIMIT
  // Convert ALL CAPS text to sentence case
  const upperRatio = (description.match(/[A-Z]/g)?.length ?? 0) / Math.max(description.length, 1)
  let cleaned = description
  if (upperRatio > 0.5) {
    cleaned = description
      .toLowerCase()
      .replace(/\.\s+([a-z])/g, (_m: string, c: string) => '. ' + c.toUpperCase())
      .replace(/^([a-z])/, (c: string) => c.toUpperCase())
  }
  const displayed = tooLong && !expanded ? cleaned.slice(0, DESC_LIMIT).trimEnd() + '…' : cleaned

  return (
    <div>
      <SectionHeader label="DESCRIPTION" />
      <p className="text-sm" style={{ color: 'var(--text-primary)', lineHeight: 1.65 }}>
        {displayed}
      </p>
      {tooLong && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-xs mt-2 transition-colors rounded outline-none focus-visible:ring-1 focus-visible:ring-gray-500"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}
        >
          {expanded ? 'Show less ↑' : 'Show more ↓'}
        </button>
      )}
    </div>
  )
}

interface AlertFormState {
  open: boolean
  name: string
  severity: number
  saving: boolean
  result: string | null
}

interface RelatedEvent {
  id: string
  source: string
  title: string
  occurred_at: string | null
}

interface IntelDrawerProps {
  item: IntelItem | null
  items?: IntelItem[]
  onClose: () => void
  onNavigate?: (item: IntelItem) => void
}

export function IntelDrawer({ item, items = [], onClose, onNavigate }: IntelDrawerProps) {
  const focusRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const [alertForm, setAlertForm] = useState<AlertFormState>({
    open: false, name: '', severity: 3, saving: false, result: null,
  })
  const [related, setRelated] = useState<RelatedEvent[]>([])
  const [relatedOpen, setRelatedOpen] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState(false)

  const currentIndex = item ? items.findIndex(i => i.id === item.id) : -1

  const navigatePrev = useCallback(() => {
    if (!onNavigate || currentIndex <= 0) return
    onNavigate(items[currentIndex - 1]!)
  }, [onNavigate, currentIndex, items])

  const navigateNext = useCallback(() => {
    if (!onNavigate || currentIndex < 0 || currentIndex >= items.length - 1) return
    onNavigate(items[currentIndex + 1]!)
  }, [onNavigate, currentIndex, items])

  useEffect(() => {
    if (!item) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); navigatePrev() }
      if (e.key === 'ArrowDown') { e.preventDefault(); navigateNext() }
    }
    window.addEventListener('keydown', handler)
    focusRef.current?.focus()
    return () => window.removeEventListener('keydown', handler)
  }, [item, onClose, navigatePrev, navigateNext])

  // Fetch related events when item changes
  useEffect(() => {
    if (!item) { setRelated([]); return }
    setRelated([])
    setRelatedOpen(false)
    const words = item.title.split(' ').slice(0, 4).join(' ')
    if (!words) return
    fetch(`/api/v1/events?search=${encodeURIComponent(words)}&window=7d&limit=5`)
      .then(r => r.json())
      .then((j: { data?: RelatedEvent[] }) =>
        setRelated((j.data ?? []).filter(e => e.id !== item.id).slice(0, 3))
      )
      .catch(() => setRelated([]))
  }, [item?.id])

  if (!item) return null

  const coordInfo = getIntelCoords(item)
  const coords = coordInfo
  const sourceLabel = item.provenance_source ?? getPublicSourceName(item.source, null, item.title ?? null)
  const freshness = getFreshness(item.ingested_at)

  const handleViewOnMap = () => {
    if (!coordInfo) return
    router.push(`/tracking?lat=${coordInfo.lat}&lng=${coordInfo.lng}&eventId=${item.id}`)
  }

  const handleCopyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?eventId=${item.id}`
    try {
      await navigator.clipboard.writeText(url)
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 2000)
    } catch {
      // Fallback
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 2000)
    }
  }

  const handleCreateAlert = async () => {
    setAlertForm(f => ({ ...f, saving: true, result: null }))
    try {
      const res = await fetch('/api/v1/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: alertForm.name, severity: alertForm.severity, description: item.description }),
      })
      if (res.status === 403) {
        setAlertForm(f => ({ ...f, saving: false, result: 'Requires workspace' }))
        return
      }
      if (!res.ok) throw new Error('Failed')
      setAlertForm(f => ({ ...f, saving: false, result: 'Alert created ✓', open: false }))
    } catch {
      setAlertForm(f => ({ ...f, saving: false, result: 'Error creating alert' }))
    }
  }

  // Location display — show Unknown if both null after geo cleanup, never show "UN"
  const locationDisplay = displayLocation(item.country_code, item.region)

  // Detect mobile
  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < 768
  }, [])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — desktop: right sidebar | mobile: bottom sheet */}
      <div
        ref={focusRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Intel Case File"
        className={isMobile
          ? "fixed inset-x-0 bottom-0 z-50 flex flex-col outline-none rounded-t-xl transition-transform duration-300"
          : "fixed right-0 top-0 bottom-0 z-50 flex flex-col outline-none"
        }
        style={isMobile ? {
          maxHeight: '85vh',
          backgroundColor: 'var(--bg-surface)',
          borderTop: '1px solid var(--border)',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.5)',
          overflowY: 'auto',
        } : {
          width: 'min(560px, 95vw)',
          backgroundColor: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-12px 0 40px rgba(0,0,0,0.5)',
        }}
      >
        {/* Mobile drag handle */}
        {isMobile && (
          <div className="flex justify-center pt-3 pb-2 shrink-0">
            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
          </div>
        )}
        {/* Header */}
        <div className="flex items-start gap-3 p-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <SeverityBadge severity={item.severity} />
              {item.event_type && (
                <span className="text-[10px] mono font-medium px-2 py-0.5 rounded"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {(EVENT_TYPE_LABELS[item.event_type] ?? item.event_type.replace(/_/g, ' ')).toUpperCase()}
                </span>
              )}
            </div>
            <h2 className="text-sm font-bold leading-snug" style={{ color: 'var(--text-primary)', lineHeight: 1.4 }}>
              {item.title}
            </h2>
          </div>
          <div className="flex flex-col items-center gap-1 shrink-0">
            <button onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
              style={{ color: 'var(--text-muted)' }}
              title="Close (Esc)">✕</button>
            {items.length > 1 && (
              <>
                <button onClick={navigatePrev} disabled={currentIndex <= 0}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 transition-colors disabled:opacity-30"
                  style={{ color: 'var(--text-muted)' }} title="Previous (↑)">▲</button>
                <button onClick={navigateNext} disabled={currentIndex >= items.length - 1}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 transition-colors disabled:opacity-30"
                  style={{ color: 'var(--text-muted)' }} title="Next (↓)">▼</button>
              </>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* INTEL HEADER */}
          <div>
            <SectionHeader label="INTEL HEADER" />
            <div className="space-y-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <div className="grid grid-cols-[100px_1fr] gap-1">
                <span style={{ color: 'var(--text-muted)' }}>Location</span>
                <span style={{ color: 'var(--text-primary)' }}>{locationDisplay}</span>
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-1">
                <span style={{ color: 'var(--text-muted)' }}>Coordinates</span>
                <span className="mono" style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {coordInfo && !coordInfo.isCentroid
                    ? `${coordInfo.lat.toFixed(4)}, ${coordInfo.lng.toFixed(4)}`
                    : coordInfo?.isCentroid
                      ? `~${coordInfo.lat.toFixed(2)}, ${coordInfo.lng.toFixed(2)} (approx.)`
                      : '—'}
                </span>
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-1">
                <span style={{ color: 'var(--text-muted)' }}>Category</span>
                <span style={{ color: 'var(--text-primary)' }}>
                  {item.event_type ? item.event_type.replace(/_/g, ' ') : '—'}
                </span>
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-1">
                <span style={{ color: 'var(--text-muted)' }}>Severity</span>
                <SeverityBadge severity={item.severity} />
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-1">
                <span style={{ color: 'var(--text-muted)' }}>Source</span>
                <span style={{ color: 'var(--text-primary)' }}>{sourceLabel}</span>
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-1 items-center">
                <span style={{ color: 'var(--text-muted)' }}>Corroboration</span>
                {(item._source_count ?? 1) > 1 ? (
                  <span style={{
                    color: item._confidence === 'confirmed' ? '#22c55e' : '#eab308',
                    fontWeight: 600,
                    fontSize: '12px',
                  }}>
                    {item._source_count} independent source{(item._source_count ?? 1) !== 1 ? 's' : ''}
                    {item._confidence === 'confirmed' ? ' — CONFIRMED' : ' — CORROBORATED'}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    Single source — treat as unverified
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* TIMELINE */}
          <div>
            <SectionHeader label="TIMELINE" />
            <div className="space-y-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <div className="grid grid-cols-[100px_1fr] gap-1">
                <span style={{ color: 'var(--text-muted)' }}>First Seen</span>
                <span className="mono" style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {safeAbsoluteTime(item.occurred_at)}
                </span>
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-1">
                <span style={{ color: 'var(--text-muted)' }}>Age</span>
                <span className="mono" style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {safeRelativeTime(item.occurred_at)}
                </span>
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-1">
                <span style={{ color: 'var(--text-muted)' }}>Ingested</span>
                <span className="mono" style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {safeTimeAgo(item.ingested_at)}
                </span>
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-1 items-center">
                <span style={{ color: 'var(--text-muted)' }}>Freshness</span>
                <FreshnessBadge freshness={freshness} />
              </div>
            </div>
          </div>

          {/* DESCRIPTION */}
          <DescriptionBlock description={item.description ?? item.title} />

          {/* SOURCES */}
          {item.url && (
            <div>
              <SectionHeader label="SOURCES" />
              <div className="flex items-center justify-between rounded-lg px-3 py-2"
                style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {sourceLabel}
                </span>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium hover:underline flex items-center gap-1"
                  style={{ color: 'var(--primary)' }}
                >
                  Read full article <span>↗</span>
                </a>
              </div>
            </div>
          )}

          {/* ACTIONS */}
          <div>
            <SectionHeader label="ACTIONS" />
            <div className="grid grid-cols-2 gap-2">
              {/* View on Map — hide entirely when no coords and no centroid */}
              {coordInfo && (
                <button
                  onClick={handleViewOnMap}
                  title={coordInfo.isCentroid ? 'View approximate location on map' : 'View on map'}
                  className="px-3 py-2 rounded-lg text-xs font-medium border transition-colors"
                  style={{
                    background: 'rgba(37,99,235,0.1)',
                    borderColor: 'rgba(37,99,235,0.4)',
                    color: '#60A5FA',
                    cursor: 'pointer',
                  }}
                >
                  🗺 View on Map{coordInfo.isCentroid ? ' (approx.)' : ''}
                </button>
              )}

              {/* Copy Link */}
              <button
                onClick={() => void handleCopyLink()}
                className="px-3 py-2 rounded-lg text-xs font-medium border transition-colors"
                style={{
                  background: copyFeedback ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)',
                  borderColor: copyFeedback ? 'rgba(34,197,94,0.4)' : 'var(--border)',
                  color: copyFeedback ? '#22C55E' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {copyFeedback ? '✓ Copied!' : '🔗 Copy Link'}
              </button>

              {/* Create Alert */}
              <button
                onClick={() => {
                  setAlertForm(f => ({
                    ...f,
                    open: !f.open,
                    name: item.title,
                    severity: item.severity ?? 3,
                    result: null,
                  }))
                }}
                className="px-3 py-2 rounded-lg text-xs font-medium border transition-colors col-span-2"
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  borderColor: 'rgba(239,68,68,0.3)',
                  color: '#F87171',
                  cursor: 'pointer',
                }}
              >
                ★ Create Alert
              </button>
            </div>

            {/* Inline alert form */}
            {alertForm.open && (
              <div className="mt-3 rounded-lg border p-3 space-y-2"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)' }}>
                <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>New Alert</div>
                <input
                  value={alertForm.name}
                  onChange={e => setAlertForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Alert name"
                  className="w-full rounded px-3 py-1.5 text-xs"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
                <select
                  value={alertForm.severity}
                  onChange={e => setAlertForm(f => ({ ...f, severity: parseInt(e.target.value) }))}
                  className="w-full rounded px-3 py-1.5 text-xs"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                >
                  <option value={1}>1 — Low</option>
                  <option value={2}>2 — Medium</option>
                  <option value={3}>3 — High</option>
                  <option value={4}>4 — Critical</option>
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={() => void handleCreateAlert()}
                    disabled={alertForm.saving || !alertForm.name}
                    className="flex-1 rounded px-3 py-1.5 text-xs font-medium"
                    style={{ background: 'var(--primary)', color: '#fff', opacity: alertForm.saving ? 0.6 : 1 }}
                  >
                    {alertForm.saving ? 'Saving…' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setAlertForm(f => ({ ...f, open: false }))}
                    className="rounded px-3 py-1.5 text-xs"
                    style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                  >
                    Cancel
                  </button>
                </div>
                {alertForm.result && (
                  <div className="text-xs" style={{
                    color: alertForm.result.includes('✓') ? '#22C55E' : '#F87171',
                  }}>
                    {alertForm.result}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RELATED INTEL */}
          {related.length > 0 && (
            <div>
              <SectionHeader label="RELATED INTEL" />
              <button
                onClick={() => setRelatedOpen(o => !o)}
                className="flex items-center gap-2 text-xs mb-2 hover:opacity-80"
                style={{ color: 'var(--text-secondary)' }}
              >
                <span>{relatedOpen ? '▼' : '▶'}</span>
                <span>{related.length} related item{related.length !== 1 ? 's' : ''}</span>
              </button>
              {relatedOpen && (
                <div className="space-y-2">
                  {related.map(r => (
                    <div key={r.id} className="flex items-start gap-2 text-xs p-2 rounded-lg"
                      style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
                      <span className="shrink-0 text-[10px] mono px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                        {r.source.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{r.title}</span>
                      <span className="shrink-0 mono" style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {safeTimeAgo(r.occurred_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer metadata — navigation hints only, no raw IDs */}
          {items.length > 1 && (
            <div className="text-[10px] mono pt-3 border-t"
              style={{ borderColor: 'var(--border)', color: 'var(--text-disabled)', fontFamily: 'JetBrains Mono, monospace' }}>
              {currentIndex + 1} / {items.length} · ↑↓ navigate · Esc close
            </div>
          )}
        </div>
      </div>
    </>
  )
}
