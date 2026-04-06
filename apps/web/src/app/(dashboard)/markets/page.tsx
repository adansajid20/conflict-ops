export const dynamic = 'force-dynamic'

import { MarketsPanel } from '@/components/markets/MarketsPanel'
import { EconomicWarfarePanel } from '@/components/markets/EconomicWarfarePanel'
import { PredictionMarketsPanel } from '@/components/markets/PredictionMarketsPanel'

export default function MarketsPage() {
  return (
    <div className="p-6 h-full">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold mono tracking-wide text-white">PREDICTION MARKETS</h1>
          <p className="text-sm mt-1 text-white/50">Real-money and crowd-sourced probability estimates for geopolitical events, now with a dedicated predictions tab.</p>
        </div>
        <div className="grid gap-6">
          <div><div className="mb-2 text-xs uppercase tracking-[0.16em] text-white/50">Markets</div><div className="rounded border border-white/[0.05] bg-white/[0.015] height-[50vh]"><MarketsPanel /></div></div>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div><div className="mb-2 text-xs uppercase tracking-[0.16em] text-white/50">Predictions</div><PredictionMarketsPanel /></div>
            <div><div className="mb-2 text-xs uppercase tracking-[0.16em] text-white/50">Economic</div><EconomicWarfarePanel /></div>
          </div>
        </div>
      </div>
    </div>
  )
}
