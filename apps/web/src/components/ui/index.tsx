'use client'
import React from 'react'

// ============================================================
// SHARED UI PRIMITIVES — CONFLICTRADAR DESIGN SYSTEM
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
      className={`rounded-xl border border-white/[0.05] bg-white/[0.015] ${className}`}
      style={style}
    >
      {(header || headerRight) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
          {header && <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/25">{header}</div>}
          {headerRight && <div>{headerRight}</div>}
        </div>
      )}
      <div className={noPad ? '' : 'p-4'}>{children}</div>
    </div>
  )
}

// ---------- Badge ----------
type BadgeVariant = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'success' | 'primary'

const BADGE_STYLES: Record<BadgeVariant, string> = {
  critical: 'bg-red-500/10 text-red-400 border border-red-500/15',
  high:     'bg-orange-500/10 text-orange-400 border border-orange-500/15',
  medium:   'bg-amber-500/10 text-amber-400 border border-amber-500/15',
  low:      'bg-blue-500/10 text-blue-400 border border-blue-500/15',
  info:     'bg-slate-500/10 text-slate-400 border border-slate-500/15',
  success:  'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15',
  primary:  'bg-green-500/10 text-green-400 border border-green-500/15',
}

export function Badge({ variant = 'info', children, size = 'sm' }: {
  variant?: BadgeVariant
  children: React.ReactNode
  size?: 'xs' | 'sm'
}) {
  const sizeClasses = size === 'xs' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'

  return (
    <span className={`inline-block font-bold rounded-md ${sizeClasses} ${BADGE_STYLES[variant]}`}>
      {children}
    </span>
  )
}

// ---------- Skeleton ----------
export function Skeleton({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`bg-white/[0.04] animate-pulse rounded-lg ${className}`} style={style} />
}

export function SkeletonLine({ width = '100%' }: { width?: string | number }) {
  return <Skeleton style={{ height: 12, width, marginBottom: 8 }} />
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.015]">
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
      <div className="text-[48px] mb-4 text-white/15">{icon}</div>
      <p className="text-[15px] font-medium text-white/60 mb-2">
        {title}
      </p>
      {description && (
        <p className="text-[13px] text-white/30 max-w-xs leading-relaxed mb-6">
          {description}
        </p>
      )}
      {action && actionLabel && (
        <button onClick={action}
          className="px-6 py-2 rounded-lg text-[12px] font-bold text-white bg-blue-500 hover:bg-blue-400 transition-colors">
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
      <div className="text-[40px] mb-3 text-red-400">⚠</div>
      <p className="text-[15px] font-medium text-red-400 mb-1">{message}</p>
      {detail && <p className="text-[13px] text-white/30 mb-4 max-w-sm">{detail}</p>}
      {onRetry && (
        <button onClick={onRetry}
          className="mt-2 px-6 py-2 rounded-lg text-[12px] font-bold bg-white/[0.06] hover:bg-white/[0.1] text-white/60 border border-white/[0.06] transition-colors">
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
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-4 flex flex-col gap-1 hover:bg-white/[0.03] hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.15em] text-white/20">{label}</span>
        {icon && <span style={{ color, opacity: 0.7 }}>{icon}</span>}
      </div>
      <div className="text-xl font-bold text-white" style={{ color: color !== 'var(--primary)' ? color : undefined }}>{value}</div>
      {sub && <div className="text-[11px] text-white/25">{sub}</div>}
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
  const variantClasses: Record<string, string> = {
    primary:   'bg-blue-500 hover:bg-blue-400 text-white',
    secondary: 'bg-white/[0.05] hover:bg-white/[0.08] text-white/60 border border-white/[0.06]',
    danger:    'bg-red-500/10 hover:bg-red-500/15 text-red-400',
    ghost:     'hover:bg-white/[0.04] text-white/40',
  }

  const sizeClasses: Record<string, string> = {
    sm: 'text-[12px] px-3 py-1.5',
    md: 'text-[13px] px-4 py-2',
    lg: 'text-[14px] px-5 py-2.5',
  }

  const disabledClasses = (disabled || loading) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`rounded-lg font-bold transition-all ${variantClasses[variant]} ${sizeClasses[size]} ${disabledClasses} ${className}`}
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
    <div className="px-4 py-2 text-[13px] flex items-center gap-2 rounded-xl mb-4 bg-amber-500/[0.04] border border-amber-500/15 text-amber-400">
      ⌛ Data may be stale — last ingest {h}h ago
    </div>
  )
}
