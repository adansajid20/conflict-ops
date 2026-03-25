export default function NotFound() {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#080A0E', color: '#E6EDF3', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
          <div style={{ color: '#00FF88', letterSpacing: '0.15em', fontSize: '14px' }}>CONFLICT OPS</div>
          <h1 style={{ margin: 0, fontSize: '28px' }}>404 — TARGET NOT FOUND</h1>
          <p style={{ margin: 0, color: '#8B949E' }}>The requested route does not exist.</p>
          <a href="/" style={{ color: '#00FF88', textDecoration: 'none' }}>← Return to dashboard</a>
        </div>
      </body>
    </html>
  )
}
