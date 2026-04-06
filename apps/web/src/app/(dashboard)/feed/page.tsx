export const revalidate = 0
export const dynamic = 'force-dynamic'

import { EventFeed } from '@/components/feed/EventFeed'

export default function FeedPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/[0.05] bg-white/[0.015] px-4 py-3">
        <h1 className="text-xl font-semibold text-white">
          Intelligence Feed
        </h1>
        <div className="text-[13px] text-white/30">
          Live severity-aware intel stream
        </div>
      </div>
      <div className="min-h-0 flex-1 p-4">
        <EventFeed />
      </div>
    </div>
  )
}
