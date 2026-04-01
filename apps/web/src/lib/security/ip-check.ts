import { createServiceClient } from '@/lib/supabase/server'

function normalizeIp(input: string): string {
  const value = input.trim()
  if (!value) return ''
  if (value.startsWith('::ffff:')) return value.slice(7)
  return value
}

function ipToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  const nums = parts.map((part) => Number(part))
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null
  return nums.reduce((acc, n) => (acc << 8) + n, 0) >>> 0
}

function matchesCidr(ip: string, cidr: string): boolean {
  const [range, bitsText] = cidr.split('/')
  if (!range || !bitsText) return false
  const ipInt = ipToInt(ip)
  const rangeInt = ipToInt(range)
  const bits = Number(bitsText)

  if (ipInt === null || rangeInt === null || Number.isNaN(bits) || bits < 0 || bits > 32) {
    return false
  }

  const mask = bits === 0 ? 0 : (~((1 << (32 - bits)) - 1)) >>> 0
  return (ipInt & mask) === (rangeInt & mask)
}

export function extractRequestIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]
    return normalizeIp(first ?? '')
  }
  return normalizeIp(request.headers.get('x-real-ip') ?? '')
}

export async function isIPAllowed(orgId: string, requestIP: string): Promise<boolean> {
  const normalizedIp = normalizeIp(requestIP)
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('orgs').select('ip_allowlist').eq('id', orgId).single()

  if (error || !data) {
    return true
  }

  const allowlist = Array.isArray(data.ip_allowlist) ? data.ip_allowlist.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) : []
  if (allowlist.length === 0) {
    return true
  }

  if (!normalizedIp) {
    return false
  }

  return allowlist.some((entry) => {
    const normalizedEntry = normalizeIp(entry)
    if (normalizedEntry.includes('/')) {
      return matchesCidr(normalizedIp, normalizedEntry)
    }
    return normalizedIp === normalizedEntry
  })
}
