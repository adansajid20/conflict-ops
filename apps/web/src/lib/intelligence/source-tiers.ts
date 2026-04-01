export const SOURCE_TIERS: Record<string, number> = {
  'reuters.com': 1.5,
  'apnews.com': 1.5,
  'bbc.com': 1.5,
  'afp.com': 1.5,
  'aljazeera.com': 1.2,
  'france24.com': 1.2,
  'dw.com': 1.2,
  'voanews.com': 1.2,
  'rferl.org': 1.2,
  'kyivindependent.com': 1.0,
  'haaretz.com': 1.0,
  'arabnews.com': 1.0,
}

export function getSourceWeight(source: string): number {
  const normalized = source.toLowerCase()
  for (const [domain, weight] of Object.entries(SOURCE_TIERS)) {
    if (normalized.includes(domain)) return weight
  }
  return 0.8
}

export function weightedSignificance(score: number, source: string): number {
  return Math.min(100, Math.round(score * getSourceWeight(source)))
}

export function getSourceTier(source: string): 1 | 2 | 3 | 4 {
  const weight = getSourceWeight(source)
  if (weight >= 1.5) return 1
  if (weight >= 1.2) return 2
  if (weight >= 1.0) return 3
  return 4
}

export function getSourceTierBadge(source: string): string {
  const tier = getSourceTier(source)
  if (tier === 1) return '🥇'
  if (tier === 2) return '🥈'
  if (tier === 3) return '🥉'
  return '▫️'
}
