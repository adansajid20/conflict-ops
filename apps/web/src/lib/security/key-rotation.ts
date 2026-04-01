import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'

export async function rotateApiKey(keyId: string, orgId: string): Promise<{ id: string; name: string; key_prefix: string; created_at: string; key: string } | null> {
  const supabase = createServiceClient()
  const { data: existing, error } = await supabase
    .from('api_keys')
    .select('id,name,org_id,created_by,scopes,expires_at')
    .eq('id', keyId)
    .eq('org_id', orgId)
    .single()

  if (error || !existing) {
    return null
  }

  const rawKey = `cok_live_${crypto.randomBytes(32).toString('hex')}`
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
  const keyPrefix = rawKey.slice(0, 16) + '...'

  await supabase.from('api_keys').update({ active: false, revoked_at: new Date().toISOString() }).eq('id', keyId).eq('org_id', orgId)

  const { data: created, error: createError } = await supabase
    .from('api_keys')
    .insert({
      org_id: orgId,
      created_by: existing.created_by,
      name: existing.name,
      scopes: existing.scopes ?? [],
      expires_at: existing.expires_at,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      active: true,
      rotated_from: existing.id,
    })
    .select('id,name,key_prefix,created_at')
    .single()

  if (createError || !created) {
    return null
  }

  return { ...created, key: rawKey }
}
