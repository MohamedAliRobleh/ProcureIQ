import { SignIn } from '../lib/auth'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary py-12">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" />
    </div>
  )
}
