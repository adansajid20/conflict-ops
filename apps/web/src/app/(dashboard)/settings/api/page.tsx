'use client'

import { APIKeysManager } from '@/components/settings/APIKeysManager'

export default function APISettingsPage() {
  return <div className="p-6 max-w-5xl"><h1 className="text-[22px] font-semibold text-white">API Access</h1><p className="mt-1 text-sm text-white/50">Manage programmatic access and export-ready credentials.</p><div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_.8fr]"><APIKeysManager /><div className="rounded-xl border p-4 bg-white/[0.015] border-white/[0.05]"><div className="mb-3 text-sm font-semibold text-white">Quick curl example</div><pre className="overflow-auto rounded-lg p-4 text-sm bg-white/[0.03] text-white/80">{`curl https://conflictradar.co/api/public/v1/events \\
  -H "Authorization: Bearer cok_live_..." \\
  -G --data-urlencode "limit=50" \\
  --data-urlencode "severity_gte=3"`}</pre></div></div></div>
}
