export const revalidate = 0
export const dynamic = 'force-dynamic'

import { PredictionsClient } from '@/components/predictions/PredictionsClient'

export default function PredictionsPage() {
  return <PredictionsClient />
}
