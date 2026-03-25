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

const handler = serve({
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
  signingKey: process.env['INNGEST_SIGNING_KEY'],
})

export const { GET, POST, PUT } = handler
