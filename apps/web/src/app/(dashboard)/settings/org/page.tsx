export const dynamic = 'force-dynamic'

import { OrgManager } from '@/components/settings/OrgManager'

export default function OrgSettingsPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mono tracking-wide" style={{ color: 'var(--text-primary)' }}>
          ORGANIZATION
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Manage team members, roles, SSO configuration, and tenant controls.
          SSO/SAML requires Enterprise plan.
        </p>
      </div>
      <OrgManager />
    </div>
  )
}
