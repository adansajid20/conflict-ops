import { generateBrief } from '@/lib/ai/openai'
import type { ReportSection } from '@/lib/reports/types'

type ReportEvent = {
  id: string
  title: string | null
  description: string | null
  severity: number | null
  country_code: string | null
  occurred_at: string | null
}

export async function generateIntelReportSummary(params: {
  title: string
  classification: string
  sections: ReportSection[]
  events: ReportEvent[]
}): Promise<string> {
  if (!process.env['OPENAI_API_KEY']) {
    const titles = params.events.map((event) => event.title).filter((value): value is string => Boolean(value)).slice(0, 3)
    return `Executive summary unavailable because OPENAI_API_KEY is not configured. Report: ${params.title}. Classification: ${params.classification}. Key referenced events: ${titles.join('; ') || 'No linked events'}.`
  }

  const context = JSON.stringify({
    title: params.title,
    classification: params.classification,
    sections: params.sections,
    events: params.events,
  })

  return generateBrief(context, 'daily', 300)
}
