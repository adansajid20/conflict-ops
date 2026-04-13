import { MethodologyClient } from '@/components/methodology/MethodologyClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Risk Scoring Methodology | ConflictRadar',
  description: 'Transparent methodology documentation for ConflictRadar risk scoring. Learn how we calculate country risk scores.',
}

export default function MethodologyPage() {
  // Don't fetch server-side — MethodologyClient fetches via relative URL client-side
  // Server-to-server self-fetch deadlocks on Vercel
  return (
    <div className="flex h-full flex-col bg-[#070B11]">
      <MethodologyClient initialData={null} />
    </div>
  )
}
