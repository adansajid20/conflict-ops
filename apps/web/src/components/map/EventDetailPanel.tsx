'use client'

import { useState, useEffect } from 'react'

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

type TabId = 'intel' | 'raw' | 'related'

function timeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function EventDetailPanel({ event, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('intel')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (event) {
      setVisible(true)
      setActiveTab('intel')
    } else {
      setVisible(false)
    }
  }, [event])

  if (!event && !visible) return null

  const sev = String(event?.severity ?? 'low')
  const color = SEV_COLORS[sev] ?? '#6b7280'
  const title = String(event?.title ?? 'Unknown Event')
  const summary = String(event?.summary ?? '')
  const region = event?.region ? String(event.region) : null
  const source = event?.source ? String(event.source) : null
  const sourceUrl = event?.sourceUrl ? String(event.sourceUrl) : null
  const publishedAt = event?.publishedAt ? String(event.publishedAt) : null
  const category = event?.event_type != null ? String(event.event_type) : event?.category != null ? String(event.category) : null
  const isBreaking = event?.isBreaking === true

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0,
      width: 380, height: '100%', zIndex: 50,
      background: 'rgba(13, 17, 23, 0.97)',
      borderLeft: '1px solid rgba(255,255,255,0.08)',
      backdropFilter: 'blur(20px)',
      display: 'flex', flexDirection: 'column',
      fontFamily: '-apple-system, system-ui, sans-serif',
      transform: visible && event ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.3s ease-out',
      boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
    }}>

      {/* Header */}
      <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}60` }} />
            <span style={{
              fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.1em',
              background: `${color}18`, padding: '3px 10px', borderRadius: 4,
            }}>{sev}</span>
            {isBreaking && (
              <span style={{
                fontSize: 9, fontWeight: 700, color: '#ef4444',
                background: 'rgba(239,68,68,0.15)', padding: '3px 8px', borderRadius: 4,
                animation: 'cr-blink 1.5s infinite',
              }}>BREAKING</span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 6,
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#64748b', fontSize: 16, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#e2e8f0' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#64748b' }}
          >✕</button>
        </div>

        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.4, margin: '0 0 10px' }}>
          {title}
        </h2>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 11, color: '#64748b' }}>
          {publishedAt && <span>🕐 {timeSince(publishedAt)}</span>}
          {region && <span>📍 {region.replace(/_/g, ' ')}</span>}
          {category && <span style={{ textTransform: 'capitalize' }}>📁 {String(category).replace(/_/g, ' ')}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {(['intel', 'raw', 'related'] as TabId[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            flex: 1, padding: '11px 8px', cursor: 'pointer',
            background: 'none', border: 'none',
            fontSize: 10, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            color: activeTab === tab ? '#e2e8f0' : '#475569',
            borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
            transition: 'all 0.15s',
          }}>
            {tab === 'intel' ? '🔍 Intel Brief' : tab === 'raw' ? '{ } Raw' : '🔗 Related'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 18 }}>
        {activeTab === 'intel' && (
          <div>
            {/* Severity bar */}
            <div style={{ height: 4, borderRadius: 2, background: '#1e293b', marginBottom: 18 }}>
              <div style={{
                width: sev === 'critical' ? '100%' : sev === 'high' ? '75%' : sev === 'medium' ? '50%' : '25%',
                height: '100%', borderRadius: 2, background: color, transition: 'width 0.5s ease',
              }} />
            </div>

            {/* Summary */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 9, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
                Intelligence Summary
              </h3>
              <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.7, margin: 0 }}>
                {summary || 'Intelligence summary pending. AI analysis will be available shortly.'}
              </p>
            </div>

            {/* Meta grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
              padding: 14, background: 'rgba(255,255,255,0.02)',
              borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)', marginBottom: 16,
            }}>
              {[
                { label: 'Category', value: category ? String(category).replace(/_/g, ' ') : 'General' },
                { label: 'Source', value: source ?? 'Unknown' },
                { label: 'Region', value: region ? region.replace(/_/g, ' ') : 'Global' },
                { label: 'Published', value: publishedAt ? timeSince(publishedAt) : 'Unknown' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'capitalize' }}>{value}</div>
                </div>
              ))}
            </div>

            {sourceUrl && (
              <a
                href={sourceUrl.startsWith('http') ? sourceUrl : `https://${sourceUrl}`}
                target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%', padding: 10,
                  background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)',
                  borderRadius: 10, color: '#3b82f6', fontSize: 12, fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                🔗 View Original Source
              </a>
            )}
          </div>
        )}

        {activeTab === 'raw' && (
          <pre style={{
            fontSize: 10, color: '#94a3b8', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            background: 'rgba(0,0,0,0.3)', padding: 14, borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.04)', lineHeight: 1.6, margin: 0,
            fontFamily: 'SF Mono, Monaco, Consolas, monospace',
          }}>
            {JSON.stringify(event, null, 2)}
          </pre>
        )}

        {activeTab === 'related' && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔗</div>
            <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>Event correlation engine coming soon.</p>
            <p style={{ fontSize: 11, color: '#475569', marginTop: 8 }}>
              Will show related events, similar patterns, and connected intelligence.
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes cr-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  )
}
