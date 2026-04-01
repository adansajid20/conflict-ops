const CONFLICT_ACTIVE_COUNTRIES = [
  { iso2: 'UA', name: 'Ukraine' },
  { iso2: 'RU', name: 'Russia' },
  { iso2: 'IL', name: 'Israel' },
  { iso2: 'PS', name: 'Palestine' },
  { iso2: 'SD', name: 'Sudan' },
  { iso2: 'SY', name: 'Syria' },
  { iso2: 'YE', name: 'Yemen' },
  { iso2: 'MM', name: 'Myanmar' },
] as const

export type EconomicCountry = (typeof CONFLICT_ACTIVE_COUNTRIES)[number]
export type EconomicIndicator = {
  iso2: string
  name: string
  latestGdp: number | null
  previousGdp: number | null
  trend: 'up' | 'down' | 'flat' | 'unknown'
  year: string | null
}

type WorldBankRow = {
  date?: string
  value?: number | null
}

export function getConflictActiveCountries(): EconomicCountry[] {
  return [...CONFLICT_ACTIVE_COUNTRIES]
}

export async function fetchEconomicIndicators(): Promise<EconomicIndicator[]> {
  const results = await Promise.all(
    CONFLICT_ACTIVE_COUNTRIES.map(async (country): Promise<EconomicIndicator | null> => {
      try {
        const response = await fetch(`https://api.worldbank.org/v2/country/${country.iso2}/indicator/NY.GDP.MKTP.CD?format=json&mrv=2`, {
          next: { revalidate: 3600 },
        })
        if (!response.ok) return null
        const json = await response.json() as [unknown, WorldBankRow[]?]
        const rows = Array.isArray(json[1]) ? json[1].filter((row) => typeof row?.date === 'string') : []
        const numericRows = rows.filter((row) => typeof row.value === 'number')
        const latest = numericRows[0] ?? null
        const previous = numericRows[1] ?? null

        const latestValue = latest?.value ?? null
        const previousValue = previous?.value ?? null
        const trend: EconomicIndicator['trend'] = latestValue === null || previousValue === null
          ? 'unknown'
          : latestValue > previousValue
            ? 'up'
            : latestValue < previousValue
              ? 'down'
              : 'flat'

        return {
          iso2: country.iso2,
          name: country.name,
          latestGdp: latestValue,
          previousGdp: previousValue,
          trend,
          year: latest?.date ?? null,
        }
      } catch {
        return null
      }
    })
  )

  const filtered: EconomicIndicator[] = []
  for (const item of results) {
    if (item) filtered.push(item)
  }
  return filtered
}
