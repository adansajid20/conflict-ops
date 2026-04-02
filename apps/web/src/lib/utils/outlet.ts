const RSS_GARBAGE_PATTERNS = ['rss', 'feed', 'wire', 'network', 'intelligence network', 'conflictradar']

const OUTLET_DISPLAY_NAMES: Record<string, string> = {
  'reuters.com': 'Reuters',
  'apnews.com': 'Associated Press',
  'bbc.com': 'BBC News',
  'bbc.co.uk': 'BBC News',
  'aljazeera.com': 'Al Jazeera',
  'dw.com': 'DW News',
  'france24.com': 'France 24',
  'theguardian.com': 'The Guardian',
  'kyivindependent.com': 'Kyiv Independent',
  'pravda.com.ua': 'Ukrainska Pravda',
  'timesofisrael.com': 'Times of Israel',
  'haaretz.com': 'Haaretz',
  'alarabiya.net': 'Al Arabiya',
  'middleeasteye.net': 'Middle East Eye',
  'foreignpolicy.com': 'Foreign Policy',
  'defensenews.com': 'Defense News',
  'bellingcat.com': 'Bellingcat',
  'crisisgroup.org': 'ICG',
}

export function getOutletDisplay(source?: string | null, sourceId?: string | null): string {
  if (source && !RSS_GARBAGE_PATTERNS.some((pattern) => source.toLowerCase().includes(pattern))) {
    return source
  }

  if (sourceId) {
    try {
      const domain = new URL(sourceId).hostname.replace(/^www\./, '')
      return OUTLET_DISPLAY_NAMES[domain] ?? domain
    } catch {
      // ignore invalid URL
    }
  }

  return 'Intelligence Feed'
}
