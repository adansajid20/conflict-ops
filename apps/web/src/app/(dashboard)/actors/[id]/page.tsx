export const dynamic = 'force-dynamic'
import { ActorDetailClient } from '@/components/actors/ActorDetailClient'
export const metadata = { title: 'Actor — ConflictRadar' }
export default function ActorDetailPage({ params }: { params: { id: string } }) {
  return <ActorDetailClient id={params.id} />
}
