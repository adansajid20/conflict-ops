export function getFreshnessStatus(occurredAt: string): { label: string; color: string; urgent: boolean } {
  const ageMs = Date.now() - new Date(occurredAt).getTime()
  const ageHours = ageMs / (1000 * 60 * 60)

  if (ageHours < 0.5) return { label: 'BREAKING', color: 'text-red-400 bg-red-500/20 border-red-500/40', urgent: true }
  if (ageHours < 2) return { label: 'FRESH', color: 'text-green-400 bg-green-500/20 border-green-500/40', urgent: false }
  if (ageHours < 6) return { label: '6H', color: 'text-blue-400 bg-blue-500/20 border-blue-500/40', urgent: false }
  if (ageHours < 24) return { label: '24H', color: 'text-gray-400 bg-gray-500/10 border-gray-700', urgent: false }
  if (ageHours < 72) return { label: '2D', color: 'text-gray-500 bg-gray-500/10 border-gray-800', urgent: false }
  return { label: 'ARCHIVED', color: 'text-gray-600 bg-gray-500/5 border-gray-800', urgent: false }
}
