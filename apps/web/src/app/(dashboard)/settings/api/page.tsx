export const dynamic = 'force-dynamic'

import { APIKeysManager } from '@/components/settings/APIKeysManager'

export default function APISettingsPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mono tracking-wide" style={{ color: 'var(--text-primary)' }}>
          API ACCESS
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Manage API keys for programmatic access. Business plan required.
          Keys grant read access to events, forecasts, and tracking data.
        </p>
      </div>
      <APIKeysManager />
    </div>
  )
}
