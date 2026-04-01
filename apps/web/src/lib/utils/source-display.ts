/**
 * Returns a user-facing source name.
 * Hides pipeline internals (GDELT, NewsAPI, news_rss) — shows actual outlet instead.
 */

// Domain → pretty outlet name for GDELT articles
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
  'ukrinform.net': 'Ukrinform',
  'pravda.com.ua': 'Ukrainska Pravda',
  'tass.com': 'TASS',
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
  'euronews.com': 'Euronews',
  'sputniknews.com': 'Sputnik',
  'rt.com': 'RT',
  'un.org': 'United Nations',
  'who.int': 'WHO',
  'reliefweb.int': 'ReliefWeb',
  'unhcr.org': 'UNHCR',
}

function prettifyDomain(domain: string): string | null {
  if (!domain) return null
  const clean = domain.replace(/^www\./, '').toLowerCase()
  if (DOMAIN_LABELS[clean]) return DOMAIN_LABELS[clean]
  // Capitalize first segment: "kyivpost.com" → "Kyivpost"
  const base = clean.split('.')[0] ?? clean
  return base.charAt(0).toUpperCase() + base.slice(1)
}

/**
 * Extract outlet name from GDELT title suffix pattern.
 * GDELT often uses Google News URLs, but includes " - The Hindu" or " | Reuters" at end of title.
 */
function extractOutletFromTitle(title: string): string | null {
  if (!title) return null
  // Require strict " - Outlet" or " | Outlet" separator at end of title
  // Outlet name: 2-45 chars, starts uppercase, no embedded dashes or pipes (those indicate it's still part of title)
  const match = title.match(/\s[-–|]\s([A-Z][A-Za-z0-9&'. ]{1,44})\s*$/)
  if (!match) return null
  const candidate = (match[1] ?? '').trim()
  if (candidate.length < 2 || candidate.length > 45) return null
  // Reject if it contains " - " or " | " — means it's a compound phrase, not an outlet name
  if (/\s[-–|]\s/.test(candidate)) return null
  // Reject generic sentence-starter words — but NOT "The X" publications (The Guardian, The Hindu etc.)
  if (/^(a |an |in |on |at |for |of |and |or |but |with |from |to |is |are |was |says |report|update|analysis|breaking|watch|live)/i.test(candidate)) return null
  return candidate
}

// eslint-disable-next-line 
export function getPublicSourceName(source: string | null | undefined, provenanceRaw?: Record<string, any> | null, title?: string | null): string {
  const src = source ?? ''

  // news_rss and newsapi: provenance_raw.source IS the outlet name (e.g. "BBC World")
  if (src === 'news_rss' || src === 'newsapi') {
    return (provenanceRaw?.source as string | undefined) ?? 'News Wire'
  }

  // GDELT: show actual outlet, not "GDELT Project" or "Google News"
  if (src === 'gdelt') {
    const domain = provenanceRaw?.domain as string | undefined
    const domainLabel = domain ? prettifyDomain(domain) : null

    // If domain maps to "Google News", try to extract real outlet from title suffix
    if (!domainLabel || domainLabel === 'Google News') {
      const fromTitle = title ? extractOutletFromTitle(title) : null
      if (fromTitle) return fromTitle
    }

    return domainLabel ?? 'Global News'
  }

  // Official/authoritative sources — show clean public names
  const OFFICIAL: Record<string, string> = {
    reliefweb:    'ReliefWeb',
    unhcr:        'UNHCR',
    gdacs:        'GDACS',
    noaa:         'NOAA Weather',
    usgs:         'USGS',
    nasa_eonet:   'NASA',
    'nasa-eonet': 'NASA',
    acled:        'ACLED',
  }
  return OFFICIAL[src] ?? src
}
