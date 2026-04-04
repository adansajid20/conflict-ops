export const dynamic = 'force-dynamic'

import { SituationDetailClient } from '@/components/situations/SituationDetailClient'

export const metadata = { title: 'Situation — ConflictRadar' }

export default function SituationDetailPage({ params }: { params: { slug: string } }) {
  return <SituationDetailClient slug={params.slug} />
}
