'use client'

import { useEffect, useMemo, useState } from 'react'

type CommentRecord = {
  id: string
  event_id: string
  body: string
  mentions: string[]
  created_at: string
  user?: { id: string; email: string | null; name: string | null } | null
}

type MemberRecord = {
  id: string
  email: string | null
  name: string | null
}

export function EventComments({ eventId }: { eventId: string }) {
  const [comments, setComments] = useState<CommentRecord[]>([])
  const [members, setMembers] = useState<MemberRecord[]>([])
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const suggestions = useMemo(() => {
    const match = body.match(/@([a-zA-Z0-9._-]*)$/)
    const needle = (match?.[1] ?? '').toLowerCase()
    if (!needle) return []
    return members.filter((member) => {
      const email = ((member.email ?? '').split('@')[0] ?? '').toLowerCase()
      const name = (member.name ?? '').toLowerCase().replace(/\s+/g, '')
      return email.includes(needle) || name.includes(needle)
    }).slice(0, 5)
  }, [body, members])

  useEffect(() => {
    const load = async () => {
      try {
        setError(null)
        const [commentsRes, orgRes] = await Promise.all([
          fetch(`/api/v1/events/comments?event_id=${encodeURIComponent(eventId)}`, { cache: 'no-store' }),
          fetch('/api/v1/enterprise/org', { cache: 'no-store' }),
        ])
        if (!commentsRes.ok) throw new Error(`Failed to load comments: ${commentsRes.statusText}`)
        if (!orgRes.ok) throw new Error(`Failed to load members: ${orgRes.statusText}`)
        const commentsJson = await commentsRes.json() as { data?: CommentRecord[] }
        const orgJson = await orgRes.json() as { data?: { members?: MemberRecord[] } }
        setComments(commentsJson.data ?? [])
        setMembers(orgJson.data?.members ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load comments and members')
      }
    }
    void load()
  }, [eventId])

  const submit = async () => {
    if (!body.trim()) return
    try {
      setSubmitError(null)
      const res = await fetch('/api/v1/events/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, body: body.trim() }),
      })
      if (!res.ok) throw new Error(`Failed to post comment: ${res.statusText}`)
      setBody('')
      // Reload comments after posting
      const [commentsRes, orgRes] = await Promise.all([
        fetch(`/api/v1/events/comments?event_id=${encodeURIComponent(eventId)}`, { cache: 'no-store' }),
        fetch('/api/v1/enterprise/org', { cache: 'no-store' }),
      ])
      const commentsJson = await commentsRes.json() as { data?: CommentRecord[] }
      const orgJson = await orgRes.json() as { data?: { members?: MemberRecord[] } }
      setComments(commentsJson.data ?? [])
      setMembers(orgJson.data?.members ?? [])
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to post comment')
    }
  }

  const applyMention = (value: string) => {
    setBody((current) => current.replace(/@([a-zA-Z0-9._-]*)$/, `@${value} `))
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          <strong>Error:</strong> {error}
        </div>
      )}
      <div className="relative">
        <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} placeholder="Add comment… Use @username to mention teammates."
          className="w-full rounded border border-white/[0.05] bg-white/[0.03] px-3 py-2 text-sm text-white" style={{ resize: 'vertical' }} />
        {suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded border border-white/[0.05] bg-white/[0.015]">
            {suggestions.map((member) => {
              const handle = (member.email ?? 'user').split('@')[0] ?? 'user'
              return (
                <button key={member.id} onClick={() => applyMention(handle)} className="block w-full px-3 py-2 text-left text-xs hover:bg-white/5 text-white">
                  @{handle} <span className="text-white/30">· {member.name ?? member.email}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <button onClick={() => void submit()} className="rounded bg-blue-500 px-4 py-2 text-xs mono font-bold text-white">POST COMMENT</button>
      </div>
      {submitError && (
        <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          <strong>Error:</strong> {submitError}
        </div>
      )}
      <div className="space-y-2">
        {comments.map((comment) => (
          <div key={comment.id} className="rounded border border-white/[0.05] bg-white/[0.03] p-3">
            <div className="mb-1 flex items-center justify-between gap-3">
              <div className="text-xs mono text-blue-400">{comment.user?.name ?? comment.user?.email ?? 'Operator'}</div>
              <div className="text-[10px] mono text-white/30">{new Date(comment.created_at).toLocaleString()}</div>
            </div>
            <div className="text-sm whitespace-pre-wrap text-white">{comment.body}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
