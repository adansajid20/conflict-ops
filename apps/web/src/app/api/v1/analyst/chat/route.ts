export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

type ToolInput = Record<string, unknown>

const TOOLS = [
  {
    name: 'search_events',
    description: 'Search geopolitical events by region, severity, category, keyword, or date range',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string' },
        region: { type: 'string' },
        severity: { type: 'number', description: '1-4 integer, 4=critical' },
        category: { type: 'string' },
        hours_ago: { type: 'number' },
        limit: { type: 'number' },
      },
      required: [],
    },
  },
  {
    name: 'get_risk_scores',
    description: 'Get current risk scores for regions',
    input_schema: {
      type: 'object' as const,
      properties: {
        region: { type: 'string' },
        limit: { type: 'number' },
      },
      required: [],
    },
  },
  {
    name: 'get_predictions',
    description: 'Get active AI predictions of what might happen next',
    input_schema: {
      type: 'object' as const,
      properties: {
        region: { type: 'string' },
        min_probability: { type: 'number' },
      },
      required: [],
    },
  },
  {
    name: 'get_correlations',
    description: 'Get active cross-stream correlation signals',
    input_schema: {
      type: 'object' as const,
      properties: {
        region: { type: 'string' },
        pattern_type: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'get_actors',
    description: 'Get information about geopolitical actors and their activity',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string' },
        actor_type: { type: 'string' },
        region: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'get_situation_clusters',
    description: 'Get developing situations (event clusters) with escalation trajectory',
    input_schema: {
      type: 'object' as const,
      properties: {
        region: { type: 'string' },
        escalating_only: { type: 'boolean' },
      },
      required: [],
    },
  },
  {
    name: 'get_country_profile',
    description: 'Get comprehensive risk profile for a specific country',
    input_schema: {
      type: 'object' as const,
      properties: { country: { type: 'string' } },
      required: ['country'],
    },
  },
  {
    name: 'get_commodity_prices',
    description: 'Get current commodity prices (oil, gold, wheat, etc.)',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbols: { type: 'array', items: { type: 'string' } },
      },
      required: [],
    },
  },
  {
    name: 'get_tracking_data',
    description: 'Get live tracking: military flights, vessel positions, seismic events, fire detections, internet outages',
    input_schema: {
      type: 'object' as const,
      properties: {
        data_type: { type: 'string', enum: ['flights', 'vessels', 'seismic', 'fires', 'outages'] },
        zone: { type: 'string' },
        military_only: { type: 'boolean' },
      },
      required: ['data_type'],
    },
  },
]

async function executeTool(name: string, input: ToolInput): Promise<string> {
  const supabase = createServiceClient()

  switch (name) {
    case 'search_events': {
      let query = supabase.from('events').select('id,title,severity,category,region,source,summary,occurred_at')
      if (input.region) query = query.ilike('region', `%${input.region}%`)
      if (input.severity) query = query.eq('severity', input.severity)
      if (input.category) query = query.ilike('category', `%${input.category}%`)
      if (input.hours_ago) query = query.gte('occurred_at', new Date(Date.now() - (input.hours_ago as number) * 3600000).toISOString())
      if (input.query) query = query.ilike('title', `%${input.query}%`)
      const { data } = await query.order('occurred_at', { ascending: false }).limit((input.limit as number) || 20)
      return JSON.stringify(data ?? [])
    }
    case 'get_risk_scores': {
      let query = supabase.from('region_risk_scores').select('*')
      if (input.region) query = query.ilike('region', `%${input.region}%`)
      const { data } = await query.order('score', { ascending: false }).limit((input.limit as number) || 15)
      return JSON.stringify(data ?? [])
    }
    case 'get_predictions': {
      let query = supabase.from('predictions').select('*').gt('expires_at', new Date().toISOString()).is('outcome', null)
      if (input.region) query = query.ilike('region', `%${input.region}%`)
      if (input.min_probability) query = query.gte('probability', input.min_probability)
      const { data } = await query.order('probability', { ascending: false }).limit(10)
      return JSON.stringify(data ?? [])
    }
    case 'get_correlations': {
      let query = supabase.from('correlation_signals').select('*').gt('detected_at', new Date(Date.now() - 24 * 3600000).toISOString())
      if (input.region) query = query.ilike('region', `%${input.region}%`)
      if (input.pattern_type) query = query.eq('pattern_type', input.pattern_type)
      const { data } = await query.order('detected_at', { ascending: false }).limit(10)
      return JSON.stringify(data ?? [])
    }
    case 'get_actors': {
      let query = supabase.from('actors').select('id,name,display_name,actor_type,type,region,country_code,event_count,influence_score,threat_level')
      if (input.name) query = query.ilike('name', `%${input.name}%`)
      if (input.actor_type) query = query.eq('actor_type', input.actor_type)
      if (input.region) query = query.or(`region.ilike.%${input.region}%,country_code.ilike.%${input.region}%`)
      const { data } = await query.order('event_count', { ascending: false }).limit(20)
      return JSON.stringify(data ?? [])
    }
    case 'get_situation_clusters': {
      let query = supabase.from('event_clusters').select('*')
      if (input.region) query = query.ilike('location', `%${input.region}%`)
      const { data } = await query.order('source_count', { ascending: false }).limit(10)
      return JSON.stringify(data ?? [])
    }
    case 'get_country_profile': {
      const { data } = await supabase.from('country_profiles').select('*').ilike('country_name', `%${input.country}%`).limit(1).single()
      return JSON.stringify(data ?? {})
    }
    case 'get_commodity_prices': {
      const symbols = (input.symbols as string[]) || ['CL=F', 'BZ=F', 'GC=F', 'ZW=F', 'NG=F']
      const { data } = await supabase.from('commodity_prices').select('*').in('symbol', symbols).order('recorded_at', { ascending: false }).limit(20)
      return JSON.stringify(data ?? [])
    }
    case 'get_tracking_data': {
      if (input.data_type === 'flights') {
        let q = supabase.from('flight_tracks').select('*')
        if (input.zone) q = q.eq('zone_name', input.zone)
        if (input.military_only) q = q.eq('is_military', true)
        const { data } = await q.order('last_seen', { ascending: false }).limit(50)
        return JSON.stringify(data ?? [])
      }
      if (input.data_type === 'vessels') {
        const { data } = await supabase.from('vessel_tracks').select('*').order('last_seen', { ascending: false }).limit(50)
        return JSON.stringify(data ?? [])
      }
      if (input.data_type === 'seismic') {
        const { data } = await supabase.from('seismic_events').select('*').order('event_time', { ascending: false }).limit(30)
        return JSON.stringify(data ?? [])
      }
      if (input.data_type === 'fires') {
        const { data } = await supabase.from('fire_detections').select('*').eq('possible_strike', true).order('created_at', { ascending: false }).limit(30)
        return JSON.stringify(data ?? [])
      }
      if (input.data_type === 'outages') {
        const { data } = await supabase.from('internet_outages').select('*').order('start_time', { ascending: false }).limit(20)
        return JSON.stringify(data ?? [])
      }
      return '[]'
    }
    default:
      return 'Unknown tool'
  }
}

type MsgContent = string | Array<Record<string, unknown>>
type Msg = { role: 'user' | 'assistant'; content: MsgContent }

async function callClaude(messages: Msg[], systemPrompt: string) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('No ANTHROPIC_API_KEY')
  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    }),
  })
  return res.json() as Promise<{
    stop_reason: string
    content: Array<{ type: string; text?: string; id?: string; name?: string; input?: ToolInput }>
  }>
}

const SYSTEM_PROMPT = `You are "Radar" — ConflictRadar's AI intelligence analyst. You have access to a live geopolitical intelligence database with real-time data from news feeds, military flight tracking, maritime vessel tracking, seismic monitoring, satellite fire detection, and internet outage detection.

When asked about a region or situation, always check: events, risk scores, predictions, correlations, and relevant tracking data. Be specific — cite event counts, risk scores, probabilities. Respond like a senior analyst giving a briefing: direct, data-backed, no filler. Flag early warnings and anomalies. If uncertain, say so. Never fabricate intelligence.`

export async function POST(req: NextRequest) {
  // Auth check
  const { auth } = await import('@clerk/nextjs/server')
  const { userId: authUserId } = await auth()
  if (!authUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit: 20 requests per minute per user (tool-use loops are expensive)
  const { checkRateLimit, AI_RATE_LIMIT } = await import('@/lib/rate-limit')
  const rl = await checkRateLimit(authUserId, AI_RATE_LIMIT.prefix, AI_RATE_LIMIT.maxRequests, AI_RATE_LIMIT.windowSeconds)
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded. Please wait a moment.' }, { status: 429 })

  const supabase = createServiceClient()
  try {
    const body = await req.json() as { message?: string; conversation_id?: string; user_id?: string }
    const { message, conversation_id } = body
    const user_id = authUserId // Always use authenticated user, ignore body.user_id
    if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 })

    // Load conversation history
    let history: Msg[] = []
    let convId = conversation_id
    if (convId) {
      const { data: conv } = await supabase.from('analyst_conversations').select('messages').eq('id', convId).eq('user_id', user_id).single()
      if (conv?.messages) history = conv.messages as Msg[]
    }

    history.push({ role: 'user', content: message })
    let messages: Msg[] = [...history]

    // Tool-use loop
    let response = await callClaude(messages, SYSTEM_PROMPT)
    let iterations = 0

    while (response.stop_reason === 'tool_use' && iterations < 5) {
      iterations++
      const toolBlocks = response.content.filter(b => b.type === 'tool_use')
      const toolResults: Array<Record<string, unknown>> = []

      for (const block of toolBlocks) {
        const result = await executeTool(block.name!, block.input ?? {})
        toolResults.push({ type: 'tool_result', tool_use_id: block.id!, content: result })
      }

      messages.push({ role: 'assistant', content: response.content as Array<Record<string, unknown>> })
      messages.push({ role: 'user', content: toolResults })
      response = await callClaude(messages, SYSTEM_PROMPT)
    }

    const assistantText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text ?? '')
      .join('')

    history.push({ role: 'assistant', content: assistantText })

    // Save conversation
    if (convId) {
      await supabase.from('analyst_conversations').update({ messages: history, updated_at: new Date().toISOString() }).eq('id', convId)
    } else {
      const { data: newConv } = await supabase.from('analyst_conversations').insert({
        user_id,
        title: message.slice(0, 80),
        messages: history,
      }).select('id').single()
      convId = newConv?.id
    }

    return NextResponse.json({ response: assistantText, conversation_id: convId })
  } catch (e) {
    console.error('Analyst chat error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
