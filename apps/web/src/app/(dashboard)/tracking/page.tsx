export const dynamic = 'force-dynamic'
import { TrackingPanel } from '@/components/tracking/TrackingPanel'

export default function TrackingPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold tracking-widest uppercase mono" style={{ color: 'var(--text-primary)' }}>
            MARITIME / AIR PICTURE
          </h1>
          <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(139,92,246,0.15)', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.2)' }}>β</span>
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Live vessel tracking (AISStream.io), military flight tracking (OpenSky), NASA FIRMS thermal anomalies.
        </p>
      </div>
      <div className="flex-1">
        <TrackingPanel />
      </div>
    </div>
  )
}
