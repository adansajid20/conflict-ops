import { EventFeed } from '@/components/feed/EventFeed'

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
      <div className="flex-1 overflow-hidden">
        <EventFeed />
      </div>
    </div>
  )
}
