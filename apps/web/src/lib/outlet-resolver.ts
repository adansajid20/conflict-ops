/**
 * Shared outlet resolver — ConflictRadar Phase 1
 *
 * Resolves domain/source → human-readable outlet name.
 * Wraps and re-exports from source-display.ts for backwards compatibility.
 * New code should import from here.
 */

export { getPublicSourceName } from '@/lib/utils/source-display'

// Domain → pretty outlet name
const DOMAIN_LABELS: Record<string, string> = {
  'bbc.co.uk': 'BBC',
  'bbc.com': 'BBC',
  'aljazeera.com': 'Al Jazeera',
  'aljazeera.net': 'Al Jazeera',
  'reuters.com': 'Reuters',
  'apnews.com': 'AP News',
  'theguardian.com': 'The Guardian',
  'nytimes.com': 'The New York Times',
  'washingtonpost.com': 'The Washington Post',
  'wsj.com': 'Wall Street Journal',
  'ft.com': 'Financial Times',
  'bloomberg.com': 'Bloomberg',
  'foxnews.com': 'Fox News',
  'cnn.com': 'CNN',
  'nbcnews.com': 'NBC News',
  'cbsnews.com': 'CBS News',
  'abcnews.go.com': 'ABC News',
  'msn.com': 'MSN News',
  'news.google.com': 'Google News',
  'france24.com': 'France 24',
  'dw.com': 'Deutsche Welle',
  'rferl.org': 'Radio Free Europe',
  'voanews.com': 'Voice of America',
  'middleeasteye.net': 'Middle East Eye',
  'haaretz.com': 'Haaretz',
  'timesofisrael.com': 'Times of Israel',
  'jpost.com': 'Jerusalem Post',
  'arabnews.com': 'Arab News',
  'thenationalnews.com': 'The National',
  'dawn.com': 'Dawn',
  'thehindu.com': 'The Hindu',
  'ndtv.com': 'NDTV',
  'scmp.com': 'South China Morning Post',
  'kyivindependent.com': 'Kyiv Independent',
  'kyivpost.com': 'Kyiv Post',
  'ukrinform.net': 'Ukrinform',
  'pravda.com.ua': 'Ukrainska Pravda',
  'tass.com': 'TASS',
  'tass.ru': 'TASS',
  'interfax.com': 'Interfax',
  'africanews.com': 'Africanews',
  'vanguardngr.com': 'Vanguard',
  'punchng.com': 'Punch Nigeria',
  'presstv.ir': 'Press TV',
  'globaltimes.cn': 'Global Times',
  'xinhuanet.com': 'Xinhua',
  'almonitor.com': 'Al-Monitor',
  'al-monitor.com': 'Al-Monitor',
  'theintercept.com': 'The Intercept',
  'foreignpolicy.com': 'Foreign Policy',
  'politico.com': 'Politico',
  'axios.com': 'Axios',
  'theatlantic.com': 'The Atlantic',
  'newsweek.com': 'Newsweek',
  'thetimes.co.uk': 'The Times',
  'telegraph.co.uk': 'The Telegraph',
  'independent.co.uk': 'The Independent',
  'sky.com': 'Sky News',
  'skynews.com': 'Sky News',
  'euronews.com': 'Euronews',
  'sputniknews.com': 'Sputnik',
  'rt.com': 'RT',
  'un.org': 'United Nations',
  'who.int': 'WHO',
  'reliefweb.int': 'ReliefWeb',
  'unhcr.org': 'UNHCR',
  'ocha.org': 'OCHA',
  'unocha.org': 'OCHA',
  'iaea.org': 'IAEA',
  'state.gov': 'US State Dept',
  'acled.info': 'ACLED',
  'breakingdefense.com': 'Breaking Defense',
  'defenseworld.net': 'Defense World',
  'thediplomat.com': 'The Diplomat',
  'crisisgroup.org': 'Crisis Group',
  'bellingcat.com': 'Bellingcat',
  'passblue.com': 'PassBlue',
  'amnesty.org': 'Amnesty International',
  'aawsat.com': 'Asharq Al-Awsat',
  'naharnet.com': 'Naharnet',
  'aa.com.tr': 'Anadolu Agency',
  'theprint.in': 'The Print',
  'indiatimes.com': 'Times of India',
  'abc.net.au': 'ABC Australia',
  'smh.com.au': 'Sydney Morning Herald',
  'globalvoices.org': 'Global Voices',
}

/**
 * Official internal source → display name mapping.
 */
const OFFICIAL_SOURCES: Record<string, string> = {
  reliefweb: 'ReliefWeb',
  unhcr: 'UNHCR',
  gdacs: 'GDACS',
  noaa: 'NOAA Weather',
  usgs: 'USGS',
  nasa_eonet: 'NASA EONET',
  'nasa-eonet': 'NASA EONET',
  acled: 'ACLED',
  gdelt: 'Global News',
  news_rss: 'News Wire',
  newsapi: 'News Wire',
}

/**
 * Prettify a domain name to a known outlet label.
 * Falls back to capitalizing the base domain segment.
 */
export function prettifyDomain(domain: string): string | null {
  if (!domain) return null
  const clean = domain.replace(/^www\./, '').toLowerCase()
  if (DOMAIN_LABELS[clean]) return DOMAIN_LABELS[clean]!
  const base = clean.split('.')[0] ?? clean
  return base.charAt(0).toUpperCase() + base.slice(1)
}

/**
 * Extract outlet name from GDELT-style title suffix.
 * Example: "Ukraine forces repel attack - Reuters" → "Reuters"
 */
export function extractOutletFromTitle(title: string): string | null {
  if (!title) return null
  const match = title.match(/\s[-–|]\s([A-Z][A-Za-z0-9&'. ]{1,44})\s*$/)
  if (!match) return null
  const candidate = (match[1] ?? '').trim()
  if (candidate.length < 2 || candidate.length > 45) return null
  if (/\s[-–|]\s/.test(candidate)) return null
  if (
    /^(a |an |in |on |at |for |of |and |or |but |with |from |to |is |are |was |says |report|update|analysis|breaking|watch|live)/i.test(
      candidate
    )
  )
    return null
  return candidate
}

/**
 * Resolve the best outlet name for a given event.
 * Priority: provenance_raw.source > domain lookup > title suffix > fallback.
 */
export function resolveOutletName(
  source: string | null | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provenanceRaw?: Record<string, any> | null,
  title?: string | null
): string {
  const src = (source ?? '').toLowerCase()

  // Official sources — fixed names
  if (OFFICIAL_SOURCES[src]) return OFFICIAL_SOURCES[src]!

  // news_rss and newsapi: provenance_raw.source is the outlet name
  if (src === 'news_rss' || src === 'newsapi') {
    const fromProv = provenanceRaw?.source as string | undefined
    return fromProv ?? 'News Wire'
  }

  // GDELT: try domain → title suffix fallback
  if (src === 'gdelt') {
    const domain = provenanceRaw?.domain as string | undefined
    const domainLabel = domain ? prettifyDomain(domain) : null
    if (!domainLabel || domainLabel === 'Google News') {
      const fromTitle = title ? extractOutletFromTitle(title) : null
      if (fromTitle) return fromTitle
    }
    return domainLabel ?? 'Global News'
  }

  return src || 'Unknown'
}
