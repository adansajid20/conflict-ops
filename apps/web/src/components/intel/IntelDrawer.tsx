'use client'

import { useEffect, useCallback, useRef } from 'react'
import { safeTimeAgo, severityLabel, severityColor, type IntelItem } from '@/types/intel-item'

function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    gdelt: 'GDELT', reliefweb: 'ReliefWeb', gdacs: 'GDACS',
    unhcr: 'UNHCR', nasa_eonet: 'NASA EONET',
  }
  return map[source] ?? source.toUpperCase()
}

interface IntelDrawerProps {
  item: IntelItem | null
  items?: IntelItem[]  // for up/down navigation
  onClose: () => void
  onNavigate?: (item: IntelItem) => void
}

export function IntelDrawer({ item, items = [], onClose, onNavigate }: IntelDrawerProps) {
  const focusRef = useRef<HTMLDivElement>(null)

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

  if (!item) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={focusRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Intel Detail"
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col outline-none"
        style={{
          width: 'min(520px, 95vw)',
          backgroundColor: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-12px 0 40px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-4 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}>
          <div className="flex-1 min-w-0">
            {/* Badges */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs mono font-bold px-2 py-0.5 rounded"
                style={{
                  backgroundColor: item.kind === 'event' ? 'rgba(0,255,136,0.1)' : 'rgba(245,158,11,0.1)',
                  color: item.kind === 'event' ? 'var(--primary)' : 'var(--alert-amber)',
                  border: `1px solid ${item.kind === 'event' ? 'rgba(0,255,136,0.2)' : 'rgba(245,158,11,0.2)'}`,
                  fontSize: 10,
                }}>
                {item.kind === 'event' ? '● EVENT' : '◌ EVIDENCE'}
              </span>
              <span className="text-xs mono font-bold px-2 py-0.5 rounded"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-muted)',
                  fontSize: 10,
                }}>
                {sourceLabel(item.source)}
              </span>
              {item.severity && (
                <span className="text-xs mono font-bold"
                  style={{ color: severityColor(item.severity) }}>
                  SEV {item.severity} · {severityLabel(item.severity)}
                </span>
              )}
            </div>
            {/* Title */}
            <h2 className="text-sm font-bold leading-snug" style={{ color: 'var(--text-primary)', lineHeight: 1.4 }}>
              {item.title}
            </h2>
          </div>

          {/* Close + nav */}
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

        {/* Meta bar */}
        <div className="px-4 py-2 border-b text-xs mono flex items-center gap-3 flex-wrap shrink-0"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', fontSize: 10 }}>
          <span>⏱ {safeTimeAgo(item.occurred_at ?? item.ingested_at)}</span>
          {item.country_code && (
            <span>📍 {item.country_code}{item.region ? ` · ${item.region}` : ''}</span>
          )}
          {item.event_type && (
            <span>◈ {item.event_type.replace(/_/g, ' ').toUpperCase()}</span>
          )}
          {items.length > 1 && (
            <span className="ml-auto">{currentIndex + 1} / {items.length}</span>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Description */}
          <div>
            <div className="text-xs mono mb-2 tracking-widest" style={{ color: 'var(--text-muted)' }}>
              SUMMARY
            </div>
            {item.description ? (
              <p className="text-sm" style={{ color: 'var(--text-primary)', lineHeight: 1.65 }}>
                {item.description}
              </p>
            ) : (
              <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                No description available for this {item.kind}.
              </p>
            )}
          </div>

          {/* Source link */}
          {item.url && (
            <div>
              <div className="text-xs mono mb-2 tracking-widest" style={{ color: 'var(--text-muted)' }}>
                SOURCE
              </div>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs mono break-all hover:underline flex items-start gap-1"
                style={{ color: 'var(--primary)' }}
              >
                <span className="shrink-0 mt-0.5">↗</span>
                <span>{item.url.length > 100 ? item.url.slice(0, 100) + '…' : item.url}</span>
              </a>
            </div>
          )}

          {/* Promote to Event button (for evidence kind) */}
          {item.kind === 'evidence' && (
            <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs mono mb-2 tracking-widest" style={{ color: 'var(--text-muted)' }}>
                ANALYST ACTIONS
              </div>
              <button
                className="px-3 py-1.5 text-xs mono rounded border transition-colors hover:bg-white/5"
                style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}
                onClick={() => {
                  // TODO: implement promote flow
                  alert('Promote to Event — coming in next release')
                }}
              >
                ▲ PROMOTE TO EVENT
              </button>
            </div>
          )}

          {/* Footer metadata */}
          <div className="text-xs mono pt-3 border-t space-y-1"
            style={{ borderColor: 'var(--border)', color: 'var(--text-disabled)', fontSize: 10 }}>
            <div>ID: {item.id}</div>
            <div>Ingested: {safeTimeAgo(item.ingested_at)}</div>
          </div>
        </div>
      </div>
    </>
  )
}
