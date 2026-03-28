// Country code → display name lookup
export const COUNTRY_NAMES: Record<string, string> = {
  'US': 'United States', 'RU': 'Russia', 'UA': 'Ukraine', 'IL': 'Israel',
  'PS': 'Palestine', 'LB': 'Lebanon', 'SY': 'Syria', 'IQ': 'Iraq',
  'IR': 'Iran', 'YE': 'Yemen', 'SA': 'Saudi Arabia', 'AF': 'Afghanistan',
  'PK': 'Pakistan', 'SD': 'Sudan', 'SS': 'South Sudan', 'ET': 'Ethiopia',
  'SO': 'Somalia', 'NG': 'Nigeria', 'ML': 'Mali', 'LY': 'Libya',
  'MM': 'Myanmar', 'CN': 'China', 'IN': 'India', 'TR': 'Turkey',
  'GB': 'United Kingdom', 'FR': 'France', 'DE': 'Germany',
  'MX': 'Mexico', 'BR': 'Brazil', 'VE': 'Venezuela', 'CO': 'Colombia',
  'JP': 'Japan', 'KR': 'South Korea', 'KP': 'North Korea', 'EG': 'Egypt',
  'MA': 'Morocco', 'DZ': 'Algeria', 'TN': 'Tunisia',
  'AO': 'Angola', 'CD': 'DR Congo', 'CG': 'Congo', 'CF': 'Central African Rep.',
  'TD': 'Chad', 'ER': 'Eritrea', 'UG': 'Uganda', 'KE': 'Kenya',
  'TZ': 'Tanzania', 'RW': 'Rwanda', 'BI': 'Burundi', 'MZ': 'Mozambique',
  'ZW': 'Zimbabwe', 'ZA': 'South Africa', 'GH': 'Ghana', 'SN': 'Senegal',
  'CM': 'Cameroon', 'BF': 'Burkina Faso', 'NE': 'Niger', 'CI': "Côte d'Ivoire",
  'AZ': 'Azerbaijan', 'AM': 'Armenia', 'GE': 'Georgia', 'BY': 'Belarus',
  'RS': 'Serbia', 'BA': 'Bosnia', 'MK': 'N. Macedonia', 'AL': 'Albania',
  'KZ': 'Kazakhstan', 'UZ': 'Uzbekistan', 'TM': 'Turkmenistan', 'KG': 'Kyrgyzstan',
  'TJ': 'Tajikistan', 'BD': 'Bangladesh', 'LK': 'Sri Lanka', 'NP': 'Nepal',
  'KH': 'Cambodia', 'LA': 'Laos', 'TH': 'Thailand', 'VN': 'Vietnam',
  'PH': 'Philippines', 'ID': 'Indonesia', 'MY': 'Malaysia', 'SG': 'Singapore',
  'JO': 'Jordan', 'AE': 'UAE', 'QA': 'Qatar', 'KW': 'Kuwait', 'BH': 'Bahrain',
  'OM': 'Oman', 'HT': 'Haiti', 'GT': 'Guatemala', 'SV': 'El Salvador',
  'HN': 'Honduras', 'NI': 'Nicaragua', 'PE': 'Peru', 'AR': 'Argentina',
  'CL': 'Chile', 'BO': 'Bolivia', 'PY': 'Paraguay', 'UY': 'Uruguay',
  'EC': 'Ecuador', 'PA': 'Panama', 'IT': 'Italy', 'ES': 'Spain',
  'PL': 'Poland', 'RO': 'Romania', 'HU': 'Hungary', 'CZ': 'Czech Republic',
  'SK': 'Slovakia', 'HR': 'Croatia', 'GR': 'Greece', 'PT': 'Portugal',
  'NL': 'Netherlands', 'BE': 'Belgium', 'SE': 'Sweden', 'NO': 'Norway',
  'FI': 'Finland', 'DK': 'Denmark', 'AT': 'Austria', 'CH': 'Switzerland',
}

// Source code → display name
export const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  'noaa':       'NOAA National Weather Service',
  'usgs':       'USGS Earthquake Hazards Program',
  'gdacs':      'GDACS (Global Disaster Alert)',
  'unhcr':      'UNHCR (UN Refugee Agency)',
  'nasa_eonet': 'NASA EONET (Natural Events)',
  'reliefweb':  'ReliefWeb (OCHA)',
  'gdelt':      'GDELT Project',
  'acled':      'ACLED Armed Conflict Database',
  'news_rss':   'News Wire',
  'newsapi':    'News Aggregator',
}

/**
 * Return a human-readable location string, never showing raw "UN" to users.
 */
export function displayLocation(
  countryCode: string | null | undefined,
  region: string | null | undefined,
  locationName?: string | null | undefined
): string {
  const PLACEHOLDERS = new Set(['UN', 'United Nations', 'N/A', 'Unknown', 'Global', 'World', '', 'null'])

  if (countryCode && !PLACEHOLDERS.has(countryCode) && countryCode.length === 2) {
    const name = COUNTRY_NAMES[countryCode]
    if (name) return name
    return countryCode // show ISO code if we don't have a full name
  }
  if (region && !PLACEHOLDERS.has(region)) return region
  if (locationName && !PLACEHOLDERS.has(locationName)) return locationName
  return 'Location unknown'
}

/**
 * Generate a deterministic 1-2 line summary when description/snippet is null.
 */
export function generateSummary(event: {
  title: string
  source?: string | null
  event_type?: string | null
  country_code?: string | null
  severity?: number | null
}): string {
  const loc = event.country_code && COUNTRY_NAMES[event.country_code]
    ? ` in ${COUNTRY_NAMES[event.country_code]}`
    : ''
  const sev = event.severity === 4 ? 'Critical' : event.severity === 3 ? 'Significant' : 'Reported'
  const typeStr = event.event_type?.replace(/_/g, ' ') ?? 'event'
  const source = event.source ? (SOURCE_DISPLAY_NAMES[event.source] ?? event.source) : 'unknown source'
  return `${sev} ${typeStr}${loc} reported by ${source}.`
}
