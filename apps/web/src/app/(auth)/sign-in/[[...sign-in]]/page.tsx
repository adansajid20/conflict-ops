import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-base)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="classification-banner mb-4 inline-block px-4 py-1 rounded">
            CONFLICTRADAR // SECURE ACCESS
          </div>
          <h1 className="text-2xl font-bold tracking-widest uppercase" style={{ color: 'var(--primary)' }}>
            CONFLICTRADAR
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            Geopolitical Intelligence Platform
          </p>
        </div>
        <SignIn />
      </div>
    </div>
  )
}
