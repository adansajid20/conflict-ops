export const revalidate = 0
export const dynamic = 'force-dynamic'

import { TrendsClient } from '@/components/trends/TrendsClient'

export default function TrendsPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/[0.05] bg-white/[0.015] px-4 py-3">
        <h1 className="text-xl font-semibold text-white">
          Intelligence Trends
        </h1>
        <div className="text-[13px] text-white/30">
          Advanced analytics &amp; threat intelligence
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <TrendsClient />
      </div>
    </div>
  )
}
