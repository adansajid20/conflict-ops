import { IntegrationsManager } from '@/components/settings/IntegrationsManager'

export default function IntegrationsSettingsPage() {
  return (
    <div className="max-w-5xl p-6">
      <h1 className="mb-6 text-[22px] font-semibold" style={{ color: 'var(--text-primary)' }}>Integrations</h1>
      <IntegrationsManager />
    </div>
  )
}
