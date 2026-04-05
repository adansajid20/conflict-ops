export const revalidate = 0
export const dynamic = 'force-dynamic'

import { ActorNetworkClient } from '@/components/actors/ActorNetworkClient'

export default function ActorsPage() {
  return <ActorNetworkClient />
}
