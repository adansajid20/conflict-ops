'use client'

interface Props {
  tracked: number
  critical: number
  high: number
  medium: number
  low: number
  isLive?: boolean
}

export function MapStatsBar({ tracked, critical, high, medium, low, isLive = true }: Props) {
  const base: React.CSSProperties = {
    background: 'rgba(8,13,25,0.92)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    backdropFilter: 'blur(14px)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  }

  return (
    <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 30, display: 'flex', alignItems: 'stretch', gap: 6 }}>

      {/* Total tracked */}
      <div style={{ ...base, padding: '8px 16px', minWidth: 80 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.12em', color: '#4b5563', textTransform: 'uppercase' }}>Tracked</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#f9fafb', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
          {tracked.toLocaleString()}
        </div>
      </div>

      {/* Severity breakdown */}
      <div style={{ ...base, flexDirection: 'row', alignItems: 'stretch', overflow: 'hidden' }}>
        {[
          { label: 'CRIT', value: critical, color: '#ef4444' },
          { label: 'HIGH', value: high, color: '#f97316' },
          { label: 'MED', value: medium, color: '#eab308' },
          { label: 'LOW', value: low, color: '#22c55e' },
        ].map((s, i) => (
          <div key={s.label} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '8px 12px', minWidth: 52,
            borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: s.color }}>{s.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f9fafb', fontVariantNumeric: 'tabular-nums' }}>
              {s.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Live indicator */}
      <div style={{ ...base, padding: '8px 12px', flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: isLive ? '#22c55e' : '#ef4444',
          boxShadow: isLive ? '0 0 8px #22c55e' : '0 0 8px #ef4444',
          animation: 'pulse 2s infinite',
        }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: isLive ? '#22c55e' : '#ef4444' }}>
          {isLive ? 'LIVE' : 'OFF'}
        </span>
      </div>
    </div>
  )
}
