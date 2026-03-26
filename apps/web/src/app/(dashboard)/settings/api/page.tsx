'use client'

import { APIKeysManager } from '@/components/settings/APIKeysManager'

export default function APISettingsPage() {
  return <div className="p-6 max-w-5xl"><h1 className="text-[22px] font-semibold" style={{ color: 'var(--text-primary)' }}>API Access</h1><p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Manage programmatic access and export-ready credentials.</p><div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_.8fr]"><APIKeysManager /><div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}><div className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Quick curl example</div><pre className="overflow-auto rounded-lg p-4 text-sm" style={{ background: 'var(--bg-surface-2)', color: 'var(--text-primary)' }}>{`curl https://conflictradar.co/api/public/v1/events \\
  -H "Authorization: Bearer cok_live_..." \\
  -G --data-urlencode "limit=50" \\
  --data-urlencode "severity_gte=3"`}</pre></div></div></div>
}
