import { SignIn } from '../lib/auth'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-primary py-12 px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-bg-card p-8 shadow-2xl shadow-black/20">
        <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" />
        <div className="mt-6 rounded-2xl border border-border bg-bg-primary p-4 text-sm text-text-primary">
          <p className="text-text-secondary">Use these demo credentials:</p>
          <div className="mt-3 space-y-2 font-mono text-sm">
            <div className="flex items-center justify-between gap-3 rounded-lg bg-bg-secondary px-3 py-2">
              <span className="text-text-muted">Email</span>
              <span className="text-text-primary">demo@procureiq.app</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-bg-secondary px-3 py-2">
              <span className="text-text-muted">Password</span>
              <span className="text-text-primary">ProcureIQ-demo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
