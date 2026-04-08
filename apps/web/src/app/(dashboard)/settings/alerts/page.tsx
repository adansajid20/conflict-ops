export const dynamic = 'force-dynamic'

import AlertsManager from '@/components/alerts/AlertsManager'

export default function AlertsSettingsPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white">Alert Settings</h1>
        <p className="text-sm text-white/50 mt-1">Get notified when critical events match your criteria</p>
      </div>
      <AlertsManager />
    </div>
  )
}
