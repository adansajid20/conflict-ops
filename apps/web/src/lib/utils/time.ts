export function safeRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Time unknown'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return 'Time unknown'
    const diffMs = Date.now() - d.getTime()
    if (diffMs < 0) return 'Just now' // future-dated events
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}h ago`
    const diffD = Math.floor(diffH / 24)
    if (diffD < 7) return `${diffD}d ago`
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: diffD > 365 ? 'numeric' : undefined,
    })
  } catch {
    return 'Time unknown'
  }
}

export function safeAbsoluteTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
    timeZoneName: 'short',
  })
}

export type FreshnessLevel = 'live' | 'delayed' | 'stale' | 'unknown'

export function getFreshness(ingestedAt: string | null | undefined): FreshnessLevel {
  if (!ingestedAt) return 'unknown'
  const d = new Date(ingestedAt)
  if (isNaN(d.getTime())) return 'unknown'
  const diffMin = (Date.now() - d.getTime()) / 60000
  if (diffMin < 15) return 'live'
  if (diffMin < 120) return 'delayed'
  return 'stale'
}
