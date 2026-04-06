'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import html2canvas from 'html2canvas'
import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnConnect,
} from 'reactflow'
import 'reactflow/dist/style.css'

type CorkboardNodeType = 'event' | 'actor' | 'location' | 'evidence' | 'hypothesis'
type CorkboardEdgeType = 'causal' | 'corroborates' | 'contradicts' | 'associates'

type CorkboardNodeData = {
  label: string
  type: CorkboardNodeType
  note?: string
}

type CorkboardNode = Node<CorkboardNodeData>
type CorkboardEdge = Edge<{ relationship: CorkboardEdgeType }>
type CorkboardStateResponse = {
  success?: boolean
  data?: {
    mission_id?: string | null
    nodes?: CorkboardNode[]
    edges?: CorkboardEdge[]
    updated_at?: string | null
  }
}

const NODE_COLORS: Record<CorkboardNodeType, string> = {
  event: '#F97316',
  actor: '#3B82F6',
  location: '#14B8A6',
  evidence: '#A855F7',
  hypothesis: '#EAB308',
}

const EDGE_STYLES: Record<CorkboardEdgeType, { stroke: string; dash?: string }> = {
  causal: { stroke: '#F97316' },
  corroborates: { stroke: '#22C55E' },
  contradicts: { stroke: '#EF4444', dash: '6 4' },
  associates: { stroke: '#6B7280' },
}

const STARTER_NODES: CorkboardNode[] = [
  { id: 'event-1', type: 'default', position: { x: 80, y: 80 }, data: { label: 'Port disruption', type: 'event', note: 'Primary incident' } },
  { id: 'actor-1', type: 'default', position: { x: 420, y: 40 }, data: { label: 'Militia network', type: 'actor', note: 'Claimed influence' } },
  { id: 'location-1', type: 'default', position: { x: 420, y: 220 }, data: { label: 'Bab-el-Mandeb', type: 'location', note: 'Chokepoint' } },
  { id: 'evidence-1', type: 'default', position: { x: 760, y: 60 }, data: { label: 'SIGINT intercept', type: 'evidence', note: 'Unverified but recent' } },
  { id: 'hypothesis-1', type: 'default', position: { x: 760, y: 240 }, data: { label: 'Coercive signaling campaign', type: 'hypothesis', note: 'Working assessment' } },
]

const STARTER_EDGES: CorkboardEdge[] = [
  { id: 'event-actor', source: 'event-1', target: 'actor-1', label: 'causal', data: { relationship: 'causal' }, animated: true },
  { id: 'actor-evidence', source: 'actor-1', target: 'evidence-1', label: 'corroborates', data: { relationship: 'corroborates' } },
  { id: 'location-hypothesis', source: 'location-1', target: 'hypothesis-1', label: 'associates', data: { relationship: 'associates' } },
]

const Flow = ReactFlow as unknown as ComponentType<{
  nodes: CorkboardNode[]
  edges: CorkboardEdge[]
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: OnConnect
  fitView?: boolean
  children?: React.ReactNode
}>
const FlowMiniMap = MiniMap as unknown as ComponentType<Record<string, never>>
const FlowControls = Controls as unknown as ComponentType<Record<string, never>>
const FlowBackground = Background as unknown as ComponentType<{ gap?: number; size?: number }>

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function Corkboard() {
  const boardRef = useRef<HTMLDivElement | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hydratedRef = useRef(false)
  const [nodes, setNodes] = useState<CorkboardNode[]>(STARTER_NODES)
  const [edges, setEdges] = useState<CorkboardEdge[]>(STARTER_EDGES)
  const [missionId, setMissionId] = useState<string | null>(null)
  const [selectedNodeType, setSelectedNodeType] = useState<CorkboardNodeType>('event')
  const [selectedEdgeType, setSelectedEdgeType] = useState<CorkboardEdgeType>('associates')
  const [draftLabel, setDraftLabel] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('loading')

  const onConnect: OnConnect = useCallback((params: Connection) => {
    setEdges((current) => addEdge({
      ...params,
      label: selectedEdgeType,
      data: { relationship: selectedEdgeType },
      style: {
        stroke: EDGE_STYLES[selectedEdgeType].stroke,
        strokeDasharray: EDGE_STYLES[selectedEdgeType].dash,
        strokeWidth: 2,
      },
      animated: selectedEdgeType === 'causal',
    }, current))
  }, [selectedEdgeType])

  useEffect(() => {
    let cancelled = false

    const loadState = async () => {
      setSaveStatus('loading')
      try {
        const response = await fetch('/api/v1/corkboard', { cache: 'no-store' })
        const json = await response.json() as CorkboardStateResponse
        if (cancelled) return

        const nextNodes = json.data?.nodes?.length ? json.data.nodes : STARTER_NODES
        const nextEdges = json.data?.edges?.length ? json.data.edges : STARTER_EDGES
        setNodes(nextNodes)
        setEdges(nextEdges)
        setMissionId(json.data?.mission_id ?? null)
        setSaveStatus('idle')
      } catch {
        if (!cancelled) setSaveStatus('error')
      } finally {
        if (!cancelled) hydratedRef.current = true
      }
    }

    void loadState()
    return () => {
      cancelled = true
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!hydratedRef.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

    saveTimerRef.current = setTimeout(() => {
      setSaveStatus('saving')
      void fetch('/api/v1/corkboard', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mission_id: missionId, nodes, edges }),
      })
        .then((response) => response.json() as Promise<CorkboardStateResponse>)
        .then((json) => {
          if (!json.success) throw new Error('Save failed')
          setMissionId(json.data?.mission_id ?? missionId ?? null)
          setSaveStatus('saved')
        })
        .catch(() => setSaveStatus('error'))
    }, 1000)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [edges, missionId, nodes])

  const styledNodes = useMemo(() => nodes.map((node) => ({
    ...node,
    style: {
      border: `1px solid ${NODE_COLORS[node.data.type]}`,
      borderRadius: 12,
      padding: 10,
      minWidth: 170,
      background: 'rgba(255,255,255,0.025)',
      color: 'rgb(255,255,255)',
      boxShadow: `0 0 0 1px ${NODE_COLORS[node.data.type]}22`,
    },
  })), [nodes])

  const styledEdges = useMemo(() => edges.map((edge) => {
    const relationship = edge.data?.relationship ?? 'associates'
    return {
      ...edge,
      style: {
        stroke: EDGE_STYLES[relationship].stroke,
        strokeDasharray: EDGE_STYLES[relationship].dash,
        strokeWidth: 2,
      },
    }
  }), [edges])

  const addNode = useCallback(() => {
    const label = draftLabel.trim() || `${selectedNodeType.charAt(0).toUpperCase()}${selectedNodeType.slice(1)} ${nodes.length + 1}`
    const nextNode: CorkboardNode = {
      id: `${selectedNodeType}-${Date.now()}`,
      type: 'default',
      position: { x: 120 + ((nodes.length % 4) * 220), y: 120 + (Math.floor(nodes.length / 4) * 140) },
      data: { label, type: selectedNodeType },
    }
    setNodes((current) => [...current, nextNode])
    setDraftLabel('')
  }, [draftLabel, nodes.length, selectedNodeType])

  const exportJson = useCallback(() => {
    const payload = JSON.stringify({ nodes, edges, exported_at: new Date().toISOString() }, null, 2)
    downloadBlob(new Blob([payload], { type: 'application/json' }), 'conflict-ops-corkboard.json')
  }, [edges, nodes])

  const exportPng = useCallback(async () => {
    if (!boardRef.current) return
    const canvas = await html2canvas(boardRef.current, { backgroundColor: '#0B1020', useCORS: true, scale: 2 })
    canvas.toBlob((blob) => {
      if (!blob) return
      downloadBlob(blob, 'conflict-ops-corkboard.png')
    })
  }, [])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/50">Node type</div>
            <select value={selectedNodeType} onChange={(e) => setSelectedNodeType(e.target.value as CorkboardNodeType)} className="w-full rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-sm text-white">
              {Object.keys(NODE_COLORS).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/50">Edge type</div>
            <select value={selectedEdgeType} onChange={(e) => setSelectedEdgeType(e.target.value as CorkboardEdgeType)} className="w-full rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-sm text-white">
              {Object.keys(EDGE_STYLES).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/50">New node label</div>
            <input value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)} placeholder="Add actor, event, evidence…" className="w-full rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-sm text-white placeholder:text-white/20" />
          </div>
          <div className="flex items-end gap-2">
            <button onClick={addNode} className="rounded-lg px-3 py-2 text-sm font-medium text-white hover:bg-blue-600" style={{ backgroundColor: '#3B82F6' }}>Add node</button>
            <button onClick={() => void exportPng()} className="rounded-lg border border-white/[0.05] px-3 py-2 text-sm text-white/80 hover:bg-white/5">Export PNG</button>
            <button onClick={exportJson} className="rounded-lg border border-white/[0.05] px-3 py-2 text-sm text-white/80 hover:bg-white/5">Export JSON</button>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-white/50">
          <span>Connect nodes to create <span style={{ color: EDGE_STYLES[selectedEdgeType].stroke }}>{selectedEdgeType}</span> links. Drag to rearrange the case narrative.</span>
          <span>{saveStatus === 'loading' ? 'Loading…' : saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Save failed' : 'Ready'}</span>
        </div>
      </div>

      <div ref={boardRef} className="rounded-xl border border-white/[0.05] bg-white/[0.015] overflow-hidden" style={{ height: 640 }}>
        <Flow
          nodes={styledNodes}
          edges={styledEdges}
          onNodesChange={(changes) => setNodes((current) => applyNodeChanges(changes, current))}
          onEdgesChange={(changes) => setEdges((current) => applyEdgeChanges(changes, current))}
          onConnect={onConnect}
          fitView
        >
          <FlowMiniMap />
          <FlowControls />
          <FlowBackground gap={20} size={1} />
        </Flow>
      </div>
    </div>
  )
}
