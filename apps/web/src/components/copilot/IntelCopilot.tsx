'use client'

import { useEffect, useMemo, useState, type ComponentType, type CSSProperties } from 'react'
import { Bot, Loader2, Send, X } from 'lucide-react'

type OrgResponse = { success?: boolean; data?: { org?: { id?: string } } }
type ChatMessage = { role: 'user' | 'assistant'; content: string }

type CopilotApiResponse = { success: boolean; data?: { response: string; unavailable?: boolean }; error?: string }

const BotIcon = Bot as unknown as ComponentType<{ className?: string; style?: CSSProperties }>
const LoaderIcon = Loader2 as unknown as ComponentType<{ className?: string; style?: CSSProperties }>
const SendIcon = Send as unknown as ComponentType<{ className?: string; style?: CSSProperties }>
const CloseIcon = X as unknown as ComponentType<{ className?: string; style?: CSSProperties }>

export function IntelCopilot() {
  const [open, setOpen] = useState(false)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Ask about recent events, alerts, missions, or forecasts. I only answer from platform data.' },
  ])
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    void fetch('/api/v1/enterprise/org', { cache: 'no-store' })
      .then((res) => res.json() as Promise<OrgResponse>)
      .then((json) => setOrgId(json.data?.org?.id ?? null))
      .catch(() => setOrgId(null))
  }, [])

  const placeholder = useMemo(() => {
    if (unavailable) return 'AI Co-pilot unavailable'
    return 'What is happening in Sudan this week?'
  }, [unavailable])

  async function submitQuestion() {
    const question = input.trim()
    if (!question || thinking || !orgId || unavailable) return
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: question }]
    setMessages(nextMessages)
    setInput('')
    setThinking(true)

    try {
      const response = await fetch('/api/v1/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, messages: nextMessages }),
      })
      const json = await response.json() as CopilotApiResponse
      const reply = json.data?.response ?? json.error ?? 'No response available.'
      setUnavailable(Boolean(json.data?.unavailable))
      setMessages((current) => [...current, { role: 'assistant', content: reply }])
    } catch {
      setMessages((current) => [...current, { role: 'assistant', content: 'AI Co-pilot temporarily unavailable.' }])
      setUnavailable(true)
    } finally {
      setThinking(false)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-col items-end gap-3">
      {open ? (
        <div className="w-[360px] rounded-2xl border shadow-2xl" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2">
              <BotIcon className="h-4 w-4" style={{ color: 'var(--primary)' }} />
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Intel Co-pilot</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{unavailable ? 'Unavailable' : 'Grounded answers only'}</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close co-pilot"><CloseIcon className="h-4 w-4" /></button>
          </div>

          <div className="max-h-[420px] space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`rounded-xl px-3 py-2 text-sm ${message.role === 'user' ? 'ml-8' : 'mr-8'}`} style={{ background: message.role === 'user' ? 'var(--primary)' : 'var(--bg-surface-2)', color: message.role === 'user' ? '#fff' : 'var(--text-primary)' }}>
                <div className="whitespace-pre-wrap leading-6">{message.content}</div>
              </div>
            ))}
            {thinking && (
              <div className="mr-8 flex items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ background: 'var(--bg-surface-2)', color: 'var(--text-primary)' }}>
                <LoaderIcon className="h-4 w-4 animate-spin" /> Thinking...
              </div>
            )}
          </div>

          <div className="border-t p-3" style={{ borderColor: 'var(--border)' }}>
            {!orgId ? (
              <div className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Complete org setup to use the co-pilot.</div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') void submitQuestion() }}
                  placeholder={placeholder}
                  disabled={thinking || unavailable}
                  className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)' }}
                />
                <button
                  onClick={() => void submitQuestion()}
                  disabled={thinking || !input.trim() || unavailable}
                  className="rounded-lg px-3 py-2"
                  style={{ background: unavailable ? 'var(--bg-surface-3)' : 'var(--primary)', color: '#fff' }}
                >
                  <SendIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <button
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 rounded-full border px-4 py-3 shadow-lg"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
      >
        <BotIcon className="h-4 w-4" style={{ color: 'var(--primary)' }} />
        <span className="text-sm font-medium">Intel Co-pilot</span>
      </button>
    </div>
  )
}
