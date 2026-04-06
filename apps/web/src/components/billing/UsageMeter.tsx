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
          <div key={item.label} className="p-4 rounded border bg-white/[0.015] border-white/[0.05]">
            <div className="flex items-center justify-between text-xs mono mb-2">
              <span className="text-white/30">{item.label}</span>
              <span className={warning ? 'text-amber-400' : 'text-white'}>{item.used} / {item.limit === -1 ? '∞' : item.limit}</span>
            </div>
            <div className="h-2 rounded bg-white/[0.08]">
              <div className="h-2 rounded" style={{ width: `${item.limit === -1 ? 0 : percentage}%`, backgroundColor: warning ? '#FBBF24' : '#3B82F6' }} />
            </div>
            {warning ? <div className="mt-2 text-xs mono text-amber-400">Overage warning: {percentage}% consumed.</div> : null}
          </div>
        )
      })}
    </div>
  )
}
