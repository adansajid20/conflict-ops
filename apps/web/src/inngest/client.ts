import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id: 'conflict-ops',
  name: 'CONFLICTRADAR',
  eventKey: process.env['INNGEST_EVENT_KEY'],
})
