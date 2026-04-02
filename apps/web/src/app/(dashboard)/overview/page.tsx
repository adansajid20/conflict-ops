export const revalidate = 0

export const dynamic = 'force-dynamic'

import { OverviewClient } from '@/components/overview/OverviewClient'

export default async function OverviewPage() {
  return <OverviewClient />
}
