type UsageItem = { label: string; used: number; limit: number }

function pct(used: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

export function UsageMeter({ items }: { items: UsageItem[] }) {
  return (
    <div className="space-y-4">
      {items.map((item) => {
        const percentage = pct(item.used, item.limit)
        const warning = percentage >= 80
        return (
          <div key={item.label} className="p-4 rounded border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
            <div className="flex items-center justify-between text-xs mono mb-2">
              <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
              <span style={{ color: warning ? 'var(--alert-amber)' : 'var(--text-primary)' }}>{item.used} / {item.limit === -1 ? '∞' : item.limit}</span>
            </div>
            <div className="h-2 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
              <div className="h-2 rounded" style={{ width: `${item.limit === -1 ? 0 : percentage}%`, backgroundColor: warning ? 'var(--alert-amber)' : 'var(--primary)' }} />
            </div>
            {warning ? <div className="mt-2 text-xs mono" style={{ color: 'var(--alert-amber)' }}>Overage warning: {percentage}% consumed.</div> : null}
          </div>
        )
      })}
    </div>
  )
}
