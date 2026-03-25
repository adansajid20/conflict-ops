'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#080A0E', color: '#E6EDF3', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', padding: '24px' }}>
          <div style={{ color: '#EF4444', letterSpacing: '0.15em', fontSize: '14px' }}>SYSTEM FAULT</div>
          <h1 style={{ margin: 0, fontSize: '28px' }}>500 — INTERNAL ERROR</h1>
          <p style={{ margin: 0, color: '#8B949E', textAlign: 'center', maxWidth: '560px' }}>
            {error.message || 'Unexpected application error.'}
          </p>
          <button onClick={() => reset()} style={{ background: 'transparent', border: '1px solid #00FF88', color: '#00FF88', padding: '8px 14px', cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      </body>
    </html>
  )
}
