/** Shared outlet resolver */

export { getPublicSourceName } from '@/lib/utils/source-display'

const DOMAIN_TO_OUTLET: Record<string, string> = {
  'bbc.co.uk': 'BBC', 'bbc.com': 'BBC', 'aljazeera.com': 'Al Jazeera', 'aljazeera.net': 'Al Jazeera', 'reuters.com': 'Reuters', 'apnews.com': 'AP News', 'theguardian.com': 'The Guardian', 'nytimes.com': 'The New York Times', 'washingtonpost.com': 'The Washington Post', 'wsj.com': 'Wall Street Journal', 'ft.com': 'Financial Times', 'bloomberg.com': 'Bloomberg', 'foxnews.com': 'Fox News', 'cnn.com': 'CNN', 'nbcnews.com': 'NBC News', 'cbsnews.com': 'CBS News', 'abcnews.go.com': 'ABC News', 'msn.com': 'MSN News', 'news.google.com': 'Google News', 'france24.com': 'France 24', 'dw.com': 'Deutsche Welle', 'rferl.org': 'Radio Free Europe', 'voanews.com': 'Voice of America', 'middleeasteye.net': 'Middle East Eye', 'haaretz.com': 'Haaretz', 'timesofisrael.com': 'Times of Israel', 'jpost.com': 'Jerusalem Post', 'arabnews.com': 'Arab News', 'thenationalnews.com': 'The National', 'dawn.com': 'Dawn', 'thehindu.com': 'The Hindu', 'ndtv.com': 'NDTV', 'scmp.com': 'South China Morning Post', 'kyivindependent.com': 'Kyiv Independent', 'kyivpost.com': 'Kyiv Post', 'ukrinform.net': 'Ukrinform', 'pravda.com.ua': 'Ukrainska Pravda', 'tass.com': 'TASS', 'tass.ru': 'TASS', 'interfax.com': 'Interfax', 'africanews.com': 'Africanews', 'vanguardngr.com': 'Vanguard', 'punchng.com': 'Punch Nigeria', 'presstv.ir': 'Press TV', 'globaltimes.cn': 'Global Times', 'xinhuanet.com': 'Xinhua', 'almonitor.com': 'Al-Monitor', 'al-monitor.com': 'Al-Monitor', 'theintercept.com': 'The Intercept', 'foreignpolicy.com': 'Foreign Policy', 'politico.com': 'Politico', 'axios.com': 'Axios', 'theatlantic.com': 'The Atlantic', 'newsweek.com': 'Newsweek', 'thetimes.co.uk': 'The Times', 'telegraph.co.uk': 'The Telegraph', 'independent.co.uk': 'The Independent', 'sky.com': 'Sky News', 'skynews.com': 'Sky News', 'euronews.com': 'Euronews', 'sputniknews.com': 'Sputnik', 'rt.com': 'RT', 'un.org': 'United Nations', 'who.int': 'WHO', 'reliefweb.int': 'ReliefWeb', 'unhcr.org': 'UNHCR', 'ocha.org': 'OCHA', 'unocha.org': 'OCHA', 'iaea.org': 'IAEA', 'state.gov': 'US State Dept', 'acled.info': 'ACLED',
}

const SOURCE_TO_OUTLET: Record<string, string | null> = {
  acled: 'ConflictRadar Intelligence Network',
  reliefweb: 'Humanitarian Intelligence',
  unhcr: 'Humanitarian Intelligence',
  usgs: 'Seismic Monitor',
  eonet: 'Seismic Monitor',
  gdacs: 'Disaster Alert Network',
  nasa_firms: 'Thermal Intelligence',
  newsapi: null,
  cloudflare_radar: 'Internet Disruption Monitor',
}

export function prettifyDomain(domain: string): string | null {
  if (!domain) return null
  const clean = domain.replace(/^www\./, '').toLowerCase()
  if (DOMAIN_TO_OUTLET[clean]) return DOMAIN_TO_OUTLET[clean]
  const base = clean.split('.')[0] ?? clean
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : null
}

export function extractOutletFromTitle(title: string): string | null {
  if (!title) return null
  const match = title.match(/\s[-–|]\s([A-Z][A-Za-z0-9&'. ]{1,44})\s*$/)
  if (!match) return null
  const candidate = (match[1] ?? '').trim()
  if (candidate.length < 2 || candidate.length > 45) return null
  if (/\s[-–|]\s/.test(candidate)) return null
  if (/^(a |an |in |on |at |for |of |and |or |but |with |from |to |is |are |was |says |report|update|analysis|breaking|watch|live)/i.test(candidate)) return null
  return candidate
}

function resolveFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return prettifyDomain(new URL(url).hostname)
  } catch {
    return null
  }
}

export function resolveOutletName(source: string | null | undefined, provenanceRaw?: Record<string, any> | null, title?: string | null): string {
  const src = (source ?? '').toLowerCase().replace(/-/g, '_')
  const explicitOutlet = typeof provenanceRaw?.outlet_name === 'string' ? provenanceRaw.outlet_name.trim() : ''
  if (explicitOutlet) return explicitOutlet

  const dbOutlet = typeof provenanceRaw?.source === 'string' && src !== 'newsapi' && src !== 'news_rss' ? '' : ''
  void dbOutlet

  const outletFromDbField = typeof provenanceRaw?.outlet_name === 'string' ? provenanceRaw.outlet_name.trim() : ''
  if (outletFromDbField) return outletFromDbField

  const url = (provenanceRaw?.url as string | undefined)
    ?? (provenanceRaw?.SOURCEURL as string | undefined)
    ?? (provenanceRaw?.ActionGeo_SourceURL as string | undefined)
  const domainResolved = resolveFromUrl(url) ?? prettifyDomain((provenanceRaw?.domain as string | undefined) ?? '')
  if (domainResolved && domainResolved !== 'Google News') return domainResolved

  if (src === 'gdelt' || src.startsWith('gdelt')) {
    return title ? (extractOutletFromTitle(title) ?? 'ConflictRadar Intelligence Network') : 'ConflictRadar Intelligence Network'
  }
  if (src === 'newsapi') {
    const publisher = provenanceRaw?.source as string | undefined
    if (publisher?.trim()) return publisher.trim()
  }

  const mapped = SOURCE_TO_OUTLET[src]
  if (mapped) return mapped

  return 'ConflictRadar Intelligence Network'
}
