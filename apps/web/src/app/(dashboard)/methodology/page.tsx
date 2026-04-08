export const revalidate = 3600 // Cache for 1 hour
export const dynamic = 'force-dynamic'

import { MethodologyClient } from '@/components/methodology/MethodologyClient'

export const metadata = {
  title: 'Risk Scoring Methodology | ConflictRadar',
  description: 'Transparent methodology documentation for ConflictRadar risk scoring. Learn how we calculate country risk scores.',
}

export default async function MethodologyPage() {
  // Fetch methodology from the API
  let methodologyData = null
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/v1/risk-scores/methodology`, {
      cache: 'force-cache',
      headers: {
        'Accept': 'application/json',
      },
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
