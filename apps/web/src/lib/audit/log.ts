import type { SupabaseClient } from '@supabase/supabase-js'

type AuditLogParams = {
  orgId: string
  userId: string | null
  action: string
  resourceType: string
  resourceId: string | null
  metadata?: Record<string, unknown>
  ipAddress?: string | null
}

export async function writeAuditLog(
  supabase: SupabaseClient,
  params: AuditLogParams,
): Promise<void> {
  const payload = {
    org_id: params.orgId,
    actor_id: params.userId,
    action: params.action,
    resource_type: params.resourceType,
    resource_id: params.resourceId,
    ip_address: params.ipAddress ?? null,
    metadata: params.metadata ?? {},
  }

  const { error } = await supabase.from('audit_log').insert(payload)
  if (error) {
    console.warn('[audit] failed to write audit log', error.message)
  }
}
