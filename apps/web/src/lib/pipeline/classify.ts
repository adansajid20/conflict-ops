export const runtime = 'nodejs'

export interface ClassifyResult {
  severity: 1 | 2 | 3 | 4
  category: string
  escalation_signal: boolean
  weapons_mentioned: string[]
  casualty_estimate: number | null
}

const SEVERITY_MAP: Record<string, 1 | 2 | 3 | 4> = {
  critical: 4, high: 3, medium: 2, low: 1,
}

const KEYWORD_CRITICAL = ['airstrike','missile strike','nuclear','mass casualty','chemical weapon','genocide','invasion','declaration of war','war crime']
const KEYWORD_HIGH = ['battle','combat','offensive','military operation','killed','fatalities','explosion','bombing','troops deployed','sanctions imposed']
const KEYWORD_MEDIUM = ['protest','riot','tension','diplomat','arrested','clashes','detained','condemned']
const WEAPONS = ['missile','drone','artillery','tank','warship','fighter jet','bomb','rocket','mortar','grenade','ied','chemical','nuclear','hypersonic']

function keywordClassify(title: string, description: string): ClassifyResult {
  const text = `${title} ${description}`.toLowerCase()
  const weapons_mentioned = WEAPONS.filter(w => text.includes(w))
  const casualty_match = text.match(/(\d+)\s*(people|civilians|soldiers|troops|killed|dead|casualties|fatalities)/i)
  const casualty_estimate = casualty_match && casualty_match[1] ? parseInt(casualty_match[1]) : null

  let severity: 1 | 2 | 3 | 4 = 1
  if (KEYWORD_CRITICAL.some(k => text.includes(k))) severity = 4
  else if (KEYWORD_HIGH.some(k => text.includes(k))) severity = 3
  else if (KEYWORD_MEDIUM.some(k => text.includes(k))) severity = 2

  const escalation_signal = severity >= 3 || weapons_mentioned.length >= 2

  let category = 'political'
  if (text.includes('airstrike') || text.includes('missile') || text.includes('bombing')) category = 'airstrike'
  else if (text.includes('battle') || text.includes('combat') || text.includes('troops')) category = 'conflict'
  else if (text.includes('protest') || text.includes('riot') || text.includes('demonstration')) category = 'civil_unrest'
  else if (text.includes('cyber') || text.includes('hack') || text.includes('ransomware')) category = 'cyber'
  else if (text.includes('nuclear') || text.includes('wmd') || text.includes('chemical weapon')) category = 'nuclear'
  else if (text.includes('humanitarian') || text.includes('refugee') || text.includes('famine')) category = 'humanitarian'
  else if (text.includes('earthquake') || text.includes('flood') || text.includes('disaster')) category = 'disaster'
  else if (text.includes('sanction') || text.includes('trade') || text.includes('economic')) category = 'economic'

  return { severity, category, escalation_signal, weapons_mentioned, casualty_estimate }
}

export async function classifyEvent(title: string, description: string): Promise<ClassifyResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return keywordClassify(title, description)

  try {
    const prompt = `Classify this news event for a geopolitical intelligence platform.

Title: ${title}
Description: ${(description ?? '').slice(0, 300)}

Return JSON only (no markdown):
{
  "severity": "critical|high|medium|low",
  "category": "conflict|airstrike|political|humanitarian|cyber|nuclear|economic|disaster|civil_unrest",
  "escalation_signal": true,
  "weapons_mentioned": ["missile","drone"],
  "casualty_estimate": null
}

Severity guide:
- critical: active combat, mass casualties, nuclear risk, imminent attack
- high: military movements, significant political crisis, confirmed strikes
- medium: tensions, protests, sanctions, diplomatic incidents
- low: background news, analysis, minor incidents`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(8000),
      }
    )

    if (!res.ok) return keywordClassify(title, description)

    const data = await res.json()
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)

    return {
      severity: SEVERITY_MAP[parsed.severity] ?? 1,
      category: parsed.category ?? 'political',
      escalation_signal: Boolean(parsed.escalation_signal),
      weapons_mentioned: Array.isArray(parsed.weapons_mentioned) ? parsed.weapons_mentioned : [],
      casualty_estimate: typeof parsed.casualty_estimate === 'number' ? parsed.casualty_estimate : null,
    }
  } catch {
    return keywordClassify(title, description)
  }
}
