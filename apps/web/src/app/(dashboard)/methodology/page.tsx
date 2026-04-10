import { MethodologyClient } from '@/components/methodology/MethodologyClient'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Risk Scoring Methodology | ConflictRadar',
  description: 'Transparent methodology documentation for ConflictRadar risk scoring. Learn how we calculate country risk scores.',
}

export default async function MethodologyPage() {
  let methodologyData = null
  try {
    // Build absolute URL from request headers (works on Vercel and locally)
    const headersList = headers()
    const host = headersList.get('host') || 'localhost:3000'
    const protocol = headersList.get('x-forwarded-proto') || 'http'
    const baseUrl = `${protocol}://${host}`

    const res = await fetch(`${baseUrl}/api/v1/risk-scores/methodology`, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' },
    })
    if (res.ok) {
      const json = await res.json()
      methodologyData = json.data || null
    }
  } catch (error) {
    console.error('Failed to fetch methodology:', error)
  }

  return (
    <div className="flex h-full flex-col bg-[#070B11]">
      <MethodologyClient initialData={methodologyData} />
    </div>
  )
}
