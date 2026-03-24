import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-base)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="classification-banner mb-4 inline-block px-4 py-1 rounded">
            CONFLICT OPS // NEW OPERATOR REGISTRATION
          </div>
          <h1 className="text-2xl font-bold tracking-widest uppercase" style={{ color: 'var(--primary)' }}>
            CONFLICT OPS
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            14-day free trial. No credit card required.
          </p>
        </div>
        <SignUp />
      </div>
    </div>
  )
}
