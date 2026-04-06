'use client'

import { useEffect, useMemo, useState, type ComponentType, type CSSProperties } from 'react'
import { usePathname } from 'next/navigation'
import { Bot, Loader2, Send, X } from 'lucide-react'

type OrgResponse = { success?: boolean; data?: { org?: { id?: string } } }
type ChatMessage = { role: 'user' | 'assistant'; content: string }
type TopStoryContext = {
  id: string
  title: string | null
  region: string | null
  event_type: string | null
  severity: number | null
  occurred_at: string | null
  outlet_name?: string | null
  description?: string | null
}

type CopilotApiResponse = { success: boolean; data?: { response: string; unavailable?: boolean }; error?: string }

const SUGGESTED_PROMPTS = [
  'What are the most significant developments in the last 24 hours?',
  'Which regions are at highest risk of escalation right now?',
  'Summarize the Iran situation based on current intelligence',
]

const BotIcon = Bot as unknown as ComponentType<{ className?: string; style?: CSSProperties }>
const LoaderIcon = Loader2 as unknown as ComponentType<{ className?: string; style?: CSSProperties }>
const SendIcon = Send as unknown as ComponentType<{ className?: string; style?: CSSProperties }>
const CloseIcon = X as unknown as ComponentType<{ className?: string; style?: CSSProperties }>

export function IntelCopilot({ topStories: propTopStories }: { topStories?: TopStoryContext[] }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Ask about recent events, alerts, missions, or forecasts. I only answer from platform data.' },
  ])
  const [unavailable, setUnavailable] = useState(false)
  const [fetchedStories, setFetchedStories] = useState<TopStoryContext[]>([])

  // Self-fetch top stories on open if none provided via prop
  const topStories = propTopStories && propTopStories.length > 0 ? propTopStories : fetchedStories

  useEffect(() => {
    if (!open || topStories.length > 0) return
    void fetch('/api/v1/overview?window=24h', { cache: 'no-store' })
      .then(r => r.json())
      .then((d: { topStories?: TopStoryContext[] }) => {
        if (d.topStories) setFetchedStories(d.topStories.slice(0, 20))
      })
      .catch(() => {})
  }, [open, topStories.length])

  useEffect(() => {
    void fetch('/api/v1/enterprise/org', { cache: 'no-store' })
      .then((res) => res.json() as Promise<OrgResponse>)
      .then((json) => setOrgId(json.data?.org?.id ?? null))
      .catch(() => setOrgId(null))
  }, [])

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('intel-copilot:open', handler)
    return () => window.removeEventListener('intel-copilot:open', handler)
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
        body: JSON.stringify({ org_id: orgId, messages: nextMessages, top_stories: topStories }),
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

  // Hide on map page — the globe has its own UI and the button overlaps the sidebar
  if (pathname === '/map') return null

  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-col items-end gap-3">
      {open ? (
        <div className="w-[360px] rounded-2xl border border-white/[0.05] bg-white/[0.015] shadow-2xl hover:bg-white/[0.03]">
          <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
            <div className="flex items-center gap-2">
              <BotIcon className="h-4 w-4 text-blue-400" />
              <div>
                <div className="text-sm font-semibold text-white">Intel Co-pilot</div>
                <div className="text-xs text-white/50">{unavailable ? 'Unavailable' : 'Grounded answers only'}</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close co-pilot"><CloseIcon className="h-4 w-4 text-white/80" /></button>
          </div>

          <div className="max-h-[420px] space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`rounded-xl px-3 py-2 text-sm ${message.role === 'user' ? 'ml-8 bg-blue-500 text-white' : 'mr-8 bg-white/[0.03] text-white'}`}>
                <div className="whitespace-pre-wrap leading-6">{message.content}</div>
              </div>
            ))}
            {thinking && (
              <div className="mr-8 flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-sm text-white">
                <LoaderIcon className="h-4 w-4 animate-spin" /> Thinking...
              </div>
            )}
          </div>

          <div className="border-t border-white/[0.05] p-3">
            {!orgId ? (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white/50">Complete org setup to use the co-pilot.</div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setInput(prompt)}
                      className="rounded-full border border-white/[0.08] bg-white/[0.05] px-3 py-1 text-xs text-white/60 hover:bg-white/[0.08]"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') void submitQuestion() }}
                    placeholder={placeholder}
                    disabled={thinking || unavailable}
                    className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none placeholder:text-white/20"
                  />
                  <button
                    onClick={() => void submitQuestion()}
                    disabled={thinking || !input.trim() || unavailable}
                    className="rounded-lg bg-blue-500 px-3 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
                  >
                    <SendIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <button
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.05] px-4 py-3 text-white shadow-lg hover:bg-white/[0.08]"
      >
        <BotIcon className="h-4 w-4 text-blue-400" />
        <span className="text-sm font-medium">Intel Co-pilot</span>
      </button>
    </div>
  )
}
