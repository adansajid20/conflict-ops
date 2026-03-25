export const dynamic = 'force-dynamic'

import { GeoverifyQueue } from '@/components/geoverify/GeoverifyQueue'

export default function GeoverifyPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mono tracking-wide" style={{ color: 'var(--text-primary)' }}>
          GEOLOCATION VERIFICATION
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          OSINT verification queue. Shadow analysis, metadata extraction, landmark matching, satellite cross-reference.
          Confidence tiers: CONFIRMED → PROBABLE → POSSIBLE → UNVERIFIED → FALSE.
        </p>
      </div>
      <GeoverifyQueue />
    </div>
  )
}
