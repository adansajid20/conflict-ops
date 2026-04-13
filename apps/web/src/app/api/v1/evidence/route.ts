import { createHash } from 'crypto'
import { safeAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@conflict-ops/shared'

type ChainEntry = { actor: string; action: string; at: string; note?: string }

type EvidenceRow = {
  id: string
  org_id: string | null
  title: string
  content_text: string | null
  hash_sha256: string | null
  chain_of_custody: ChainEntry[] | null
  captured_at: string | null
}

type CreateEvidenceBody = {
  title?: string
  content_text?: string
  mission_id?: string | null
  source_type?: string | null
  note?: string | null
}

function sha256(input: string) {
  return createHash('sha256').update(input).digest('hex')
}

async function getUserContext(userId: string): Promise<{ orgId: string | null; actor: string }> {
  const supabase = createServiceClient()
  const { data } = await supabase.from('users').select('id, org_id').eq('clerk_user_id', userId).single()
  return { orgId: data?.org_id ?? null, actor: data?.id ?? userId }
}

export async function GET(): Promise<NextResponse<ApiResponse<Array<EvidenceRow & { tamper_detected: boolean }>>>> {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const { orgId } = await getUserContext(userId)
  if (!orgId) return NextResponse.json({ success: true, data: [] })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('evidence')
    .select('id, org_id, title, content_text, hash_sha256, chain_of_custody, captured_at')
    .eq('org_id', orgId)
    .order('captured_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  const rows = ((data ?? []) as EvidenceRow[]).map((item) => ({
    ...item,
    tamper_detected: item.content_text ? sha256(item.content_text) !== item.hash_sha256 : false,
  }))

  return NextResponse.json({ success: true, data: rows })
}

export async function POST(req: Request): Promise<NextResponse<ApiResponse<EvidenceRow>>> {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as CreateEvidenceBody | null
  if (!body?.title || !body.content_text) {
    return NextResponse.json({ success: false, error: 'title and content_text are required' }, { status: 400 })
  }

  const { orgId, actor } = await getUserContext(userId)
  if (!orgId) return NextResponse.json({ success: false, error: 'No org found for user' }, { status: 400 })

  const chain: ChainEntry[] = [{ actor, action: 'created', at: new Date().toISOString(), note: body.note ?? 'Initial ingestion' }]
  const payload = {
    org_id: orgId,
    mission_id: body.mission_id ?? null,
    title: body.title,
    content_text: body.content_text,
    source_type: body.source_type ?? 'text',
    hash_sha256: sha256(body.content_text),
    chain_of_custody: chain,
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('evidence')
    .insert(payload)
    .select('id, org_id, title, content_text, hash_sha256, chain_of_custody, captured_at')
    .single()

  if (error || !data) return NextResponse.json({ success: false, error: error?.message ?? 'Insert failed' }, { status: 500 })
  return NextResponse.json({ success: true, data: data as EvidenceRow })
}
