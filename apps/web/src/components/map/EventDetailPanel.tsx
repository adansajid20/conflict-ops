'use client'

import { useState } from 'react'

interface Props {
  event: Record<string, unknown> | null
  onClose: () => void
}

const SEV_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
}

function timeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

type TabId = 'intel' | 'raw'

export function EventDetailPanel({ event, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('intel')

  if (!event) return null

  const sev = String(event.severity ?? 'low')
  const color = SEV_COLORS[sev] ?? '#6b7280'
  const title = String(event.title ?? 'Unknown Event')
  const summary = String(event.summary ?? '')
  const region = event.region ? String(event.region) : null
  const source = event.source ? String(event.source) : null
  const sourceUrl = event.sourceUrl ? String(event.sourceUrl) : null
  const publishedAt = event.publishedAt ? String(event.publishedAt) : null
  const category = event.event_type ? String(event.event_type) : 'General'

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, width: 380, height: '100%', zIndex: 50,
      background: 'rgba(10, 13, 20, 0.97)',
      borderLeft: '1px solid rgba(255,255,255,0.07)',
      backdropFilter: 'blur(16px)',
      display: 'flex', flexDirection: 'column',
      fontFamily: '-apple-system, system-ui, sans-serif',
      animation: 'cr-slide-in 0.22s ease-out',
    }}>

      {/* Header */}
      <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.1em',
            background: `${color}20`, padding: '2px 8px', borderRadius: 4,
          }}>
            {sev}
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
            fontSize: 18, lineHeight: 1, padding: '0 0 0 8px',
          }}>×</button>
        </div>

        <h2 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.4, margin: '0 0 8px' }}>
          {title}
        </h2>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: 10, color: '#64748b' }}>
          {publishedAt && (
            <span>🕐 {timeSince(publishedAt)}</span>
          )}
          {region && (
            <span>📍 {region.replace(/_/g, ' ')}</span>
          )}
          {source && (
            <span>📡 {source}</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {(['intel', 'raw'] as TabId[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: '9px', fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer',
              background: 'none', border: 'none',
              color: activeTab === tab ? '#e2e8f0' : '#475569',
              borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
            }}
          >
            {tab === 'intel' ? 'Intel Brief' : 'Raw Data'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {activeTab === 'intel' && (
          <>
            {/* Severity bar */}
            <div style={{ height: 3, borderRadius: 2, background: '#1e293b', marginBottom: 16 }}>
              <div style={{
                width: sev === 'critical' ? '100%' : sev === 'high' ? '75%' : sev === 'medium' ? '50%' : '25%',
                height: '100%', borderRadius: 2, background: color, transition: 'width 0.3s',
              }} />
            </div>

            {/* Summary */}
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                Summary
              </h3>
              <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>
                {summary || 'No intelligence summary available for this event.'}
              </p>
            </div>

            {/* Metadata grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                  Category
                </h3>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, textTransform: 'capitalize' }}>
                  {category.replace(/_/g, ' ')}
                </p>
              </div>
              {region && (
                <div>
                  <h3 style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                    Region
                  </h3>
                  <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, textTransform: 'capitalize' }}>
                    {region.replace(/_/g, ' ')}
                  </p>
                </div>
              )}
            </div>

            {/* Source link */}
            {sourceUrl && (
              <a
                href={sourceUrl.startsWith('http') ? sourceUrl : `https://${sourceUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 11, color: '#3b82f6', textDecoration: 'none',
                  padding: '8px 12px', background: 'rgba(59,130,246,0.08)',
                  borderRadius: 8, border: '1px solid rgba(59,130,246,0.15)',
                }}
              >
                ↗ View Original Source
              </a>
            )}
          </>
        )}

        {activeTab === 'raw' && (
          <pre style={{
            fontSize: 10, color: '#94a3b8', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.05)', margin: 0,
          }}>
            {JSON.stringify(event, null, 2)}
          </pre>
        )}
      </div>

      <style>{`
        @keyframes cr-slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
