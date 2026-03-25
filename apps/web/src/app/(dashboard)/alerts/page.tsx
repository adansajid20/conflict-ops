import { AlertPanel } from '@/components/alerts/AlertPanel'
import { PIRBuilder } from '@/components/pir/PIRBuilder'

export default function AlertsPage() {
  return (
    <div className="h-full flex flex-col lg:flex-row gap-0">
      {/* Left: Alerts feed */}
      <div className="flex-1 min-h-0 border-r" style={{ borderColor: 'var(--border)' }}>
        <AlertPanel />
      </div>

      {/* Right: PIR builder + list */}
      <div className="w-full lg:w-96 shrink-0 overflow-y-auto p-4">
        <div className="mb-4">
          <h2 className="text-sm font-bold mono tracking-widest mb-1" style={{ color: 'var(--text-primary)' }}>
            PRIORITY INTELLIGENCE REQUIREMENTS
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Define conditions. Get alerted when events match — all conditions must be true.
          </p>
        </div>
        <PIRBuilder />
      </div>
    </div>
  )
}
