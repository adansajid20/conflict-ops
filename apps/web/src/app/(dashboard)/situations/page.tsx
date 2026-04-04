export const dynamic = 'force-dynamic'

import { SituationsClient } from '@/components/situations/SituationsClient'

export const metadata = { title: 'Active Situations — ConflictRadar' }

export default function SituationsPage() {
  return <SituationsClient />
}
