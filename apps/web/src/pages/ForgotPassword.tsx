import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AUTH_REDIRECT_URL, supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { AuthLayout, AuthInput } from '@/components/auth-layout'
import { EmailCodeStep } from '@/components/email-code-step'

export function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = React.useState('')
  const [sent, setSent] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    setLoading(true)
    try {
      // The email has a code and, during the switch to codes, the old link too.
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${AUTH_REDIRECT_URL}/reset-password`,
      })
      if (error) throw error
      // Supabase doesn't reveal whether the address exists, so success always
      // shows the same step: prevents account enumeration.
      setSent(true)
    } catch {
      setError('We couldn’t send the email. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  function finished() {
    setDone(true)
    // AuthCallback sends a signed-in visitor to the right home for their role.
    window.setTimeout(() => navigate('/auth/callback', { replace: true }), 1500)
  }

  return (
    <AuthLayout title={done ? 'Password changed' : sent ? 'Check your email' : 'Reset your password'} mascot={sent && !done ? 'think' : undefined}>
      {done ? (
        <p role="status" className="rounded-xl bg-sage px-4 py-3 text-sage-ink">Your new password is saved and you're signed in. Taking you to your account…</p>
      ) : sent ? (
        <EmailCodeStep
          email={email}
          purpose="recovery"
          redirectTo={`${AUTH_REDIRECT_URL}/reset-password`}
          onVerified={finished}
          onChangeEmail={() => setSent(false)}
        />
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-muted-foreground">We'll email you a 6-digit code to choose a new password.</p>
          <AuthInput
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          {error && <p role="alert" className="text-destructive text-sm font-medium">{error}</p>}
          <Button type="submit" size="lg" disabled={loading}>
            {loading ? 'Sending…' : 'Send code'}
          </Button>
        </form>
      )}
      {!done && (
        <Link to="/login" className="mt-2 text-sm font-semibold underline decoration-primary/60 underline-offset-4">
          Back to sign in
        </Link>
      )}
    </AuthLayout>
  )
}
