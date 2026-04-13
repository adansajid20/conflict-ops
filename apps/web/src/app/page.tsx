import { safeAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function RootPage() {
  const { userId } = await safeAuth()
  if (userId) redirect('/overview')
  redirect('/landing')
}
