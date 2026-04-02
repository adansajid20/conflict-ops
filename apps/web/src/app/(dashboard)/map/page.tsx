export const dynamic = 'force-dynamic'
import nextDynamic from 'next/dynamic'

const ConflictMap = nextDynamic(
  () => import('@/components/map/ConflictMap').then(m => m.ConflictMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: 'var(--bg-base)' }}>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>LOADING GLOBE</div>
      </div>
    ),
  }
)

export default function MapPage() {
  return (
    <div className="relative w-full h-full overflow-hidden">
      <ConflictMap />
    </div>
  )
}
