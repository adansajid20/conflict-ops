export const revalidate = 0
export const dynamic = 'force-dynamic'

import { SituationRoomClient } from '@/components/situation-room/SituationRoomClient'

export default function SituationRoomPage() {
  return (
    <div className="flex h-full flex-col bg-[#070B11]">
      <SituationRoomClient />
    </div>
  )
}
