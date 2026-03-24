import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { fastLaneIngest, heavyLaneProcess, forecastRecompute } from '@/inngest/functions'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [fastLaneIngest, heavyLaneProcess, forecastRecompute],
})
