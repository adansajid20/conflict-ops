export async function triggerPagerDuty(integrationKey: string, summary: string, severity: 'info' | 'warning' | 'error' | 'critical'): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routing_key: integrationKey,
        event_action: 'trigger',
        payload: {
          summary,
          severity,
          source: 'conflict-ops',
        },
      }),
    })

    if (!response.ok) return { success: false, error: `PagerDuty returned ${response.status}` }
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'PagerDuty delivery failed' }
  }
}
