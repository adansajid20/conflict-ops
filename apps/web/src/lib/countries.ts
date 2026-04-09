/**
 * Country utility functions for ISO 2-letter country code lookup
 */

const COUNTRY_MAP: Record<string, { name: string; flag: string }> = {
  // Conflict-active countries
  UA: { name: 'Ukraine', flag: '🇺🇦' },
  RU: { name: 'Russia', flag: '🇷🇺' },
  CN: { name: 'China', flag: '🇨🇳' },
  JP: { name: 'Japan', flag: '🇯🇵' },
  KR: { name: 'South Korea', flag: '🇰🇷' },
  KP: { name: 'North Korea', flag: '🇰🇵' },
  IR: { name: 'Iran', flag: '🇮🇷' },
  IL: { name: 'Israel', flag: '🇮🇱' },
  PS: { name: 'Palestine', flag: '🇵🇸' },
  SD: { name: 'Sudan', flag: '🇸🇩' },
  SY: { name: 'Syria', flag: '🇸🇾' },
  YE: { name: 'Yemen', flag: '🇾🇪' },
  MM: { name: 'Myanmar', flag: '🇲🇲' },
  VE: { name: 'Venezuela', flag: '🇻🇪' },
  AF: { name: 'Afghanistan', flag: '🇦🇫' },
  IQ: { name: 'Iraq', flag: '🇮🇶' },
  LB: { name: 'Lebanon', flag: '🇱🇧' },
  SO: { name: 'Somalia', flag: '🇸🇴' },
  ET: { name: 'Ethiopia', flag: '🇪🇹' },
  SS: { name: 'South Sudan', flag: '🇸🇸' },
  DJ: { name: 'Djibouti', flag: '🇩🇯' },
  ER: { name: 'Eritrea', flag: '🇪🇷' },

  // Major powers
  US: { name: 'United States', flag: '🇺🇸' },
  GB: { name: 'United Kingdom', flag: '🇬🇧' },
  FR: { name: 'France', flag: '🇫🇷' },
  DE: { name: 'Germany', flag: '🇩🇪' },
  IT: { name: 'Italy', flag: '🇮🇹' },
  ES: { name: 'Spain', flag: '🇪🇸' },
  CA: { name: 'Canada', flag: '🇨🇦' },
  AU: { name: 'Australia', flag: '🇦🇺' },
  IN: { name: 'India', flag: '🇮🇳' },
  BR: { name: 'Brazil', flag: '🇧🇷' },
  MX: { name: 'Mexico', flag: '🇲🇽' },
  SA: { name: 'Saudi Arabia', flag: '🇸🇦' },
  AE: { name: 'United Arab Emirates', flag: '🇦🇪' },
  KW: { name: 'Kuwait', flag: '🇰🇼' },
  QA: { name: 'Qatar', flag: '🇶🇦' },
  TR: { name: 'Turkey', flag: '🇹🇷' },
  PK: { name: 'Pakistan', flag: '🇵🇰' },
  BD: { name: 'Bangladesh', flag: '🇧🇩' },
  TH: { name: 'Thailand', flag: '🇹🇭' },
  VN: { name: 'Vietnam', flag: '🇻🇳' },
  PH: { name: 'Philippines', flag: '🇵🇭' },
  ID: { name: 'Indonesia', flag: '🇮🇩' },
  MY: { name: 'Malaysia', flag: '🇲🇾' },
  SG: { name: 'Singapore', flag: '🇸🇬' },
  TW: { name: 'Taiwan', flag: '🇹🇼' },
  HK: { name: 'Hong Kong', flag: '🇭🇰' },
  MO: { name: 'Macau', flag: '🇲🇴' },
  KZ: { name: 'Kazakhstan', flag: '🇰🇿' },
  UZ: { name: 'Uzbekistan', flag: '🇺🇿' },
  TJ: { name: 'Tajikistan', flag: '🇹🇯' },
  KG: { name: 'Kyrgyzstan', flag: '🇰🇬' },
  TM: { name: 'Turkmenistan', flag: '🇹🇲' },
  AM: { name: 'Armenia', flag: '🇦🇲' },
  AZ: { name: 'Azerbaijan', flag: '🇦🇿' },
  GE: { name: 'Georgia', flag: '🇬🇪' },
  PL: { name: 'Poland', flag: '🇵🇱' },
  CZ: { name: 'Czech Republic', flag: '🇨🇿' },
  SK: { name: 'Slovakia', flag: '🇸🇰' },
  HU: { name: 'Hungary', flag: '🇭🇺' },
  RO: { name: 'Romania', flag: '🇷🇴' },
  BG: { name: 'Bulgaria', flag: '🇧🇬' },
  HR: { name: 'Croatia', flag: '🇭🇷' },
  BA: { name: 'Bosnia and Herzegovina', flag: '🇧🇦' },
  RS: { name: 'Serbia', flag: '🇷🇸' },
  ME: { name: 'Montenegro', flag: '🇲🇪' },
  MK: { name: 'North Macedonia', flag: '🇲🇰' },
  AL: { name: 'Albania', flag: '🇦🇱' },
  GR: { name: 'Greece', flag: '🇬🇷' },
  PT: { name: 'Portugal', flag: '🇵🇹' },
  NO: { name: 'Norway', flag: '🇳🇴' },
  SE: { name: 'Sweden', flag: '🇸🇪' },
  FI: { name: 'Finland', flag: '🇫🇮' },
  DK: { name: 'Denmark', flag: '🇩🇰' },
  NL: { name: 'Netherlands', flag: '🇳🇱' },
  BE: { name: 'Belgium', flag: '🇧🇪' },
  CH: { name: 'Switzerland', flag: '🇨🇭' },
  AT: { name: 'Austria', flag: '🇦🇹' },
  IE: { name: 'Ireland', flag: '🇮🇪' },
  NZ: { name: 'New Zealand', flag: '🇳🇿' },

  // Additional countries
  ZA: { name: 'South Africa', flag: '🇿🇦' },
  NG: { name: 'Nigeria', flag: '🇳🇬' },
  KE: { name: 'Kenya', flag: '🇰🇪' },
  EG: { name: 'Egypt', flag: '🇪🇬' },
  AR: { name: 'Argentina', flag: '🇦🇷' },
  CL: { name: 'Chile', flag: '🇨🇱' },
  CO: { name: 'Colombia', flag: '🇨🇴' },
  PE: { name: 'Peru', flag: '🇵🇪' },
  EC: { name: 'Ecuador', flag: '🇪🇨' },
  BO: { name: 'Bolivia', flag: '🇧🇴' },
  PY: { name: 'Paraguay', flag: '🇵🇾' },
  UY: { name: 'Uruguay', flag: '🇺🇾' },
  BZ: { name: 'Belize', flag: '🇧🇿' },
  CR: { name: 'Costa Rica', flag: '🇨🇷' },
  PA: { name: 'Panama', flag: '🇵🇦' },
  CU: { name: 'Cuba', flag: '🇨🇺' },
  DO: { name: 'Dominican Republic', flag: '🇩🇴' },
  JM: { name: 'Jamaica', flag: '🇯🇲' },
  HT: { name: 'Haiti', flag: '🇭🇹' },
  TT: { name: 'Trinidad and Tobago', flag: '🇹🇹' },
  BB: { name: 'Barbados', flag: '🇧🇧' },
}

/**
 * Get country name from ISO 2-letter country code
 * @param code ISO 2-letter country code (e.g., 'US', 'RU')
 * @returns Country name or the code itself if not found
 */
export function getCountryName(code: string): string {
  if (!code) return 'Unknown'
  const upper = code.toUpperCase()
  return COUNTRY_MAP[upper]?.name ?? upper
}

/**
 * Get country flag emoji from ISO 2-letter country code
 * @param code ISO 2-letter country code (e.g., 'US', 'RU')
 * @returns Flag emoji or fallback
 */
export function getCountryFlag(code: string): string {
  if (!code) return '🌍'
  const upper = code.toUpperCase()
  return COUNTRY_MAP[upper]?.flag ?? '🌍'
}

/**
 * Get both name and flag
 * @param code ISO 2-letter country code
 * @returns Object with name and flag
 */
export function getCountryInfo(code: string): { name: string; flag: string } {
  if (!code) return { name: 'Unknown', flag: '🌍' }
  const upper = code.toUpperCase()
  return COUNTRY_MAP[upper] ?? { name: upper, flag: '🌍' }
}
