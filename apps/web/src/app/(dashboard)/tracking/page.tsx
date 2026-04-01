export const dynamic = 'force-dynamic'

import { ChokepointDashboard } from '@/components/tracking/ChokepointDashboard'
import { TrackingPanel } from '@/components/tracking/TrackingPanel'

const TABS = ['map', 'chokepoints'] as const

type Tab = (typeof TABS)[number]

export default function TrackingPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const activeTab: Tab = searchParams?.tab === 'chokepoints' ? 'chokepoints' : 'map'

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold tracking-widest uppercase mono" style={{ color: 'var(--text-primary)' }}>Operational Map</h1>
          <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(139,92,246,0.15)', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.2)' }}>β</span>
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Real-time conflict intelligence overlay</p>
        <div className="mt-3 flex gap-2">
          <a href="/tracking" className="rounded px-3 py-1.5 text-xs font-medium" style={{ background: activeTab === 'map' ? 'var(--primary)' : 'transparent', color: activeTab === 'map' ? '#fff' : 'var(--text-muted)', border: '1px solid var(--border)' }}>Map</a>
          <a href="/tracking?tab=chokepoints" className="rounded px-3 py-1.5 text-xs font-medium" style={{ background: activeTab === 'chokepoints' ? 'var(--primary)' : 'transparent', color: activeTab === 'chokepoints' ? '#fff' : 'var(--text-muted)', border: '1px solid var(--border)' }}>Chokepoints</a>
        </div>
      </div>
      <div className="flex-1 overflow-hidden p-0">
        {activeTab === 'map' ? <TrackingPanel /> : <div className="h-full overflow-y-auto p-6"><ChokepointDashboard /></div>}
      </div>
    </div>
  )
}
