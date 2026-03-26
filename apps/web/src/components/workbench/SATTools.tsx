'use client'

import { useState } from 'react'
import { Brain, CheckSquare, Clock, Copy, GitBranch, MessageSquare, ScanSearch } from 'lucide-react'

const TOOLS = [
  { id: 'red-team', label: 'Red Team Analysis', desc: 'Challenge your assessment from an adversarial perspective', icon: Brain },
  { id: 'devils-advocate', label: "Devil's Advocacy", desc: 'Build the strongest possible counter-argument', icon: MessageSquare },
  { id: 'key-assumptions', label: 'Key Assumptions Check', desc: 'Surface and stress-test hidden assumptions', icon: CheckSquare },
  { id: 'argument-mapping', label: 'Argument Mapping', desc: 'Structure premises, claims, and rebuttals', icon: GitBranch },
  { id: 'qoic', label: 'Quality of Info Check', desc: 'Evaluate source reliability and information quality', icon: ScanSearch },
  { id: 'timeline', label: 'Timeline Analysis', desc: 'Build a chronological event sequence', icon: Clock },
] as const

export function SATTools() {
  const [openTool, setOpenTool] = useState<string | null>(null)
  const [inputText, setInputText] = useState('')
  const [outputText, setOutputText] = useState('')
  const [loading, setLoading] = useState(false)

  const analyze = async (tool: string) => {
    setLoading(true)
    setOutputText('')
    const res = await fetch('/api/v1/workbench/sat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tool, input: inputText }) })
    const reader = res.body?.getReader()
    if (!reader) {
      const text = await res.text()
      setOutputText(text)
      setLoading(false)
      return
    }
    const decoder = new TextDecoder()
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      setOutputText((prev) => prev + decoder.decode(chunk.value))
    }
    setLoading(false)
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {TOOLS.map((tool) => {
        const Icon = tool.icon as any
        const isOpen = openTool === tool.id
        return (
          <div key={tool.id} className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
            <div className="mb-3 flex items-center justify-between">
              <div className="rounded-lg p-2" style={{ background: 'var(--primary-dim)' }}><Icon size={24} style={{ color: 'var(--primary)' }} /></div>
              <button onClick={() => setOpenTool(isOpen ? null : tool.id)} className="rounded-md border px-3 py-1.5 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>Open</button>
            </div>
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{tool.label}</div>
            <div className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{tool.desc}</div>
            {isOpen && (
              <div className="mt-4">
                <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} rows={6} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)' }} placeholder="Paste scenario, assumptions, or evidence stack..." />
                <button onClick={() => void analyze(tool.id)} disabled={loading || !inputText.trim()} className="mt-3 rounded-lg px-3 py-2 text-sm font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>{loading ? 'Analyzing...' : 'Analyze'}</button>
                {outputText && (
                  <div className="mt-4 rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)' }}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>Output</span>
                      <button onClick={() => navigator.clipboard.writeText(outputText)} className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{(() => { const CopyIcon = Copy as any; return <CopyIcon size={12} /> })()} Copy</button>
                    </div>
                    <pre className="whitespace-pre-wrap text-sm" style={{ color: 'var(--text-primary)' }}>{outputText}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
