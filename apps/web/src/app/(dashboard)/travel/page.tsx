export const dynamic = 'force-dynamic'

import { TravelRiskWidget } from '@/components/travel/TravelRiskWidget'

export default function TravelPage() {
  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mono tracking-wide" style={{ color: 'var(--text-primary)' }}>
            TRAVEL RISK
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            ISO 31030-aligned duty of care assessments. Pre-departure briefs generated from live event data.
          </p>
        </div>
        <TravelRiskWidget />
      </div>
    </div>
  )
}
