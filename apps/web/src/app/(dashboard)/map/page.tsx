export default function MapPage() {
  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold tracking-widest uppercase mono" style={{ color: 'var(--text-primary)' }}>
          MAP
        </h1>
      </div>
      <div
        className="rounded border p-12 text-center"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      >
        <div className="text-xs mono" style={{ color: 'var(--text-muted)' }}>
          NO DATA — MODULE INITIALIZING. AVAILABLE IN PHASE 2.
        </div>
      </div>
    </div>
  )
}
