'use client'

import { useEffect, useState } from 'react'
import { eventToIntelItem, safeTimeAgo, severityColor, severityLabel, type IntelItem } from '@/types/intel-item'
import { IntelDrawer } from './IntelDrawer'
import Link from 'next/link'
import { getPublicSourceName } from '@/lib/utils/source-display'

export function RecentIntelFeed({ limit = 8 }: { limit?: number }) {
  const [items, setItems] = useState<IntelItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<IntelItem | null>(null)

  useEffect(() => {
    fetch(`/api/v1/events?limit=${limit}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((d: { data?: Record<string, unknown>[] }) => {
        setItems((d.data ?? []).map(eventToIntelItem))
      })
      .catch(() => { /* show empty state */ })
      .finally(() => setLoading(false))
  }, [limit])

  if (loading) {
    return (
      <div className="space-y-1.5 p-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton h-10 rounded" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          No events yet.{' '}
          <Link href="/admin" style={{ color: 'var(--primary)' }}>Run ingest →</Link>
        </div>
      </div>
    )
  }

  return (
    <>
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => setSelectedItem(item)}
          className="w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/5 active:bg-white/10 border-b"
          style={{ borderColor: 'var(--border)', display: 'flex' }}
        >
          {/* Severity badge */}
          <span className="text-xs font-mono font-bold shrink-0 px-1.5 py-0.5 rounded"
            style={{
              color: severityColor(item.severity),
              backgroundColor: `${severityColor(item.severity)}18`,
              minWidth: 40,
              textAlign: 'center',
              fontSize: 9,
            }}>
            {severityLabel(item.severity)}
          </span>
          {/* Title */}
          <p className="text-xs flex-1 truncate text-left" style={{ color: 'var(--text-primary)' }}>
            {item.title}
          </p>
          {/* Meta */}
          <span className="text-xs font-mono shrink-0 flex items-center gap-1.5" style={{ color: 'var(--text-disabled)', fontSize: 10 }}>
            <span style={{ color: 'var(--primary)' }}>{getPublicSourceName(item.source, null, item.title ?? null)}</span>
            {item.country_code && <span>{item.country_code}</span>}
            <span>{safeTimeAgo(item.occurred_at ?? item.ingested_at)}</span>
            <span>›</span>
          </span>
        </button>
      ))}

      <IntelDrawer
        item={selectedItem}
        items={items}
        onClose={() => setSelectedItem(null)}
        onNavigate={setSelectedItem}
      />
    </>
  )
}
