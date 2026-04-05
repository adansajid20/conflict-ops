'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Bot, Send, Plus, Pin, Trash2, ChevronLeft, Loader2, AlertCircle } from 'lucide-react'
import { useUser } from '@clerk/nextjs'

type Message = { role: 'user' | 'assistant'; content: string }
type Conversation = { id: string; title: string; pinned: boolean; updated_at: string }
type ApiResponse = { response?: string; conversation_id?: string; error?: string }
type ConvResponse = { conversations?: Conversation[]; error?: string }

export default function AnalystPage() {
  const { user } = useUser()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const userId = user?.id ?? ''

  const loadConversations = useCallback(async () => {
    if (!userId) return
    const res = await fetch(`/api/v1/analyst/conversations?user_id=${userId}`)
    const data = await res.json() as ConvResponse
    setConversations(data.conversations ?? [])
  }, [userId])

  useEffect(() => { void loadConversations() }, [loadConversations])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading || !userId) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      const res = await fetch('/api/v1/analyst/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: userMsg, conversation_id: activeConvId, user_id: userId }),
      })
      const data = await res.json() as ApiResponse
      if (data.response) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response! }])
        if (data.conversation_id && !activeConvId) {
          setActiveConvId(data.conversation_id)
          void loadConversations()
        }
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  const startNew = () => { setActiveConvId(null); setMessages([]) }

  const openConversation = async (conv: Conversation) => {
    setActiveConvId(conv.id)
    // Load messages from DB (simplified: start fresh with context)
    setMessages([{ role: 'assistant', content: `Resuming conversation: **${conv.title}**\n\nWhat would you like to know?` }])
  }

  const deleteConversation = async (id: string) => {
    await fetch(`/api/v1/analyst/conversations?id=${id}&user_id=${userId}`, { method: 'DELETE' })
    if (activeConvId === id) startNew()
    void loadConversations()
  }

  const SUGGESTIONS = [
    "What's happening in Ukraine right now?",
    "Summarize the threat landscape in the Middle East",
    "Are there any multi-signal convergences I should know about?",
    "What are the top active predictions and their evidence?",
    "Show me military flight activity over conflict zones",
  ]

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="w-5 h-5 text-blue-400" />
              <span className="font-semibold text-sm">Radar — Intel Analyst</span>
            </div>
            <button onClick={startNew} className="w-full flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition-colors">
              <Plus className="w-4 h-4" /> New Conversation
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.map(conv => (
              <div key={conv.id} className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${activeConvId === conv.id ? 'bg-gray-700' : 'hover:bg-gray-800'}`} onClick={() => void openConversation(conv)}>
                {conv.pinned && <Pin className="w-3 h-3 text-yellow-400 shrink-0" />}
                <span className="flex-1 truncate text-gray-300">{conv.title}</span>
                <button onClick={e => { e.stopPropagation(); void deleteConversation(conv.id) }} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main chat */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900">
          <button onClick={() => setSidebarOpen(v => !v)} className="text-gray-400 hover:text-white">
            <ChevronLeft className={`w-5 h-5 transition-transform ${sidebarOpen ? '' : 'rotate-180'}`} />
          </button>
          <Bot className="w-5 h-5 text-blue-400" />
          <div>
            <div className="font-semibold text-sm">Radar</div>
            <div className="text-xs text-gray-400">AI Intelligence Analyst — live data access</div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-gray-400">Live</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="max-w-2xl mx-auto mt-12">
              <div className="text-center mb-8">
                <Bot className="w-12 h-12 text-blue-400 mx-auto mb-3" />
                <h2 className="text-xl font-semibold mb-2">Radar — Your Intelligence Analyst</h2>
                <p className="text-gray-400 text-sm">Ask me anything about current conflicts, predictions, risk scores, military activity, or geopolitical developments. I have live access to all ConflictRadar data.</p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => { setInput(s); void sendMessage() }} className="text-left px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors border border-gray-700">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 max-w-4xl ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'assistant' ? 'bg-blue-600' : 'bg-gray-700'}`}>
                {msg.role === 'assistant' ? <Bot className="w-4 h-4" /> : <span className="text-xs font-bold">U</span>}
              </div>
              <div className={`px-4 py-3 rounded-xl text-sm leading-relaxed max-w-2xl ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-100'}`}>
                <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 max-w-4xl">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="px-4 py-3 bg-gray-800 rounded-xl flex items-center gap-2 text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Analyzing intelligence...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-800 bg-gray-900">
          {!userId && (
            <div className="flex items-center gap-2 text-yellow-400 text-sm mb-3">
              <AlertCircle className="w-4 h-4" /> Sign in to save conversations
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage() } }}
              placeholder="Ask Radar anything about current intelligence..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 placeholder-gray-500"
            />
            <button
              onClick={() => void sendMessage()}
              disabled={loading || !input.trim()}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
