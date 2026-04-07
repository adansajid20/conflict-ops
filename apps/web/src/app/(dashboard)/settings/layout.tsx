'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const SETTINGS_TABS = [
  { href: '/settings/org', label: 'Organization' },
  { href: '/settings/alerts', label: 'Alerts' },
  { href: '/settings/integrations', label: 'Integrations' },
  { href: '/settings/webhooks', label: 'Webhooks' },
  { href: '/settings/api', label: 'API Keys' },
  { href: '/settings/team', label: 'Team' },
  { href: '/settings/billing', label: 'Billing' },
  { href: '/settings/privacy', label: 'Privacy' },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col" style={{ background: '#070B11' }}>
      {/* Tab bar */}
      <div className="border-b border-white/[0.06] px-6">
        <div className="flex items-center gap-1 overflow-x-auto py-3 -mb-px">
          {SETTINGS_TABS.map((tab) => {
            const active = pathname === tab.href
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`whitespace-nowrap px-3.5 py-2 rounded-lg text-[11px] font-semibold tracking-wide transition-all
                  ${active
                    ? 'bg-white/[0.06] text-white border border-white/[0.08]'
                    : 'text-white/35 hover:text-white/60 hover:bg-white/[0.03] border border-transparent'
                  }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
