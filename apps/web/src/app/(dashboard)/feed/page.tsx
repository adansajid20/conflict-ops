export const revalidate = 0

export const dynamic = 'force-dynamic'

import { EventFeed } from '@/components/feed/EventFeed'
import { DisinfoShield } from '@/components/intel/DisinfoShield'

export default function FeedPage() {
  return (
    <div className="h-full flex flex-col">
      <div
        className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
      >
        <h1 className="text-sm font-bold tracking-widest uppercase mono" style={{ color: 'var(--text-primary)' }}>
          INTELLIGENCE FEED
        </h1>
        <div className="text-xs mono" style={{ color: 'var(--text-muted)' }}>
          AUTO-REFRESHES EVERY 60S
        </div>
      </div>
      <div className="flex-1 overflow-hidden grid lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="overflow-hidden">
          <EventFeed />
        </div>
        <div className="border-l p-4 overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
          <div className="text-xs uppercase tracking-[0.16em] mb-3" style={{ color: 'var(--text-muted)' }}>Disinfo</div>
          <DisinfoShield />
        </div>
      </div>
    </div>
  )
}
