'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en" data-theme="ops">
      <body style={{ margin: 0, background: '#080A0E', color: '#E6EDF3', fontFamily: 'ui-monospace, monospace' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
          <div style={{ color: '#00FF88', letterSpacing: '0.15em', fontSize: 12 }}>CONFLICTRADAR // SYSTEM ERROR</div>
          <h1 style={{ margin: 0, fontSize: 24 }}>CRITICAL FAULT DETECTED</h1>
          <p style={{ margin: 0, color: '#8B949E', fontSize: 14 }}>{error.message ?? 'An unexpected error occurred'}</p>
          {error.digest && (
            <code style={{ fontSize: 11, color: '#555', fontFamily: 'monospace' }}>digest: {error.digest}</code>
          )}
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button onClick={reset}
              style={{ padding: '8px 20px', background: '#00FF88', color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700 }}>
              RETRY
            </button>
            <a href="/" style={{ padding: '8px 20px', border: '1px solid #333', borderRadius: 4, color: '#8B949E', textDecoration: 'none', fontFamily: 'monospace' }}>
              ← HOME
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
