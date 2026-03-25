interface ComingSoonProps {
  feature: string
  description: string
  eta?: string
  icon?: string
  status?: 'beta' | 'planned' | 'setup-required'
  setupNote?: string
}

export function ComingSoon({ feature, description, eta, icon = '⊡', status = 'beta', setupNote }: ComingSoonProps) {
  const statusConfig = {
    beta: { label: 'BETA', color: '#A78BFA', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)' },
    planned: { label: 'PLANNED', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.04)', border: 'var(--border)' },
    'setup-required': { label: 'SETUP REQUIRED', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
  }[status]

  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="max-w-md text-center">
        <div className="text-4xl mb-6 opacity-25">{icon}</div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
          style={{ backgroundColor: statusConfig.bg, border: `1px solid ${statusConfig.border}` }}>
          <span className="text-xs mono font-bold" style={{ color: statusConfig.color }}>
            {statusConfig.label}
          </span>
          {eta && <span className="text-xs mono" style={{ color: 'var(--text-muted)' }}>· {eta}</span>}
        </div>
        <h2 className="text-xl font-bold mono mb-3" style={{ color: 'var(--text-primary)' }}>{feature}</h2>
        <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--text-muted)', lineHeight: 1.65 }}>
          {description}
        </p>
        {setupNote && (
          <div className="text-xs mono p-3 rounded text-left"
            style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#F59E0B', lineHeight: 1.6 }}>
            ⚙ {setupNote}
          </div>
        )}
      </div>
    </div>
  )
}
