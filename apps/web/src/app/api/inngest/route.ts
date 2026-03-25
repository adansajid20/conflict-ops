export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import {
  fastLaneIngest,
  heavyLaneProcess,
  forecastRecompute,
  escalationMonitor,
  trackingIngest,
  weeklyBrief,
  trialExpiryNotifier,
} from '@/inngest/functions'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    fastLaneIngest,
    heavyLaneProcess,
    forecastRecompute,
    escalationMonitor,
    trackingIngest,
    weeklyBrief,
    trialExpiryNotifier,
  ],
})
