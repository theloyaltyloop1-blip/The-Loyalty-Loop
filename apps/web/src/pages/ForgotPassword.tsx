import * as React from 'react'
import { Link } from 'react-router-dom'
import { AUTH_REDIRECT_URL, supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { AuthLayout, AuthInput } from '@/components/auth-layout'

export function ForgotPassword() {
  const [email, setEmail] = React.useState('')
  const [sent, setSent] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    setLoading(true)
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${AUTH_REDIRECT_URL}/reset-password`,
    })
    setLoading(false)
    // Always show the same message, whether or not the address exists:
    // prevents account enumeration.
    setSent(true)
  }

  return (
    <AuthLayout title="Reset your password">
      {sent ? (
        <p className="rounded-xl bg-sage px-4 py-3 text-sage-ink">
          If an account exists for {email}, we've sent a password reset link to it.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <AuthInput
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          {error && <p className="text-destructive text-sm font-medium">{error}</p>}
          <Button type="submit" size="lg" disabled={loading}>
            {loading ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
      <Link to="/login" className="mt-2 text-sm font-semibold underline decoration-primary/60 underline-offset-4">
        Back to sign in
      </Link>
    </AuthLayout>
  )
}
