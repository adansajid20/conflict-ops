'use client'
import React from 'react'

// ============================================================
// SHARED UI PRIMITIVES — CONFLICT OPS DESIGN SYSTEM
// ============================================================

// ---------- Panel ----------
export function Panel({
  children, className = '', style = {},
  header, headerRight, noPad = false,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  header?: React.ReactNode
  headerRight?: React.ReactNode
  noPad?: boolean
}) {
  return (
    <div
      className={`rounded-lg border ${className}`}
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-sm)', ...style }}
    >
      {(header || headerRight) && (
        <div className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--border)' }}>
          {header && <div className="text-xs font-bold tracking-widest uppercase font-mono" style={{ color: 'var(--text-muted)' }}>{header}</div>}
          {headerRight && <div>{headerRight}</div>}
        </div>
      )}
      <div className={noPad ? '' : 'p-4'}>{children}</div>
    </div>
  )
}

// ---------- Badge ----------
type BadgeVariant = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'success' | 'primary'

const BADGE_STYLES: Record<BadgeVariant, React.CSSProperties> = {
  critical: { background: 'rgba(255,68,68,0.15)', color: '#FF4444', border: '1px solid rgba(255,68,68,0.25)' },
  high:     { background: 'rgba(255,136,0,0.15)', color: '#FF8800', border: '1px solid rgba(255,136,0,0.25)' },
  medium:   { background: 'rgba(245,158,11,0.12)', color: '#FFCC00', border: '1px solid rgba(245,158,11,0.2)' },
  low:      { background: 'rgba(59,130,246,0.12)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.2)' },
  info:     { background: 'rgba(125,133,144,0.1)', color: '#7D8590', border: '1px solid rgba(125,133,144,0.15)' },
  success:  { background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' },
  primary:  { background: 'var(--primary-dim)', color: 'var(--primary)', border: '1px solid rgba(0,255,136,0.2)' },
}

export function Badge({ variant = 'info', children, size = 'sm' }: {
  variant?: BadgeVariant
  children: React.ReactNode
  size?: 'xs' | 'sm'
}) {
  return (
    <span
      className="inline-block font-mono font-bold rounded tracking-wide"
      style={{
        ...BADGE_STYLES[variant],
        fontSize: size === 'xs' ? 10 : 11,
        padding: size === 'xs' ? '1px 6px' : '2px 8px',
      }}
    >
      {children}
    </span>
  )
}

// ---------- Skeleton ----------
export function Skeleton({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton rounded ${className}`} style={style} />
}

export function SkeletonLine({ width = '100%' }: { width?: string | number }) {
  return <Skeleton style={{ height: 12, width, marginBottom: 8 }} />
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={i === 0 ? '50%' : i === lines - 1 ? '30%' : '80%'} />
      ))}
    </div>
  )
}

// ---------- EmptyState ----------
export function EmptyState({
  icon = '◈', title, description, action, actionLabel,
}: {
  icon?: string
  title: string
  description?: string
  action?: () => void
  actionLabel?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>{icon}</div>
      <p className="font-bold font-mono text-sm tracking-widest uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
        {title}
      </p>
      {description && (
        <p className="text-xs max-w-xs leading-relaxed mb-6" style={{ color: 'var(--text-disabled)' }}>
          {description}
        </p>
      )}
      {action && actionLabel && (
        <button onClick={action}
          className="px-6 py-2 rounded text-xs font-bold font-mono tracking-wider"
          style={{ backgroundColor: 'var(--primary)', color: '#000' }}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}

// ---------- ErrorState ----------
export function ErrorState({
  message, onRetry, detail,
}: {
  message: string
  onRetry?: () => void
  detail?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div style={{ fontSize: 40, marginBottom: 12, color: '#FF4444' }}>⚠</div>
      <p className="font-bold font-mono text-sm mb-1" style={{ color: '#FF4444' }}>{message}</p>
      {detail && <p className="text-xs mb-4 max-w-sm" style={{ color: 'var(--text-muted)' }}>{detail}</p>}
      {onRetry && (
        <button onClick={onRetry}
          className="mt-2 px-6 py-2 rounded text-xs font-bold font-mono border"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          RETRY
        </button>
      )}
    </div>
  )
}

// ---------- StatCard ----------
export function StatCard({
  label, value, sub, color = 'var(--primary)', icon,
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
  icon?: string
}) {
  return (
    <div className="rounded-lg border p-4 flex flex-col gap-1"
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono tracking-widest" style={{ color: 'var(--text-muted)' }}>{label}</span>
        {icon && <span style={{ color, opacity: 0.7 }}>{icon}</span>}
      </div>
      <div className="text-3xl font-bold font-mono count-up" style={{ color }}>{value}</div>
      {sub && <div className="text-xs font-mono" style={{ color: 'var(--text-disabled)' }}>{sub}</div>}
    </div>
  )
}

// ---------- Btn ----------
export function Btn({
  children, onClick, variant = 'primary', disabled = false, loading = false, size = 'md', className = '',
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  disabled?: boolean
  loading?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary:   { backgroundColor: 'var(--primary)', color: '#000', border: 'none' },
    secondary: { backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' },
    danger:    { backgroundColor: 'rgba(255,68,68,0.1)', color: '#FF4444', border: '1px solid rgba(255,68,68,0.3)' },
    ghost:     { backgroundColor: 'transparent', color: 'var(--text-muted)', border: 'none' },
  }
  const pads: Record<string, string> = { sm: '5px 12px', md: '7px 16px', lg: '10px 24px' }
  const fs: Record<string, number> = { sm: 11, md: 12, lg: 13 }

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`rounded font-mono font-bold tracking-wider transition-opacity ${className}`}
      style={{
        ...styles[variant],
        padding: pads[size],
        fontSize: fs[size],
        opacity: (disabled || loading) ? 0.5 : 1,
        cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
      }}
    >
      {loading ? 'LOADING...' : children}
    </button>
  )
}

// ---------- IngestStaleBanner ----------
export function IngestStaleBanner({ lastIngestAt }: { lastIngestAt: string | null }) {
  if (!lastIngestAt) return null
  const ageMs = Date.now() - new Date(lastIngestAt).getTime()
  if (ageMs < 2 * 3600 * 1000) return null
  const h = Math.floor(ageMs / 3600000)
  return (
    <div className="px-4 py-2 text-xs font-mono flex items-center gap-2 rounded-lg mb-4"
      style={{ backgroundColor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', color: 'var(--alert-amber)' }}>
      ⌛ Data may be stale — last ingest {h}h ago
    </div>
  )
}
