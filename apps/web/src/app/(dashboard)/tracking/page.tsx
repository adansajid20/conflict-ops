export const dynamic = 'force-dynamic'

import { TrackingPanel } from '@/components/tracking/TrackingPanel'

export default function TrackingPage() {
  return (
    <div className="p-6 h-full">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mono tracking-wide" style={{ color: 'var(--text-primary)' }}>
            MARITIME / AIR PICTURE
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Live vessel tracking (AISStream.io), military flight tracking (OpenSky), and NASA FIRMS thermal anomalies.
          </p>
        </div>
        <div className="rounded border" style={{ borderColor: 'var(--border)', height: '70vh' }}>
          <TrackingPanel />
        </div>
      </div>
    </div>
  )
}
