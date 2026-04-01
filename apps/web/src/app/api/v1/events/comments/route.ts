import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@conflict-ops/shared'

const CreateCommentSchema = z.object({
  event_id: z.string().min(1),
  body: z.string().min(1).max(5000),
})

type CommentRecord = {
  id: string
  event_id: string
  body: string
  mentions: string[]
  created_at: string
  user_id: string | null
  user?: { id: string; email: string | null; name: string | null } | null
}

const mentionPattern = /@([a-zA-Z0-9._-]+)/g

async function getUserContext(clerkUserId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase.from('users').select('id,org_id,email,name').eq('clerk_user_id', clerkUserId).single()
  return data
}

export async function GET(req: Request): Promise<NextResponse<ApiResponse<CommentRecord[]>>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const actor = await getUserContext(userId)
  if (!actor?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })

  const eventId = new URL(req.url).searchParams.get('event_id')
  if (!eventId) return NextResponse.json({ success: false, error: 'Missing event_id' }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('event_comments')
    .select('id,event_id,body,mentions,created_at,user_id')
    .eq('org_id', actor.org_id)
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  const comments = (data ?? []) as CommentRecord[]
  const userIds = comments.map((comment) => comment.user_id).filter((value): value is string => Boolean(value))
  const { data: users } = userIds.length > 0
    ? await supabase.from('users').select('id,email,name').in('id', userIds)
    : { data: [] as Array<{ id: string; email: string | null; name: string | null }> }

  const byId = new Map((users ?? []).map((user) => [user.id, user]))
  return NextResponse.json({
    success: true,
    data: comments.map((comment) => ({ ...comment, user: comment.user_id ? byId.get(comment.user_id) ?? null : null })),
  })
}

export async function POST(req: Request): Promise<NextResponse<ApiResponse<CommentRecord>>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const actor = await getUserContext(userId)
  if (!actor?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = CreateCommentSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })

  const supabase = createServiceClient()
  const { data: members } = await supabase.from('users').select('id,email,name').eq('org_id', actor.org_id)

  const matches = [...parsed.data.body.matchAll(mentionPattern)]
  const mentions = matches.map((match) => (match[1] ?? '').toLowerCase()).filter(Boolean)
  const mentionedUsers = (members ?? []).filter((member) => {
    const email = (member.email ?? '').split('@')[0].toLowerCase()
    const name = (member.name ?? '').toLowerCase().replace(/\s+/g, '')
    return mentions.includes(email) || mentions.includes(name)
  })

  const { data, error } = await supabase
    .from('event_comments')
    .insert({
      org_id: actor.org_id,
      event_id: parsed.data.event_id,
      user_id: actor.id,
      body: parsed.data.body,
      mentions: mentionedUsers.map((user) => user.id),
    })
    .select('id,event_id,body,mentions,created_at,user_id')
    .single()

  if (error || !data) return NextResponse.json({ success: false, error: error?.message ?? 'Failed to create comment' }, { status: 500 })

  if (mentionedUsers.length > 0) {
    await supabase.from('notifications').insert(
      mentionedUsers
        .filter((member) => member.id !== actor.id)
        .map((member) => ({
          user_id: member.id,
          org_id: actor.org_id,
          type: 'mention',
          body: `${actor.name ?? actor.email ?? 'A teammate'} mentioned you in an event comment.`,
          metadata: { event_id: parsed.data.event_id, comment_id: data.id },
        }))
    )
  }

  return NextResponse.json({ success: true, data: { ...(data as CommentRecord), user: { id: actor.id, email: actor.email ?? null, name: actor.name ?? null } } }, { status: 201 })
}
