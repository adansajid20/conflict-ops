export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { OverviewClient } from '@/components/overview/OverviewClient'

export default async function OverviewPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return <OverviewClient />
}
