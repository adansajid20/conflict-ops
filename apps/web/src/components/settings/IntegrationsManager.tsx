'use client'

import { useEffect, useState } from 'react'

type Integration = {
  id: string
  provider: 'slack' | 'pagerduty'
  config: Record<string, string>
  active: boolean
}

export function IntegrationsManager() {
  const [items, setItems] = useState<Integration[]>([])
  const [slackUrl, setSlackUrl] = useState('')
  const [pagerDutyKey, setPagerDutyKey] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    const response = await fetch('/api/v1/integrations', { cache: 'no-store' })
    const json = await response.json() as { data?: Integration[]; error?: string }
    setItems(json.data ?? [])
    if (json.error) setMessage(json.error)
  }

  useEffect(() => { void load() }, [])

  async function save(provider: 'slack' | 'pagerduty') {
    const config = provider === 'slack' ? { webhook_url: slackUrl } : { integration_key: pagerDutyKey }
    const response = await fetch('/api/v1/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, config }),
    })
    const json = await response.json() as { success: boolean; error?: string }
    setMessage(json.success ? `${provider} saved` : (json.error ?? 'Save failed'))
    await load()
  }

  async function test(provider: 'slack' | 'pagerduty') {
    const config = provider === 'slack' ? { webhook_url: slackUrl } : { integration_key: pagerDutyKey }
    const response = await fetch('/api/v1/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, config, test: true }),
    })
    const json = await response.json() as { success: boolean; error?: string }
    setMessage(json.success ? `${provider} test sent` : (json.error ?? 'Test failed'))
  }

  async function disconnect(provider: 'slack' | 'pagerduty') {
    const response = await fetch(`/api/v1/integrations?provider=${provider}`, { method: 'DELETE' })
    const json = await response.json() as { success: boolean; error?: string }
    setMessage(json.success ? `${provider} disconnected` : (json.error ?? 'Disconnect failed'))
    await load()
  }

  const connected = new Set(items.map((item) => item.provider))

  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-4">
      <div className="mb-4 text-lg font-semibold text-white">Integrations</div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-white/[0.05] bg-white/[0.03] p-4">
          <div className="mb-2 font-medium text-white">Slack</div>
          <input value={slackUrl} onChange={(event) => setSlackUrl(event.target.value)} placeholder="Incoming webhook URL" className="w-full rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2 text-sm text-white placeholder:text-white/20" />
          <div className="mt-3 flex gap-2">
            <button onClick={() => void save('slack')} className="rounded-lg bg-blue-500 px-3 py-2 text-sm text-white hover:bg-blue-600">Connect</button>
            <button onClick={() => void test('slack')} className="rounded-lg border border-white/[0.05] px-3 py-2 text-sm text-white hover:bg-white/[0.02]">Test</button>
            {connected.has('slack') ? <button onClick={() => void disconnect('slack')} className="rounded-lg border border-white/[0.05] px-3 py-2 text-sm text-white hover:bg-white/[0.02]">Disconnect</button> : null}
          </div>
        </div>

        <div className="rounded-lg border border-white/[0.05] bg-white/[0.03] p-4">
          <div className="mb-2 font-medium text-white">PagerDuty</div>
          <input value={pagerDutyKey} onChange={(event) => setPagerDutyKey(event.target.value)} placeholder="Events API integration key" className="w-full rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2 text-sm text-white placeholder:text-white/20" />
          <div className="mt-3 flex gap-2">
            <button onClick={() => void save('pagerduty')} className="rounded-lg bg-blue-500 px-3 py-2 text-sm text-white hover:bg-blue-600">Connect</button>
            <button onClick={() => void test('pagerduty')} className="rounded-lg border border-white/[0.05] px-3 py-2 text-sm text-white hover:bg-white/[0.02]">Test</button>
            {connected.has('pagerduty') ? <button onClick={() => void disconnect('pagerduty')} className="rounded-lg border border-white/[0.05] px-3 py-2 text-sm text-white hover:bg-white/[0.02]">Disconnect</button> : null}
          </div>
        </div>
      </div>
      {message ? <div className="mt-4 text-sm text-white/50">{message}</div> : null}
    </div>
  )
}
