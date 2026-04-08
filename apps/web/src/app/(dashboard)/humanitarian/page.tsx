export const revalidate = 0
export const dynamic = 'force-dynamic'

import { HumanitarianClient } from '@/components/humanitarian/HumanitarianClient'

export default function HumanitarianPage() {
  return (
    <div className="flex h-full flex-col bg-[#070B11]">
      <HumanitarianClient />
    </div>
  )
}
