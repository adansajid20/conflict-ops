import { createServiceClient } from '@/lib/supabase/server'
import { titleFingerprint } from './dedup'

const NEWS_SOURCES = [
  // === TIER A — Wire services & UN (highest reliability) ===
  { name: 'AP News',                  url: 'https://apnews.com/hub/world-news?format=rss',                                                                   tier: 'A',  region: null },
  { name: 'WHO News',                 url: 'https://www.who.int/rss-feeds/news-english.xml',                                                                 tier: 'A',  region: null },
  { name: 'UN News',                  url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml',                                                         tier: 'A',  region: null },
  { name: 'UN Peace & Security',      url: 'https://news.un.org/feed/subscribe/en/news/topic/peace-and-security/rss.xml',                                    tier: 'A',  region: null },
  { name: 'UN Humanitarian',          url: 'https://news.un.org/feed/subscribe/en/news/topic/humanitarian-affairs/rss.xml',                                  tier: 'A',  region: null },
  { name: 'Bellingcat',               url: 'https://www.bellingcat.com/feed/',                                                                               tier: 'A',  region: null },
  { name: 'Crisis Group',             url: 'https://www.crisisgroup.org/rss-0',                                                                              tier: 'A',  region: null },

  // === TIER A — Major international broadcasters ===
  { name: 'BBC World',                url: 'https://feeds.bbci.co.uk/news/world/rss.xml',                                                                    tier: 'A',  region: null },
  { name: 'BBC Africa',               url: 'https://www.bbc.co.uk/news/world/africa/rss.xml',                                                                tier: 'A',  region: 'Africa' },
  { name: 'BBC Asia',                 url: 'https://www.bbc.co.uk/news/world/asia/rss.xml',                                                                  tier: 'A',  region: 'Asia' },
  { name: 'BBC Europe',               url: 'https://www.bbc.co.uk/news/world/europe/rss.xml',                                                                tier: 'A',  region: 'Europe' },
  { name: 'BBC Middle East',          url: 'https://www.bbc.co.uk/news/world/middle_east/rss.xml',                                                           tier: 'A',  region: 'Middle East' },
  { name: 'BBC Latin America',        url: 'https://www.bbc.co.uk/news/world/latin_america/rss.xml',                                                         tier: 'A',  region: 'Latin America' },
  { name: 'Al Jazeera',              url: 'https://www.aljazeera.com/xml/rss/all.xml',                                                                      tier: 'A',  region: null },
  { name: 'France 24',                url: 'https://www.france24.com/en/rss',                                                                                tier: 'A',  region: null },
  { name: 'NPR World',                url: 'https://feeds.npr.org/1004/rss.xml',                                                                             tier: 'A',  region: null },

  // === TIER B+ — Quality international news ===
  { name: 'Deutsche Welle',           url: 'https://rss.dw.com/rdf/rss-en-top',                                                                              tier: 'B+', region: null },
  { name: 'DW Africa',                url: 'https://rss.dw.com/rdf/rss-en-africa',                                                                           tier: 'B+', region: 'Africa' },
  { name: 'DW Middle East',           url: 'https://rss.dw.com/rdf/rss-en-middle-east',                                                                      tier: 'B+', region: 'Middle East' },
  { name: 'The Guardian World',       url: 'https://www.theguardian.com/world/rss',                                                                          tier: 'B+', region: null },
  { name: 'Sky News World',           url: 'https://feeds.skynews.com/feeds/rss/world.xml',                                                                  tier: 'B+', region: null },
  { name: 'Financial Times World',    url: 'https://www.ft.com/world?format=rss',                                                                            tier: 'B+', region: null },
  { name: 'New York Times World',     url: 'https://www.nytimes.com/svc/collections/v1/publish/https://www.nytimes.com/section/world/rss.xml',              tier: 'B+', region: null },
  { name: 'Le Monde International',   url: 'https://www.lemonde.fr/international/rss_full.xml',                                                              tier: 'B+', region: null },

  // === TIER B — Analysis & specialist ===
  { name: 'Foreign Policy',           url: 'https://foreignpolicy.com/feed/',                                                                                tier: 'B',  region: null },
  { name: 'The Diplomat',             url: 'https://thediplomat.com/feed/',                                                                                  tier: 'B',  region: 'Asia' },
  { name: 'Geopolitical Futures',     url: 'https://www.geopoliticalfutures.com/feed/',                                                                      tier: 'B',  region: null },
  { name: 'Global Voices',            url: 'https://globalvoices.org/feed/',                                                                                 tier: 'B',  region: null },

  // === Defense & Security ===
  { name: 'Defense World',            url: 'https://www.defenseworld.net/news/rss',                                                                          tier: 'B',  region: null },
  { name: 'Breaking Defense',         url: 'https://breakingdefense.com/feed/',                                                                              tier: 'B',  region: null },

  // === Middle East / MENA ===
  { name: 'Middle East Eye',          url: 'https://www.middleeasteye.net/rss',                                                                              tier: 'B+', region: 'Middle East' },
  { name: 'Al-Monitor',               url: 'https://www.al-monitor.com/rss.xml',                                                                             tier: 'B+', region: 'Middle East' },
  { name: 'Anadolu Agency',           url: 'https://www.aa.com.tr/en/rss/default?cat=world',                                                                 tier: 'B',  region: null },
  { name: 'Naharnet (Lebanon)',        url: 'https://www.naharnet.com/rss',                                                                                   tier: 'B',  region: 'Middle East' },

  // === South Asia ===
  { name: 'Dawn (Pakistan)',           url: 'https://www.dawn.com/feeds/home',                                                                                tier: 'B+', region: 'South Asia' },
  { name: 'The Print (India)',         url: 'https://theprint.in/feed/',                                                                                      tier: 'B',  region: 'South Asia' },
  { name: 'The Hindu',                 url: 'https://www.thehindu.com/news/international/feeder/default.rss',                                                 tier: 'B',  region: 'South Asia' },
  { name: 'Times of India',           url: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',                                                      tier: 'B',  region: 'South Asia' },

  // === East Asia / Pacific ===
  { name: 'South China Morning Post', url: 'https://www.scmp.com/rss/91/feed',                                                                               tier: 'B+', region: 'East Asia' },
  { name: 'ABC Australia',            url: 'https://www.abc.net.au/news/feed/51120/rss.xml',                                                                 tier: 'B',  region: 'Asia Pacific' },
  { name: 'Sydney Morning Herald',    url: 'https://www.smh.com.au/rss/world.xml',                                                                           tier: 'B',  region: 'Asia Pacific' },

  // === Eastern Europe ===
  { name: 'Kyiv Post',                url: 'https://kyivpost.com/feed',                                                                                      tier: 'B+', region: 'Eastern Europe' },

  // === Energy / Resources (for conflict angle) ===
  { name: 'OilPrice.com',             url: 'https://oilprice.com/rss/main',                                                                                  tier: 'B',  region: null },

  // === Additional BBC Regional ===
  { name: 'BBC Americas',              url: 'https://www.bbc.co.uk/news/world/us_and_canada/rss.xml',          tier: 'A',  region: 'North America' },

  // === DW Additional Regional ===
  { name: 'DW Asia',                   url: 'https://rss.dw.com/rdf/rss-en-asia',                               tier: 'B+', region: 'Asia' },
  { name: 'DW Europe',                 url: 'https://rss.dw.com/rdf/rss-en-europe',                             tier: 'B+', region: 'Europe' },
  { name: 'DW Americas',               url: 'https://rss.dw.com/rdf/rss-en-americas',                           tier: 'B+', region: 'Latin America' },

  // === France 24 Regional ===
  { name: 'France 24 Africa',          url: 'https://www.france24.com/en/africa/rss',                           tier: 'A',  region: 'Africa' },
  { name: 'France 24 Middle East',     url: 'https://www.france24.com/en/middle-east/rss',                      tier: 'A',  region: 'Middle East' },
  { name: 'France 24 Asia-Pacific',    url: 'https://www.france24.com/en/asia-pacific/rss',                     tier: 'A',  region: 'Asia' },
  { name: 'France 24 Europe',          url: 'https://www.france24.com/en/europe/rss',                           tier: 'A',  region: 'Europe' },
  { name: 'France 24 Americas',        url: 'https://www.france24.com/en/americas/rss',                         tier: 'A',  region: 'Latin America' },

  // === Official / Institutional ===
  { name: 'US State Dept',             url: 'https://www.state.gov/feed/',                                      tier: 'A',  region: null },
  { name: 'State Dept Press',          url: 'https://www.state.gov/press-releases/feed/',                       tier: 'A',  region: null },
  { name: 'OCHA',                      url: 'https://www.unocha.org/rss.xml',                                   tier: 'A',  region: null },
  { name: 'IAEA',                      url: 'https://www.iaea.org/feeds/news',                                  tier: 'A',  region: null },
  { name: 'Amnesty International',     url: 'https://www.amnesty.org/en/feed/',                                 tier: 'A',  region: null },
  { name: 'PassBlue (UN)',             url: 'https://www.passblue.com/feed/',                                   tier: 'B+', region: null },

  // === MENA Regional ===
  { name: 'Asharq Al-Awsat',           url: 'https://english.aawsat.com/feed',                                  tier: 'B+', region: 'Middle East' },
  { name: 'Jerusalem Post',            url: 'https://www.jpost.com/rss/rssfeedsfrontpage.aspx',                 tier: 'B+', region: 'Middle East' },
  { name: 'Times of Israel',           url: 'https://www.timesofisrael.com/feed/',                              tier: 'B+', region: 'Middle East' },
  { name: 'Al Bawaba',                 url: 'https://www.albawaba.com/rss.xml',                                 tier: 'B',  region: 'Middle East' },
  { name: 'Kurdistan 24',              url: 'https://www.kurdistan24.net/en/rss.xml',                           tier: 'B',  region: 'Middle East' },

  // === Africa ===
  { name: 'Dabanga Sudan',             url: 'https://www.dabangasudan.org/en/feed',                             tier: 'B+', region: 'Africa' },
  { name: 'Africanews',                url: 'https://www.africanews.com/feed',                                  tier: 'B',  region: 'Africa' },

  // === Asia-Pacific ===
  { name: 'Channel NewsAsia',          url: 'https://www.channelnewsasia.com/rssfeeds/8395986',                 tier: 'B+', region: 'Asia' },

  // === Defense & Military ===
  { name: 'The Defense Post',          url: 'https://www.thedefensepost.com/feed/',                             tier: 'B',  region: null },
  { name: 'Military Times',            url: 'https://www.militarytimes.com/arc/outboundfeeds/rss/',             tier: 'B',  region: null },
  { name: 'War on the Rocks',          url: 'https://warontherocks.com/feed/',                                  tier: 'B+', region: null },

  // === Think Tanks / Policy Analysis ===
  { name: 'Carnegie Endowment',        url: 'https://carnegieendowment.org/rss/solr/articles',                  tier: 'B+', region: null },
  { name: 'Brookings Institution',     url: 'https://www.brookings.edu/feed/',                                  tier: 'B+', region: null },
  { name: 'Euronews',                  url: 'https://www.euronews.com/rss?level=theme&name=news',               tier: 'B+', region: 'Europe' },
  { name: 'Politico Europe',           url: 'https://www.politico.eu/rss',                                      tier: 'B+', region: 'Europe' },
  { name: 'The Independent',           url: 'https://www.independent.co.uk/news/world/rss',                    tier: 'B+', region: null },

  // === State Media (tagged for transparency — included for perspective diversity) ===
  // These are state-controlled outlets; included to capture events those govts want publicized.
  // Confidence scores naturally lower (single source) when only state media reports.
  { name: 'Xinhua (China)',            url: 'https://www.xinhuanet.com/english/rss/worldrss.xml',              tier: 'C',  region: null },
  { name: 'RT (Russia)',               url: 'https://www.rt.com/rss/news/',                                     tier: 'C',  region: null },
  { name: 'PressTV (Iran)',            url: 'https://www.presstv.ir/RSS',                                       tier: 'C',  region: null },
  { name: 'Global Times (China)',      url: 'https://www.globaltimes.cn/rss/outbrain.xml',                      tier: 'C',  region: null },
] as const

// Keyword → severity scoring
const CRITICAL_KEYWORDS = ['killed', 'airstrike', 'bombing', 'missile', 'explosion', 'massacre', 'mass casualty', 'war declaration', 'invasion', 'offensive', 'siege', 'genocide', 'chemical weapon']
const HIGH_KEYWORDS     = ['attack', 'troops', 'military', 'armed', 'casualties', 'wounded', 'occupied', 'conflict', 'fighting', 'combat', 'gunfire', 'clashes']
const MEDIUM_KEYWORDS   = ['protest', 'tension', 'sanctions', 'displaced', 'humanitarian', 'refugee', 'crisis', 'coup', 'arrested', 'detained', 'border', 'blockade', 'ceasefire', 'negotiations']

function scoreSeverity(text: string): 1 | 2 | 3 | 4 {
  const lower = text.toLowerCase()
  if (CRITICAL_KEYWORDS.some(k => lower.includes(k))) return 4
  if (HIGH_KEYWORDS.some(k => lower.includes(k))) return 3
  if (MEDIUM_KEYWORDS.some(k => lower.includes(k))) return 2
  return 1
}

// Country/region keyword detection
const COUNTRY_HINTS: Array<{ keywords: string[]; country: string; code: string; region: string }> = [
  { keywords: ['ukraine', 'ukrainian', 'kyiv', 'zelenskyy', 'donbas', 'kharkiv', 'odesa'],                          country: 'Ukraine',       code: 'UA', region: 'Eastern Europe' },
  { keywords: ['russia', 'russian', 'moscow', 'kremlin', 'putin'],                                                    country: 'Russia',        code: 'RU', region: 'Eastern Europe' },
  { keywords: ['israel', 'israeli', 'gaza', 'hamas', 'tel aviv', 'west bank', 'netanyahu', 'idf'],                   country: 'Israel',        code: 'IL', region: 'Middle East' },
  { keywords: ['iran', 'iranian', 'tehran', 'irgc', 'khamenei'],                                                      country: 'Iran',          code: 'IR', region: 'Middle East' },
  { keywords: ['syria', 'syrian', 'damascus', 'aleppo'],                                                              country: 'Syria',         code: 'SY', region: 'Middle East' },
  { keywords: ['iraq', 'iraqi', 'baghdad', 'mosul'],                                                                  country: 'Iraq',          code: 'IQ', region: 'Middle East' },
  { keywords: ['yemen', 'yemeni', 'houthi', 'sanaa'],                                                                 country: 'Yemen',         code: 'YE', region: 'Middle East' },
  { keywords: ['saudi arabia', 'saudi', 'riyadh'],                                                                    country: 'Saudi Arabia',  code: 'SA', region: 'Middle East' },
  { keywords: ['sudan', 'sudanese', 'khartoum', 'darfur', 'rsf'],                                                    country: 'Sudan',         code: 'SD', region: 'Africa' },
  { keywords: ['ethiopia', 'ethiopian', 'addis ababa', 'tigray', 'amhara'],                                          country: 'Ethiopia',      code: 'ET', region: 'Africa' },
  { keywords: ['somalia', 'somali', 'mogadishu', 'al-shabaab'],                                                      country: 'Somalia',       code: 'SO', region: 'Africa' },
  { keywords: ['nigeria', 'nigerian', 'abuja', 'lagos', 'boko haram'],                                               country: 'Nigeria',       code: 'NG', region: 'Africa' },
  { keywords: ['sahel', 'mali', 'malian', 'burkina faso', 'niger', 'niamey'],                                        country: 'Mali',          code: 'ML', region: 'Africa' },
  { keywords: ['congo', 'drc', 'kinshasa', 'eastern congo', 'm23'],                                                  country: 'DR Congo',      code: 'CD', region: 'Africa' },
  { keywords: ['myanmar', 'burma', 'burmese', 'yangon', 'naypyidaw', 'junta'],                                      country: 'Myanmar',       code: 'MM', region: 'Southeast Asia' },
  { keywords: ['china', 'chinese', 'beijing', 'xi jinping', 'taiwan strait'],                                        country: 'China',         code: 'CN', region: 'East Asia' },
  { keywords: ['taiwan', 'taiwanese', 'taipei'],                                                                      country: 'Taiwan',        code: 'TW', region: 'East Asia' },
  { keywords: ['north korea', 'dprk', 'pyongyang', 'kim jong'],                                                      country: 'North Korea',   code: 'KP', region: 'East Asia' },
  { keywords: ['pakistan', 'pakistani', 'islamabad', 'lahore', 'ttp'],                                              country: 'Pakistan',      code: 'PK', region: 'South Asia' },
  { keywords: ['afghanistan', 'afghan', 'kabul', 'taliban'],                                                          country: 'Afghanistan',   code: 'AF', region: 'South Asia' },
  { keywords: ['india', 'indian', 'new delhi', 'kashmir', 'modi'],                                                  country: 'India',         code: 'IN', region: 'South Asia' },
  { keywords: ['venezuela', 'venezuelan', 'caracas', 'maduro'],                                                      country: 'Venezuela',     code: 'VE', region: 'Latin America' },
  { keywords: ['haiti', 'haitian', 'port-au-prince', 'gang'],                                                        country: 'Haiti',         code: 'HT', region: 'Latin America' },
  { keywords: ['colombia', 'colombian', 'bogota', 'farc', 'eln'],                                                    country: 'Colombia',      code: 'CO', region: 'Latin America' },
  { keywords: ['lebanon', 'lebanese', 'beirut', 'hezbollah'],                                                        country: 'Lebanon',       code: 'LB', region: 'Middle East' },
  { keywords: ['turkey', 'turkish', 'ankara', 'erdogan', 'pkk'],                                                    country: 'Turkey',        code: 'TR', region: 'Middle East' },
  { keywords: ['libya', 'libyan', 'tripoli', 'benghazi'],                                                            country: 'Libya',         code: 'LY', region: 'Middle East' },
]

function detectLocation(text: string): { country_code: string | null; region: string | null } {
  const lower = text.toLowerCase()
  for (const hint of COUNTRY_HINTS) {
    if (hint.keywords.some(k => lower.includes(k))) {
      return { country_code: hint.code, region: hint.region }
    }
  }
  return { country_code: null, region: null }
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

interface RssItem {
  title: string
  link: string
  pubDate: string | null
  description: string
  sourceName: string
}

function parseRSS(xml: string, sourceName: string): RssItem[] {
  const items: RssItem[] = []
  const itemBlocks = [...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)].map(m => m[1] ?? '')

  for (const block of itemBlocks) {
    // title — handle CDATA and plain
    const titleMatch =
      block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ??
      block.match(/<title>([\s\S]*?)<\/title>/)
    const title = titleMatch ? stripTags(titleMatch[1]!) : ''
    if (!title) continue

    // link
    const linkMatch =
      block.match(/<link>([\s\S]*?)<\/link>/) ??
      block.match(/<link[^>]+href="([^"]+)"/)
    const link = linkMatch ? linkMatch[1]!.trim() : ''
    if (!link || link.startsWith('<') || link.length < 10) continue

    // pubDate
    const pubMatch =
      block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) ??
      block.match(/<dc:date>([\s\S]*?)<\/dc:date>/) ??
      block.match(/<published>([\s\S]*?)<\/published>/)
    const pubDate = pubMatch ? pubMatch[1]!.trim() : null

    // description
    const descMatch =
      block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ??
      block.match(/<description>([\s\S]*?)<\/description>/)
    const description = descMatch ? stripTags(descMatch[1]!).slice(0, 800) : ''

    items.push({ title, link, pubDate, description, sourceName })
  }

  return items
}

// Allowlist of event_types that are conflict/security relevant
const RELEVANT_EVENT_TYPES = new Set([
  'airstrike', 'armed_conflict', 'terrorism', 'political_crisis',
  'civil_unrest', 'displacement', 'humanitarian', 'wmd_threat',
  'natural_disaster', 'economic',
])

// Conflict-relevant keyword gate — drops pure entertainment/tech/lifestyle news
const RELEVANCE_KEYWORDS = [
  'war', 'conflict', 'attack', 'kill', 'dead', 'wound', 'bomb', 'missile',
  'strike', 'soldier', 'troop', 'military', 'army', 'navy', 'air force',
  'refugee', 'displaced', 'evacuation', 'humanitarian', 'aid', 'famine',
  'coup', 'protest', 'riot', 'uprising', 'rebel', 'militia', 'terrorist',
  'sanction', 'embargo', 'ceasefire', 'peace', 'treaty', 'diplomacy',
  'earthquake', 'flood', 'cyclone', 'hurricane', 'wildfire', 'disaster',
  'nuclear', 'chemical', 'weapon', 'ammunition', 'artillery', 'drone',
  'border', 'blockade', 'siege', 'hostage', 'captured', 'prisoner',
  'genocide', 'massacre', 'ethnic', 'occupation', 'annexation',
  'nato', 'un ', 'united nations', 'security council', 'iaea',
  'iran', 'russia', 'ukraine', 'gaza', 'israel', 'hamas', 'hezbollah',
  'sudan', 'myanmar', 'somalia', 'yemen', 'syria', 'iraq', 'afghanistan',
  'north korea', 'taiwan strait', 'south china sea',
]

function isConflictRelevant(title: string, description: string, eventType: string): boolean {
  // Always keep explicitly typed events (scored above 'news')
  if (RELEVANT_EVENT_TYPES.has(eventType)) return true
  // For generic 'news' type, require at least one conflict keyword
  const combined = `${title} ${description}`.toLowerCase()
  return RELEVANCE_KEYWORDS.some(kw => combined.includes(kw))
}

function detectEventType(text: string): string {
  const lower = text.toLowerCase()
  if (/airstrike|bombing|missile|rocket|artillery/.test(lower)) return 'airstrike'
  if (/attack|assault|offensive|invasion/.test(lower)) return 'armed_conflict'
  if (/earthquake|flood|hurricane|wildfire|tsunami|cyclone|volcano/.test(lower)) return 'natural_disaster'
  if (/refugee|displaced|evacuation|exodus/.test(lower)) return 'displacement'
  if (/humanitarian|aid|famine|starvation|food crisis/.test(lower)) return 'humanitarian'
  if (/protest|demonstration|riot|uprising/.test(lower)) return 'civil_unrest'
  if (/coup|overthrow|junta|military takeover/.test(lower)) return 'political_crisis'
  if (/sanctions|embargo|tariff/.test(lower)) return 'economic'
  if (/nuclear|chemical|biological weapon/.test(lower)) return 'wmd_threat'
  if (/terror|terrorist|extremist/.test(lower)) return 'terrorism'
  return 'news'
}

export async function ingestNewsRSS(): Promise<{
  stored: number
  skipped: number
  errors: number
  sources_ok: number
}> {
  const supabase = createServiceClient()
  let stored = 0, skipped = 0, errors = 0, sources_ok = 0
  const toUpsert: Array<Record<string, unknown>> = []

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000) // 48h lookback window

  // Pre-flight: batch-fetch recent event titles to build a fingerprint set for cross-source dedup
  const { data: recentTitles } = await supabase
    .from('events')
    .select('title')
    .gte('ingested_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(2000)

  const recentFingerprintSet = new Set(
    (recentTitles ?? []).map((e: { title: string }) => titleFingerprint(e.title))
  )

  // Fetch all feeds in parallel with timeout
  const fetchResults = await Promise.allSettled(
    NEWS_SOURCES.map(async (src) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 12000)
      try {
        const res = await fetch(src.url, {
          headers: {
            'User-Agent': 'ConflictOps/1.0 (conflictradar.co; RSS reader)',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          },
          signal: controller.signal,
        })
        clearTimeout(timeout)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const xml = await res.text()
        return { src, xml }
      } catch (e) {
        clearTimeout(timeout)
        throw e
      }
    })
  )

  // Process each feed result
  for (const result of fetchResults) {
    if (result.status === 'rejected') { errors++; continue }

    const { src, xml } = result.value
    sources_ok++
    const items = parseRSS(xml, src.name)

    for (const item of items) {
      // Parse date
      let occurredAt: string
      if (item.pubDate) {
        const d = new Date(item.pubDate)
        if (isNaN(d.getTime()) || d < cutoff) continue
        occurredAt = d.toISOString()
      } else {
        occurredAt = new Date().toISOString()
      }

      if (new Date(occurredAt) < cutoff) continue

      // Cross-source dedup: skip if a similar title was already ingested in the last 24h
      const fp = titleFingerprint(item.title)
      if (recentFingerprintSet.has(fp)) {
        skipped++
        continue
      }
      // Add to set so we don't ingest duplicates within this run either
      recentFingerprintSet.add(fp)

      const fullText = `${item.title} ${item.description}`

      // Conflict relevance gate — drop PS5 pricing, iPhone hacking, etc.
      const evType = detectEventType(fullText)
      if (!isConflictRelevant(item.title, item.description, evType)) {
        skipped++
        continue
      }

      const severity = scoreSeverity(fullText)
      const loc = detectLocation(fullText)
      const region = loc.region ?? src.region ?? null

      // Deterministic source_id from URL
      const cleanUrl = item.link.split('?')[0]!.split('#')[0]!
      const source_id = `news_rss:${src.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}:${Buffer.from(cleanUrl).toString('base64').slice(0, 32)}`

      toUpsert.push({
        source: 'news_rss',
        source_id,
        event_type: evType,
        title: item.title.slice(0, 500),
        description: item.description.slice(0, 2000) || item.title,
        region,
        country_code: loc.country_code,
        severity,
        status: 'developing',
        occurred_at: occurredAt,
        heavy_lane_processed: false,
        provenance_raw: {
          source: src.name,
          attribution: `${src.name} (via RSS)`,
          url: item.link,
          tier: src.tier,
          state_media: src.tier === 'C',
        } as Record<string, unknown>,
        raw: {
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
          sourceName: src.name,
        } as Record<string, unknown>,
      })
    }
  }

  // Batch-upsert collected items in parallel chunks of 20
  const BATCH_SIZE = 20
  for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
    const batch = toUpsert.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.allSettled(
      batch.map(record =>
        supabase.from('events').upsert(record, { onConflict: 'source,source_id', ignoreDuplicates: true })
      )
    )
    for (const r of batchResults) {
      if (r.status === 'fulfilled' && !r.value.error) stored++
      else skipped++
    }
  }

  return { stored, skipped, errors, sources_ok }
}
