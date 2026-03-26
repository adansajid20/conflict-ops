import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type SatRequest = { tool?: string; input?: string }

const FALLBACK_PROMPTS: Record<string, string[]> = {
  'red-team': [
    'What is the strongest alternative explanation for the current assessment?',
    'Which assumptions fail first under adversary adaptation?',
    'What evidence would most cleanly falsify the thesis?',
    'Where are we overfitting to recent events or salience bias?',
    'What second-order effects are being ignored?',
    'What would the opposing analyst say in a hostile review?',
  ],
  'devils-advocacy': [
    'State the main judgment in one sentence.',
    'List the top 3 reasons it could be wrong.',
    'Identify disconfirming evidence already present.',
    'What bias or institutional incentive might be shaping the view?',
    'What lower-confidence interpretation fits the same facts?',
    'What would make you downgrade confidence tomorrow?',
  ],
  'key-assumptions': [
    'List the assumptions beneath the assessment.',
    'Which assumptions are most uncertain?',
    'Which assumptions matter most to the outcome?',
    'What indicators would warn that an assumption is breaking?',
    'What contingency plans map to each broken assumption?',
    'What collection gaps prevent validation?',
  ],
  'argument-mapping': [
    'Define the main claim.',
    'List supporting premises.',
    'List rebuttals and counter-rebuttals.',
    'Mark which premises are evidenced vs inferred.',
    'Identify the weakest inferential link.',
  ],
  qoic: [
    'What is the source type and access level?',
    'Is the information first-hand, second-hand, or recycled?',
    'How timely is it relative to the claim?',
    'What corroboration exists?',
    'What confidence should attach to each claim fragment?',
  ],
  'timeline-analysis': [
    'List the critical events in order.',
    'Identify pace changes or escalation markers.',
    'What precursor indicators appeared before the inflection point?',
    'Which actors changed behavior and when?',
    'What is the next likely milestone if the sequence persists?',
  ],
}

function streamText(text: string) {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text))
      controller.close()
    },
  })
}

export async function POST(req: Request) {
  let body: SatRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const tool = (body.tool ?? '').trim()
  const input = (body.input ?? '').trim()
  if (!tool || !input) return NextResponse.json({ error: 'tool and input are required' }, { status: 400 })

  const prompts = FALLBACK_PROMPTS[tool] ?? FALLBACK_PROMPTS['red-team'] ?? []
  const fallback = `AI analysis requires an API key. Configure OPENAI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY in your environment.\n\nManual ${tool} framework:\n${prompts.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\nInput:\n${input}`

  return new Response(streamText(fallback), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    status: 200,
  })
}
