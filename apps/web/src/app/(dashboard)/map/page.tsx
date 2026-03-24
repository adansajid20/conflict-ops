import dynamic from 'next/dynamic'

// MapLibre MUST be dynamic — never SSR (execution rule #14)
const ConflictMap = dynamic(
  () => import('@/components/map/ConflictMap').then(m => m.ConflictMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-base)' }}
      >
        <div className="text-xs mono loading-text" style={{ color: 'var(--text-muted)' }}>
          LOADING MAP
        </div>
      </div>
    ),
  }
)

export default function MapPage() {
  return (
    <div className="h-full flex flex-col">
      <div
        className="px-4 py-3 border-b flex items-center justify-between shrink-0"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
      >
        <h1 className="text-sm font-bold tracking-widest uppercase mono" style={{ color: 'var(--text-primary)' }}>
          SITUATION MAP
        </h1>
        <div className="flex items-center gap-4 text-xs mono" style={{ color: 'var(--text-muted)' }}>
          <span>● <span style={{ color: '#10B981' }}>LOW</span></span>
          <span>● <span style={{ color: '#F59E0B' }}>ELEVATED</span></span>
          <span>● <span style={{ color: '#EF4444' }}>HIGH</span></span>
          <span>● <span style={{ color: '#FF0000' }}>CRITICAL</span></span>
        </div>
      </div>
      <div className="flex-1 relative">
        <ConflictMap />
      </div>
    </div>
  )
}
