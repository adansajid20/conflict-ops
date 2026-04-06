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
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [outputs, setOutputs] = useState<Record<string, string>>({})
  const [loadingTool, setLoadingTool] = useState<string | null>(null)

  const analyze = async (toolId: string) => {
    const inputText = inputs[toolId] ?? ''
    if (!inputText.trim()) return
    setLoadingTool(toolId)
    setOutputs((prev) => ({ ...prev, [toolId]: '' }))
    const res = await fetch('/api/v1/workbench/sat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: toolId, input: inputText }),
    })
    const reader = res.body?.getReader()
    if (!reader) {
      const text = await res.text()
      setOutputs((prev) => ({ ...prev, [toolId]: text }))
      setLoadingTool(null)
      return
    }
    const decoder = new TextDecoder()
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      setOutputs((prev) => ({ ...prev, [toolId]: (prev[toolId] ?? '') + decoder.decode(chunk.value) }))
    }
    setLoadingTool(null)
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {TOOLS.map((tool) => {
        const Icon = tool.icon as any
        const isOpen = openTool === tool.id
        const inputText = inputs[tool.id] ?? ''
        const outputText = outputs[tool.id] ?? ''
        const isLoading = loadingTool === tool.id
        return (
          <div key={tool.id} className="rounded-lg border border-white/[0.05] bg-white/[0.015] p-4 interactive-card">
            <div className="mb-3 flex items-center justify-between">
              <div className="rounded-lg bg-blue-500/10 p-2"><Icon size={24} className="text-blue-400" /></div>
              <button onClick={() => setOpenTool(isOpen ? null : tool.id)} className="rounded-md border border-white/[0.05] px-3 py-1.5 text-sm text-white hover:bg-white/[0.03]">Open</button>
            </div>
            <div className="text-sm font-semibold text-white">{tool.label}</div>
            <div className="mt-1 text-sm text-white/50">{tool.desc}</div>
            {isOpen && (
              <div className="mt-4">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputs((prev) => ({ ...prev, [tool.id]: e.target.value }))}
                  rows={6}
                  className="w-full rounded-lg border border-white/[0.05] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/20"
                  placeholder="Paste scenario, assumptions, or evidence stack..."
                />
                <button
                  onClick={() => void analyze(tool.id)}
                  disabled={isLoading || !inputText.trim()}
                  className="mt-3 rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  {isLoading ? 'Analyzing...' : 'Analyze'}
                </button>
                {outputText && (
                  <div className="mt-4 rounded-lg border border-white/[0.05] bg-white/[0.03] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs uppercase tracking-[0.16em] text-white/30">Output</span>
                      <button onClick={() => navigator.clipboard.writeText(outputText)} className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white/70">{(() => { const CopyIcon = Copy as any; return <CopyIcon size={12} /> })()} Copy</button>
                    </div>
                    <pre className="whitespace-pre-wrap text-sm text-white">{outputText}</pre>
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
