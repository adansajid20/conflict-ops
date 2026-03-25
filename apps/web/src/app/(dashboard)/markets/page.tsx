export const dynamic = 'force-dynamic'

import { MarketsPanel } from '@/components/markets/MarketsPanel'

export default function MarketsPage() {
  return (
    <div className="p-6 h-full">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mono tracking-wide" style={{ color: 'var(--text-primary)' }}>
            PREDICTION MARKETS
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Real-money and crowd-sourced probability estimates for geopolitical events.
            Calibrated forecasts from Metaculus and Polymarket.
          </p>
        </div>
        <div className="rounded border" style={{ borderColor: 'var(--border)', height: '70vh' }}>
          <MarketsPanel />
        </div>
      </div>
    </div>
  )
}
