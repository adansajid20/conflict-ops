export const revalidate = 0
export const dynamic = 'force-dynamic'

import { EventFeed } from '@/components/feed/EventFeed'

export default function FeedPage() {
  return (
    <div className="flex h-full flex-col bg-[#070B11]">
      <div className="flex items-center justify-between border-b border-white/[0.05] bg-white/[0.015] px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Intelligence Feed
          </h1>
          <p className="text-[12px] text-white/40 mt-1">
            Real-time geopolitical intelligence stream with severity tracking
          </p>
        </div>
      </div>
      <div className="min-h-0 flex-1 p-4">
        <EventFeed />
      </div>
    </div>
  )
}
