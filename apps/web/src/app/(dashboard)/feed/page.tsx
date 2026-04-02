export const revalidate = 0
export const dynamic = 'force-dynamic'

import { EventFeed } from '@/components/feed/EventFeed'

export default function FeedPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        <h1 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>
          Intelligence Feed
        </h1>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Live severity-aware intel stream
        </div>
      </div>
      <div className="min-h-0 flex-1 p-4">
        <EventFeed />
      </div>
    </div>
  )
}
