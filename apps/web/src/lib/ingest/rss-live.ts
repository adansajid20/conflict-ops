import Parser from 'rss-parser'
import { createServiceClient } from '../supabase/server'
import { isBlocklisted, classifyByTitle, inferRegionFromTitle } from '../classification'

const RSS_FEEDS = [
  { url: 'https://rsshub.app/reuters/world', outlet: 'Reuters', trust: 95, region: null },
  { url: 'https://rsshub.app/reuters/us', outlet: 'Reuters', trust: 95, region: null },
  { url: 'https://rsshub.app/apnews/topics/apf-topnews', outlet: 'AP News', trust: 93, region: null },
  { url: 'https://rsshub.app/apnews/topics/apf-intlnews', outlet: 'AP News', trust: 92, region: null },
  { url: 'https://rsshub.app/apnews/topics/apf-africa', outlet: 'AP News', trust: 92, region: 'sub_saharan_africa' },
  { url: 'https://rsshub.app/apnews/topics/apf-asiapac', outlet: 'AP News', trust: 92, region: 'south_asia' },
  { url: 'https://rsshub.app/apnews/topics/apf-europe', outlet: 'AP News', trust: 92, region: 'eastern_europe' },
  { url: 'https://rsshub.app/apnews/topics/apf-middleeast', outlet: 'AP News', trust: 92, region: 'middle_east' },
  { url: 'http://feeds.bbci.co.uk/news/world/rss.xml', outlet: 'BBC News', trust: 88, region: null },
  { url: 'http://feeds.bbci.co.uk/news/world/middle_east/rss.xml', outlet: 'BBC News', trust: 88, region: 'middle_east' },
  { url: 'http://feeds.bbci.co.uk/news/world/europe/rss.xml', outlet: 'BBC News', trust: 88, region: 'eastern_europe' },
  { url: 'http://feeds.bbci.co.uk/news/world/africa/rss.xml', outlet: 'BBC News', trust: 88, region: 'sub_saharan_africa' },
  { url: 'http://feeds.bbci.co.uk/news/world/asia/rss.xml', outlet: 'BBC News', trust: 88, region: 'south_asia' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', outlet: 'Al Jazeera', trust: 83, region: null },
  { url: 'https://rss.dw.com/rdf/rss-en-world', outlet: 'DW News', trust: 80, region: null },
  { url: 'https://www.france24.com/en/rss', outlet: 'France 24', trust: 79, region: null },
  { url: 'https://rsshub.app/afp/news/en', outlet: 'AFP', trust: 90, region: null },
  { url: 'https://www.middleeasteye.net/rss', outlet: 'Middle East Eye', trust: 76, region: 'middle_east' },
  { url: 'https://english.alaraby.co.uk/rss.xml', outlet: 'Al-Araby', trust: 74, region: 'middle_east' },
  { url: 'https://www.thenationalnews.com/rss.xml', outlet: 'The National', trust: 73, region: 'middle_east' },
  { url: 'https://www.dawn.com/feeds/home', outlet: 'Dawn', trust: 76, region: 'south_asia' },
  { url: 'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms', outlet: 'Times of India', trust: 72, region: 'south_asia' },
  { url: 'https://www.theeastafrican.co.ke/rss', outlet: 'The East African', trust: 71, region: 'sub_saharan_africa' },
  { url: 'https://www.channelnewsasia.com/rssfeeds/8395986', outlet: 'CNA', trust: 74, region: 'southeast_asia' },

  // Eastern Europe — conflict specialists
  { url: 'https://kyivindependent.com/feed/', outlet: 'Kyiv Independent', trust: 80, region: 'eastern_europe' },
  { url: 'https://www.pravda.com.ua/eng/rss/view_news/', outlet: 'Ukrainska Pravda', trust: 78, region: 'eastern_europe' },
  { url: 'https://meduza.io/en/rss/all', outlet: 'Meduza', trust: 77, region: 'eastern_europe' },
  { url: 'https://english.nv.ua/rss/allnews.xml', outlet: 'NV Ukraine', trust: 74, region: 'eastern_europe' },
  { url: 'https://www.ukrinform.net/rss/block-lastnews', outlet: 'Ukrinform', trust: 75, region: 'eastern_europe' },
  { url: 'https://en.interfax.com.ua/news/general.rss', outlet: 'Interfax Ukraine', trust: 76, region: 'eastern_europe' },
  { url: 'https://www.osw.waw.pl/en/rss.xml', outlet: 'OSW (Warsaw)', trust: 82, region: 'eastern_europe' },
  { url: 'https://jamestown.org/feed/', outlet: 'Jamestown Foundation', trust: 80, region: 'eastern_europe' },
  { url: 'https://georgiatoday.ge/feed/', outlet: 'Georgia Today', trust: 70, region: 'eastern_europe' },
  { url: 'https://www.azatutyun.am/api/zpoqpqiput', outlet: 'RFE/RL Armenia', trust: 79, region: 'eastern_europe' },

  // Sub-Saharan Africa
  { url: 'https://www.dailymaverick.co.za/feed/', outlet: 'Daily Maverick', trust: 77, region: 'sub_saharan_africa' },
  { url: 'https://www.theafricareport.com/feed/', outlet: 'The Africa Report', trust: 75, region: 'sub_saharan_africa' },
  { url: 'https://addisstandard.com/feed/', outlet: 'Addis Standard', trust: 74, region: 'sub_saharan_africa' },
  { url: 'https://www.rfi.fr/en/rss', outlet: 'RFI English', trust: 76, region: 'sub_saharan_africa' },
  { url: 'https://www.voanews.com/api/z_mqp_oum', outlet: 'VOA Africa', trust: 78, region: 'sub_saharan_africa' },
  { url: 'https://www.sudantribune.com/spip.php?page=backend', outlet: 'Sudan Tribune', trust: 72, region: 'sub_saharan_africa' },
  { url: 'https://www.africanews.com/feed/rss2/', outlet: 'Africanews', trust: 70, region: 'sub_saharan_africa' },
  { url: 'https://www.thecivilian.net/feed/', outlet: 'The Civilian (Sudan)', trust: 68, region: 'sub_saharan_africa' },
  { url: 'https://en.som1.com/feed/', outlet: 'SOM1 (Somalia)', trust: 67, region: 'sub_saharan_africa' },
  { url: 'https://www.radiotamazuj.org/en/rss.xml', outlet: 'Radio Tamazuj (Sudan)', trust: 71, region: 'sub_saharan_africa' },
  { url: 'https://www.maliactu.net/feed/', outlet: 'Mali Actu', trust: 66, region: 'sub_saharan_africa' },

  // South Asia
  { url: 'https://gandhara.rferl.org/api/zpqmiretle', outlet: 'RFE/RL Gandhara', trust: 81, region: 'south_asia' },
  { url: 'https://tolonews.com/rss.xml', outlet: 'Tolo News (Afghan)', trust: 74, region: 'south_asia' },
  { url: 'https://www.thenews.com.pk/rss/1/8', outlet: 'The News Pakistan', trust: 72, region: 'south_asia' },
  { url: 'https://www.geo.tv/rss/1', outlet: 'Geo News', trust: 71, region: 'south_asia' },
  { url: 'https://www.thehindu.com/news/international/feeder/default.rss', outlet: 'The Hindu', trust: 78, region: 'south_asia' },
  { url: 'https://www.khaama.com/feed/', outlet: 'Khaama Press', trust: 70, region: 'south_asia' },
  { url: 'https://www.rferl.org/api/zrqpurqp', outlet: 'RFE/RL Central Asia', trust: 80, region: 'south_asia' },

  // Southeast Asia
  { url: 'https://www.bangkokpost.com/rss/data/topstories.xml', outlet: 'Bangkok Post', trust: 72, region: 'southeast_asia' },
  { url: 'https://www.irrawaddy.com/feed', outlet: 'The Irrawaddy (Myanmar)', trust: 77, region: 'southeast_asia' },
  { url: 'https://www.benarnews.org/rss/english/top-stories', outlet: 'BenarNews', trust: 76, region: 'southeast_asia' },

  // East Asia
  { url: 'https://focustaiwan.tw/rss', outlet: 'Focus Taiwan', trust: 74, region: 'east_asia' },
  { url: 'https://www.scmp.com/rss/91/feed', outlet: 'South China Morning Post', trust: 76, region: 'east_asia' },
  { url: 'https://en.yna.co.kr/RSS/news.xml', outlet: 'Yonhap (Korea)', trust: 78, region: 'east_asia' },
  { url: 'https://www3.nhk.or.jp/nhkworld/en/news/feeds/', outlet: 'NHK World', trust: 80, region: 'east_asia' },
  { url: 'https://www.rfa.org/english/RSS', outlet: 'RFA (Asia)', trust: 79, region: 'east_asia' },

  // Latin America
  { url: 'https://insightcrime.org/feed/', outlet: 'InSight Crime', trust: 80, region: 'latin_america' },
  { url: 'https://www.laprensa.hn/rss', outlet: 'La Prensa Honduras', trust: 67, region: 'latin_america' },
  { url: 'https://venezuelanalysis.com/feed/', outlet: 'Venezuela Analysis', trust: 68, region: 'latin_america' },
  { url: 'https://www.dialogo-americas.com/feed/', outlet: 'Diálogo Americas', trust: 72, region: 'latin_america' },

  // Global intelligence & defence think-tanks
  { url: 'https://foreignpolicy.com/feed/', outlet: 'Foreign Policy', trust: 85, region: null },
  { url: 'https://warontherocks.com/feed/', outlet: 'War on the Rocks', trust: 84, region: null },
  { url: 'https://www.crisisgroup.org/rss.xml', outlet: 'Crisis Group', trust: 88, region: null },
  { url: 'https://www.bellingcat.com/feed/', outlet: 'Bellingcat', trust: 83, region: null },
  { url: 'https://theintercept.com/feed/?rss', outlet: 'The Intercept', trust: 74, region: null },
  { url: 'https://www.sipri.org/news/feed', outlet: 'SIPRI', trust: 87, region: null },
  { url: 'https://www.defensenews.com/arc/outboundfeeds/rss/', outlet: 'Defense News', trust: 82, region: null },
  { url: 'https://breakingdefense.com/feed/', outlet: 'Breaking Defense', trust: 80, region: null },
  { url: 'https://www.janes.com/feeds/news', outlet: "Jane's", trust: 88, region: null },
  { url: 'https://rss.app/feeds/tLCXMDsWCPIbx8pR.xml', outlet: 'ACLED', trust: 92, region: null },
  { url: 'https://www.worldpoliticsreview.com/rss/', outlet: 'World Politics Review', trust: 82, region: null },
  { url: 'https://www.justsecurity.org/feed/', outlet: 'Just Security', trust: 81, region: null },
  { url: 'https://www.stimson.org/feed/', outlet: 'Stimson Center', trust: 84, region: null },

  // Middle East — expanded
  { url: 'https://www.iranintl.com/en/rss.xml', outlet: 'Iran International', trust: 78, region: 'middle_east' },
  { url: 'https://www.timesofisrael.com/feed/', outlet: 'Times of Israel', trust: 75, region: 'middle_east' },
  { url: 'https://www.haaretz.com/cmlink/1.4466871', outlet: 'Haaretz', trust: 78, region: 'middle_east' },
  { url: 'https://english.alarabiya.net/rss.xml', outlet: 'Al Arabiya', trust: 73, region: 'middle_east' },
  { url: 'https://www.arabnews.com/rss.xml', outlet: 'Arab News', trust: 72, region: 'middle_east' },
  { url: 'https://www.al-monitor.com/rss', outlet: 'Al-Monitor', trust: 80, region: 'middle_east' },
  { url: 'https://english.wafa.ps/rss.xml', outlet: 'WAFA (Palestine)', trust: 65, region: 'middle_east' },
  { url: 'https://www.aa.com.tr/en/rss/default?cat=world', outlet: 'Anadolu Agency', trust: 70, region: 'middle_east' },
  { url: 'https://www.rudaw.net/english/feed', outlet: 'Rudaw (Kurdistan)', trust: 74, region: 'middle_east' },
  { url: 'https://english.enabbaladi.net/feed/', outlet: 'Enab Baladi (Syria)', trust: 72, region: 'middle_east' },
  { url: 'https://www.libya-al-ahrar.tv/en/feed/', outlet: 'Libya Al-Ahrar', trust: 65, region: 'middle_east' },
] as const

const CONFLICT_KEYWORDS = [
  'war', 'attack', 'killed', 'airstrike', 'missile', 'troops', 'military',
  'bomb', 'explosion', 'ceasefire', 'sanctions', 'invasion', 'occupation',
  'conflict', 'fighting', 'battle', 'forces', 'soldiers', 'casualties',
  'strike', 'offensive', 'rebel', 'insurgent', 'terrorism', 'terrorist',
  'nuclear', 'weapons', 'siege', 'blockade', 'protest', 'crackdown',
  'arrested', 'detained', 'coup', 'assassination', 'shooting', 'gunfire',
  'hostage', 'kidnap', 'displaced', 'refugee', 'evacuation', 'emergency',
  'threat', 'espionage', 'cyber', 'hack', 'diplomacy', 'crisis', 'tension',
  'humanitarian', 'famine', 'earthquake', 'disaster', 'NATO', 'UN ', 'ICC',
  'Iran', 'Israel', 'Gaza', 'Ukraine', 'Russia', 'Sudan', 'Yemen', 'Syria',
  'Libya', 'Somalia', 'Mali', 'Ethiopia', 'Myanmar', 'Taiwan', 'Pakistan',
  'North Korea', 'Kashmir', 'Houthi', 'Hamas', 'Hezbollah',
] as const

const BOILERPLATE = [
  'please refer to the attached',
  'please find attached',
  'see attached',
  'click here to read',
  'read more at',
] as const

type FeedEntry = (typeof RSS_FEEDS)[number]

function hasConflictKeyword(title: string, desc: string): boolean {
  const text = `${title} ${desc}`.toLowerCase()
  return CONFLICT_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()))
}

const parser = new Parser({
  timeout: 8000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ConflictRadar/1.0)' },
})

function sanitizeWireTitle(raw: string): string {
  return raw
    .replace(/^\s*\((LEAD|UPDATE\s*\d*|URGENT|FLASH|CORRECTED|WRITETHRU|ADVISORY|RECASTS|EMBARGOED|ADDS|CHANGES|REFILING)\)\s*/gi, '')
    .replace(/^\s*Rpt-\s*/gi, '')
    .replace(/^\s*RPT\s*[-:]\s*/gi, '')
    .replace(/\s*\((CORRECTS|ADDS|CHANGES|RECASTS)[^)]*\)\s*$/gi, '')
    .trim()
}

export async function ingestRSSLive(): Promise<{ inserted: number; skipped: number; errors: number }> {
  const supabase = createServiceClient()
  let inserted = 0
  let skipped = 0
  let errors = 0

  const results = await Promise.allSettled(RSS_FEEDS.map((feed) => parseFeed(feed, supabase)))
  for (const result of results) {
    if (result.status === 'fulfilled') {
      inserted += result.value.inserted
      skipped += result.value.skipped
      errors += result.value.errors
    } else {
      errors += 1
    }
  }

  return { inserted, skipped, errors }
}

async function parseFeed(
  feed: FeedEntry,
  supabase: ReturnType<typeof createServiceClient>
): Promise<{ inserted: number; skipped: number; errors: number }> {
  let inserted = 0
  let skipped = 0
  let errors = 0

  try {
    const parsed = await parser.parseURL(feed.url)
    const batch: Record<string, unknown>[] = []

    for (const item of (parsed.items ?? []).slice(0, 30)) {
      if (!item.title) {
        skipped += 1
        continue
      }

      const title = item.title.trim()
      const link = item.link ?? item.guid ?? null
      const snippet = (item.contentSnippet ?? item.summary ?? '').slice(0, 500)

      if (isBlocklisted(title, link ?? '', snippet)) {
        skipped += 1
        continue
      }

      // Gate 1b: description must be different from title and at least 60 chars
      if (!snippet || snippet.trim() === title || snippet.length < 60) {
        skipped += 1
        continue
      }

      if (!hasConflictKeyword(title, snippet)) {
        skipped += 1
        continue
      }

      const pubDate = item.pubDate ? new Date(item.pubDate) : new Date()
      if (Number.isNaN(pubDate.getTime()) || (Date.now() - pubDate.getTime()) > 24 * 60 * 60 * 1000) {
        skipped += 1
        continue
      }

      if (BOILERPLATE.some((fragment) => snippet.toLowerCase().includes(fragment))) {
        skipped += 1
        continue
      }

      if (title.length < 30 && snippet.length < 30) {
        skipped += 1
        continue
      }

      const externalId = link ?? item.guid ?? title
      const region = feed.region ?? inferRegionFromTitle(title)

      // Pre-score severity by keyword before AI heavy lane runs
      function prescore(title: string, desc: string): number {
        const text = `${title} ${desc}`.toLowerCase()

        const criticalKw = ['nuclear', 'chemical weapon', 'biological weapon', 'dirty bomb', 'mass casualty', ' coup', 'assassination', 'genocide', 'war declared', 'invasion begins', 'martial law', 'nuclear strike', 'icbm', 'ballistic missile launch']
        if (criticalKw.some(k => text.includes(k))) return 4

        const highKw = ['killed', ' dead ', 'airstrike', 'air strike', 'missile strike', 'explosion kills', 'bomb kills', 'attack kills', 'troops killed', 'soldiers killed', 'civilians killed', 'death toll', 'fatalities', 'casualties', 'offensive launched', 'ceasefire collapsed', 'hostage', 'kidnapped', 'siege', 'assault on', 'shelling kills']
        if (highKw.some(k => text.includes(k))) return 3

        const mediumKw = ['troops deployed', 'forces mobilized', 'sanctions imposed', 'sanctions announced', 'escalation', 'crackdown', 'detained', 'arrested', 'blockade', 'expels ambassador', 'diplomat expelled', 'emergency declared', 'warns of', 'threatens to', 'protest', 'military exercise', 'test-fired', 'test fired']
        if (mediumKw.some(k => text.includes(k))) return 2

        return 1
      }

      batch.push({
        title: sanitizeWireTitle(title),
        description: snippet || null,
        source_id: link,
        occurred_at: pubDate.toISOString(),
        source: 'rss_live',
        event_type: classifyByTitle(title),
        external_id: externalId,
        region,
        severity: prescore(title, snippet),
        is_humanitarian_report: false,
        raw: {
          outlet: feed.outlet,
          trust: feed.trust,
          feed_url: feed.url,
          guid: item.guid ?? null,
        },
      })
    }

    if (batch.length > 0) {
      const { error } = await supabase.from('events').upsert(batch, {
        onConflict: 'external_id',
        ignoreDuplicates: true,
      })

      if (error) {
        errors += 1
        skipped += batch.length
      } else {
        inserted += batch.length
      }
    }
  } catch {
    errors += 1
  }

  return { inserted, skipped, errors }
}
