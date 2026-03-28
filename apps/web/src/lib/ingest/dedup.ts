/**
 * Event deduplication utilities for cross-source story matching.
 * Used at ingest time to prevent duplicate events entering the DB,
 * and at query time to cluster related events.
 */

const STOPWORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'of', 'to', 'for', 'by', 'with',
  'and', 'or', 'is', 'are', 'was', 'were', 'be', 'been', 'has', 'have',
  'had', 'as', 'its', 'it', 'this', 'that', 'from', 'into', 'after',
  'over', 'but', 'not', 'up', 'out', 'about', 'new', 'says', 'say',
  'said', 'amid', 'following', 'report', 'reports', 'reported',
])

/**
 * Normalize a title for similarity comparison.
 * Strips punctuation, stopwords, lowercases, sorts words.
 * Two titles describing the same event should produce identical or very similar hashes.
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')   // strip punctuation
    .replace(/\d+/g, 'NUM')     // normalize numbers (7 killed → NUM killed)
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w))
    .sort()
    .join(' ')
    .trim()
}

/**
 * Source priority for dedup tie-breaking.
 * Lower number = keep this one.
 * Authoritative humanitarian/disaster sources beat news RSS.
 */
export const SOURCE_PRIORITY: Record<string, number> = {
  gdacs: 1,      // disaster alerts — most authoritative
  unhcr: 1,      // UN refugee data — authoritative
  nasa_eonet: 1, // NASA events — authoritative
  usgs: 1,       // seismic data — authoritative
  noaa: 1,       // NWS weather — authoritative
  acled: 1,      // ACLED conflict data — gold standard
  reliefweb: 2,  // UN humanitarian — high quality
  gdelt: 3,      // news aggregator — good breadth
  newsapi: 3,    // broad coverage, lower trust than institutional
  news_rss: 4,   // RSS feeds — lowest priority for dedup purposes
  // state media articles (RT/PressTV/Xinhua) are still news_rss source
  // but naturally rank lowest since higher-priority sources will cover same events
}

/**
 * Generate a 7-character content fingerprint from normalized title.
 * Used as a fast lookup key. Not cryptographic, just for equality.
 */
export function titleFingerprint(title: string): string {
  const normalized = normalizeTitle(title)
  // Simple djb2 hash → base36 string
  let hash = 5381
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash) + normalized.charCodeAt(i)
    hash = hash & hash // Convert to 32-bit integer
  }
  const unsigned = hash >>> 0
  return unsigned.toString(36).padStart(7, '0')
}

/**
 * Similarity score between two normalized titles (0–1).
 * Uses Jaccard similarity on word sets.
 */
export function titleSimilarity(a: string, b: string): number {
  const setA = new Set(normalizeTitle(a).split(' ').filter(Boolean))
  const setB = new Set(normalizeTitle(b).split(' ').filter(Boolean))
  if (setA.size === 0 && setB.size === 0) return 1
  if (setA.size === 0 || setB.size === 0) return 0
  const intersection = new Set([...setA].filter(x => setB.has(x)))
  const union = new Set([...setA, ...setB])
  return intersection.size / union.size
}

/**
 * Dedup and cluster a list of events at query time.
 * Groups events with >0.45 title similarity within a 6-hour window
 * and same broad region/event_type into clusters.
 * Returns one canonical event per cluster with corroboration metadata.
 */
export interface ClusteredEvent<T extends {
  title: string
  occurred_at: string
  source: string
  event_type: string
  region: string | null
  country_code: string | null
}> {
  canonical: T
  corroborated_by: string[]  // list of source names
  source_count: number
  confidence: 'confirmed' | 'corroborated' | 'unverified'
}

export function clusterEvents<T extends {
  title: string
  occurred_at: string
  source: string
  event_type: string
  region: string | null
  country_code: string | null
}>(
  events: T[]
): ClusteredEvent<T>[] {
  const clusters: ClusteredEvent<T>[] = []
  const assigned = new Set<number>()

  // Sort by source priority (most authoritative first)
  const sorted = [...events].sort((a, b) => (SOURCE_PRIORITY[a.source] ?? 5) - (SOURCE_PRIORITY[b.source] ?? 5))

  for (let i = 0; i < sorted.length; i++) {
    if (assigned.has(i)) continue

    const canonical = sorted[i]!
    const cluster: ClusteredEvent<T> = {
      canonical,
      corroborated_by: [canonical.source],
      source_count: 1,
      confidence: 'unverified',
    }

    const canonicalTime = new Date(canonical.occurred_at).getTime()

    for (let j = i + 1; j < sorted.length; j++) {
      if (assigned.has(j)) continue

      const candidate = sorted[j]!
      const candidateTime = new Date(candidate.occurred_at).getTime()

      // Must be within 6 hours
      if (Math.abs(canonicalTime - candidateTime) > 6 * 60 * 60 * 1000) continue

      // Should be same region or event_type (at least one must match)
      const sameRegion = canonical.region && candidate.region && canonical.region === candidate.region
      const sameCountry = canonical.country_code && candidate.country_code && canonical.country_code === candidate.country_code
      const sameEventType = canonical.event_type === candidate.event_type && canonical.event_type !== 'news'

      if (!sameRegion && !sameCountry && !sameEventType) continue

      // Title similarity check
      const sim = titleSimilarity(canonical.title, candidate.title)
      if (sim < 0.45) continue  // below threshold — different story

      // This is a duplicate/corroborating source
      assigned.add(j)
      if (!cluster.corroborated_by.includes(candidate.source)) {
        cluster.corroborated_by.push(candidate.source)
        cluster.source_count++
      }
    }

    assigned.add(i)

    // Assign confidence level based on source count
    if (cluster.source_count >= 3) cluster.confidence = 'confirmed'
    else if (cluster.source_count >= 2) cluster.confidence = 'corroborated'
    else cluster.confidence = 'unverified'

    clusters.push(cluster)
  }

  return clusters
}
