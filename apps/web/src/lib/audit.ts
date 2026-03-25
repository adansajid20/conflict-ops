import { createServiceClient } from '@/lib/supabase/server'

export async function writeAuditLog(params: {
  orgId: string
  actorId: string
  actorEmail?: string | null
  action: string
  resourceType: string
  resourceId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase.from('audit_log').insert({
      org_id: params.orgId,
      actor_id: params.actorId,
      actor_email: params.actorEmail ?? null,
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId ?? null,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
      metadata: params.metadata ?? {},
    })
  } catch {
    console.error('[audit] failed to write audit event:', params.action)
  }
}
