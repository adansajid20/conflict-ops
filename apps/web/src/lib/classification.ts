/**
 * Shared classification module — ConflictRadar
 *
 * Central source for:
 * - Event type detection from text
 * - Blocklist filtering (titles/domains/descriptions)
 * - Region inference from titles
 * - Event type → category taxonomy mapping
 */

export const TITLE_BLOCKLIST_PATTERNS: RegExp[] = [
  /\bfootball\b/i, /\bsoccer\b/i, /\bbasketball\b/i, /\bbaseball\b/i,
  /\bcricket\b/i, /\brugby\b/i, /\btennis\b/i, /\bgolf\b/i,
  /\bnfl\b/i, /\bnba\b/i, /\bnhl\b/i, /\bmlb\b/i, /\bufc\b/i,
  /\bworld cup\b/i, /\bchampions league\b/i, /\bpremier league\b/i,
  /\bserie a\b/i, /\bbundesliga\b/i, /\bla liga\b/i, /\bligue 1\b/i,
  /\bfifa\b/i, /\buefa\b/i, /\bqualif(y|ied|ication)\b/i,
  /\bfinal four\b/i, /\bsuper bowl\b/i, /\btransfer window\b/i,
  /\bscorer\b/i, /\bgoalkeeper\b/i, /\bleague table\b/i, /\bplayoff\b/i,
  /\bformula 1\b/i, /\bf1 race\b/i, /\bwimbledon\b/i, /\bolympic\b/i,
  /match result/i, /\bscoreline\b/i, /\bhalf.?time\b/i, /\bfull.?time\b/i,
  /\bbox office\b/i, /\bfilm festival\b/i, /\bmovie premiere\b/i,
  /\balbum release\b/i, /\bgrammy\b/i, /\bemmy\b/i, /\bbafta\b/i,
  /\bcelebrity\b/i, /\bpop star\b/i, /\bmusic video\b/i, /\bvideo game\b/i,
  /\bdéception\b/i, /\bl'équipe\b/i, /\bcoupe du monde\b/i, /\bchampionnat\b/i,
  /situation report no\.\s*\d+/i, /flash update no\.\s*\d+/i, /flash #\d+/i,
  /information bulletin/i, /operational update no\./i, /meeting minutes/i,
  /network meeting/i, /monitoring summary/i, /nfi \d{4}/i, /\bpsea\b/i,
  /budget revision/i, /funding appeal/i,
  // Economic data releases — not conflict intelligence
  /\binflation\b.{0,40}(quickens|slows|eases|rises|falls|rate|data|figures)/i,
  /\b(cpi|pce|ppi)\b.{0,20}(data|figures|report|reading)/i,
  /\bgdp\b.{0,20}(growth|contracts|expands|slows|data|figures)/i,
  /\binterest rates?\b.{0,30}(cut|hike|hold|decision|unchanged)/i,
  /\bcentral bank\b.{0,30}(rate|policy|meeting|decision)/i,
  /\btrade (deficit|surplus|balance)\b/i,
  /\bunemployment (rate|data|figures|falls|rises)\b/i,
  /\bstock(s| market)\b.{0,20}(fall|rise|surge|drop|rally|slump)/i,
  /ІНФОРМАЦІЙНА ДОВІДКА/, /БЮЛЕТЕНЬ/, /КВАРТАЛ/, /ДОПОМОГА З ЖИТЛОМ/,
  // Consumer/utility noise
  /\bshopping coupon/i,
  // French-language economic/fiscal content (Mali Actu, Africa feeds)
  /\bimportateur(s)?\b/i,
  /\bcorridor\b.{0,30}(bamako|dakar|abidjan)/i,
  /\bfin du sursis\b/i,
  /\bdouane(s)?\b.{0,40}(mali|sénégal|afrique)/i,
  /\btaux de change\b/i,
  /\bprix.{0,20}march(é|e)\b/i,
  /\bdiscount voucher/i,
  /\bconsumption coupon/i,
  /\butility (company|bill|rebate)\b/i,
  /\b(electricity|power|gas) (company|provider|bill)\b.{0,30}(coupon|voucher|rebate|discount)/i,
  // US domestic weather alerts (not conflict intelligence)
  /\btornado warning\b/i,
  /\bsevere thunderstorm warning\b/i,
  /\bflood warning\b/i,
  /\bflash flood warning\b/i,
  /\bwinter storm warning\b/i,
  /\bice storm warning\b/i,
  /\bheat advisory\b/i,
  /\bnws\b.{0,20}\bwarning\b/i,
  /\bweather alert\b/i,
  /\bby NWS\b/i,
  /issued by the National Weather Service/i,
  /until \d+:\d+[AP]M [A-Z]{2,4} by NWS/i,
]

export const DOMAIN_BLOCKLIST: string[] = [
  'lemonde.fr', 'lefigaro.fr', 'liberation.fr', 'lepoint.fr',
  'espn.com', 'bleacherreport.com', 'theathletic.com', 'sports.yahoo.com',
  'goal.com', 'skysports.com', 'marca.com', 'bild.de',
  'tmz.com', 'people.com', 'eonline.com', 'variety.com',
  'hollywoodreporter.com', 'rollingstone.com', 'buzzfeed.com',
  'weather.gov', 'nws.noaa.gov',
]

export const DESCRIPTION_BLOCKLIST_PATTERNS: RegExp[] = [
  /please refer to the attached/i,
  /please find (the )?attached/i,
  /see (the )?(attached|full report)/i,
  /click here (to|for)/i,
  /subscribe to (read|access)/i,
]

export const COUNTRY_TO_REGION: Record<string, string> = {
  Israel: 'middle_east', Gaza: 'middle_east', Iran: 'middle_east',
  Iraq: 'middle_east', Syria: 'middle_east', Lebanon: 'middle_east',
  Yemen: 'middle_east', 'Saudi Arabia': 'middle_east', Turkey: 'middle_east',
  Palestine: 'middle_east', Jordan: 'middle_east', Egypt: 'middle_east',
  Houthi: 'middle_east', Hamas: 'middle_east', Hezbollah: 'middle_east',
  Ukraine: 'eastern_europe', Russia: 'eastern_europe', Belarus: 'eastern_europe',
  Moldova: 'eastern_europe', Georgia: 'eastern_europe', Armenia: 'eastern_europe',
  Sudan: 'sub_saharan_africa', Ethiopia: 'sub_saharan_africa', Somalia: 'sub_saharan_africa',
  Mali: 'sub_saharan_africa', Niger: 'sub_saharan_africa', DRC: 'sub_saharan_africa',
  Congo: 'sub_saharan_africa', Nigeria: 'sub_saharan_africa',
  Pakistan: 'south_asia', India: 'south_asia', Afghanistan: 'south_asia',
  Kashmir: 'south_asia', Bangladesh: 'south_asia',
  Myanmar: 'southeast_asia', Philippines: 'southeast_asia', Thailand: 'southeast_asia',
  Taiwan: 'east_asia', China: 'east_asia', 'North Korea': 'east_asia',
  Libya: 'north_africa', Tunisia: 'north_africa', Algeria: 'north_africa', Morocco: 'north_africa',
  Venezuela: 'latin_america', Colombia: 'latin_america', Haiti: 'latin_america', Mexico: 'latin_america',
}

export function inferRegionFromTitle(title: string): string | null {
  for (const [country, region] of Object.entries(COUNTRY_TO_REGION)) {
    if (title.includes(country)) return region
  }
  return null
}

export function isBlocklisted(title: string, url = '', description?: string): boolean {
  if (TITLE_BLOCKLIST_PATTERNS.some((pattern) => pattern.test(title))) return true

  try {
    const domain = new URL(url).hostname.replace('www.', '')
    if (DOMAIN_BLOCKLIST.some((blocked) => domain.includes(blocked))) return true
  } catch {
    // ignore malformed or missing URLs
  }

  if (description && DESCRIPTION_BLOCKLIST_PATTERNS.some((pattern) => pattern.test(description))) return true
  return false
}

export function classifyByTitle(text: string): string {
  const t = text.toLowerCase()

  if (
    /airstrike|air strike|bombing run|drone strike|missile strike|shelling|artillery fire|rocket attack|rocket fire|air raid|air attack|aerial bomb|bombed|rockets? fired|missiles? fired|missiles? launched|drone attack/.test(
      t
    )
  ) {
    return 'airstrike'
  }

  if (/coup|junta|overthrow|seized power|military takeover|seized the government/.test(t)) return 'coup'
  if (/ceasefire|cease-fire|peace deal|truce|armistice|peace talks|peace agreement|peace accord/.test(t)) return 'ceasefire'
  if (/sanction|embargo|trade ban|economic restriction/.test(t)) return 'sanctions'

  if (
    /terrorist|terror attack|extremist attack|mass shooting|hostage|kidnap|abduct|suicide bomb|car bomb|ied explosion|improvised explosive|roadside bomb/.test(
      t
    )
  ) {
    return 'terrorism'
  }

  if (
    (/\bkilled\b|\bkills\b|\bdead\b|\bdeaths?\b|\bcasualt|\bwounded\b|\bslain\b|\bslaughter/.test(t) &&
      /\b(war|conflict|attack|assault|militar|soldier|troop|force|fighter|combatant|gunman|armed)\b/.test(t)) ||
    (/\battack(?:ed|s|ing)?\b|\bassault(?:ed|s|ing)?\b|\bstrike(?:s|d)?\b/.test(t) &&
      /\b(militar|soldier|troop|force|fighter|armed|weapon|gun|bomb|rocket|drone)\b/.test(t)) ||
    /\bwar\b|\bwarfare\b|\bconflict\b|\bfighting\b|\bclash(?:ed|es)?\b|\bbattle\b|\bcombat\b/.test(t) ||
    /military operation|military strike|ground operation|offensive|counteroffensive|front line|frontline|invasion|siege|blockade|occupied|occupation/.test(t) ||
    /troops|soldiers|forces deploy|forces advance|forces retreat|army|infantry|armored|tank|warship|gunship/.test(t)
  ) {
    return 'conflict'
  }

  if (/riot|civil unrest|uprising|revolution|insurrection|crackdown on/.test(t)) return 'political'
  if (/protest|demonstration|march|rally|demonstrators/.test(t)) return 'political'
  if (/diplomat|summit meeting|bilateral talks|multilateral|foreign minister|state visit|peace summit/.test(t)) return 'political'
  if (/political crisis|government collapse|election fraud|constitutional crisis|martial law/.test(t)) return 'political'
  if (/troop deployment|military drill|mobilization|defense ministry|army chief/.test(t)) return 'military'
  if (/earthquake|tsunami|hurricane|typhoon|cyclone|tornado|flood|wildfire|volcanic eruption|eruption/.test(t)) return 'natural_disaster'
  if (/refugee|mass displacement|humanitarian crisis|famine|starvation|aid worker|humanitarian corridor/.test(t)) return 'humanitarian_crisis'

  return 'news'
}

export const detectEventType = classifyByTitle

export function resolveEventType(raw: string | null | undefined): string {
  if (!raw) return 'news'
  const t = raw.toLowerCase().trim()
  const aliases: Record<string, string> = {
    armed_conflict: 'conflict',
    military: 'military',
    mobilization: 'military',
    explosion: 'airstrike',
    attack: 'conflict',
    displacement: 'humanitarian_crisis',
    humanitarian: 'humanitarian_crisis',
    security: 'conflict',
    cyber: 'political',
    wmd_threat: 'conflict',
    economic: 'sanctions',
    report: 'news',
    border_incident: 'conflict',
    maritime_incident: 'conflict',
    aviation_incident: 'conflict',
    'natural-disaster': 'natural_disaster',
    political_crisis: 'political',
    civil_unrest: 'political',
  }
  return aliases[t] ?? t
}

export const EVENT_TYPE_TO_CATEGORY: Record<string, string> = {
  conflict: 'Armed Conflict',
  armed_conflict: 'Armed Conflict',
  airstrike: 'Armed Conflict',
  terrorism: 'Security',
  coup: 'Political',
  civil_unrest: 'Political',
  political: 'Political',
  protest: 'Political',
  political_crisis: 'Political',
  diplomacy: 'Diplomacy',
  ceasefire: 'Armed Conflict',
  sanctions: 'Diplomacy',
  natural_disaster: 'Natural Disaster',
  humanitarian_crisis: 'Humanitarian',
  humanitarian: 'Humanitarian',
  displacement: 'Humanitarian',
  wmd_threat: 'Security',
  cyber: 'Security',
  military: 'Armed Conflict',
  mobilization: 'Armed Conflict',
  explosion: 'Armed Conflict',
  attack: 'Armed Conflict',
  security: 'Security',
  border_incident: 'Armed Conflict',
  maritime_incident: 'Security',
  aviation_incident: 'Security',
  news: 'Intel',
  report: 'Intel',
}

export function getEventCategory(eventType: string | null | undefined): string {
  if (!eventType) return 'Intel'
  return EVENT_TYPE_TO_CATEGORY[eventType] ?? 'Intel'
}

export function isHumanitarianBureaucracy(event: { title: string; description?: string | null }): boolean {
  const bureaucraticPatterns = [
    /situation report no\.\s*\d+/i,
    /flash update no\.\s*\d+/i,
    /humanitarian bulletin/i,
    /emergency appeal/i,
    /operational update/i,
    /information bulletin no\.\s*\d+/i,
    /inter-agency/i,
    /ocha reports/i,
    /\bunhcr\b.*\breport\b/i,
  ]
  const text = `${event.title} ${event.description ?? ''}`
  return bureaucraticPatterns.some((pattern) => pattern.test(text))
}
