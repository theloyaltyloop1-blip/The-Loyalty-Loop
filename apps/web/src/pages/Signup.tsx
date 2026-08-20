import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { AUTH_REDIRECT_URL, supabase, signInWithGoogle } from '@/lib/supabase'
import { AuthLayout, AuthInput, AuthLinks, AuthLinkLine, GoogleButton, AuthDivider } from '@/components/auth-layout'

export function Signup({ asOwner = false }: { asOwner?: boolean }) {
  const [searchParams] = useSearchParams()
  const [firstName, setFirstName] = React.useState('')
  const [lastName, setLastName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [checkEmailSent, setCheckEmailSent] = React.useState(false)

  const refCode = searchParams.get('ref')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${AUTH_REDIRECT_URL}/auth/callback`,
        data: {
          first_name: firstName,
          last_name: lastName,
          intent: asOwner ? 'business_owner' : 'consumer',
          ref_code: refCode ?? undefined,
        },
      },
    })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    if (asOwner) {
      // Fire-and-forget: sends the welcome email with the legal documents
      // attached. There's no session yet (email confirmation is required
      // before one exists), so this call is unauthenticated by design — the
      // function itself verifies server-side that this is a genuine, fresh
      // owner signup before sending anything. A failure here should never
      // block or dirty the sign-up flow the user is looking at.
      supabase.functions
        .invoke('send-owner-legal-documents', { body: { email, site_url: window.location.origin } })
        .catch(() => undefined)
    }

    setCheckEmailSent(true)
  }

  if (checkEmailSent) {
    return (
      <AuthLayout title="Check your email">
        <p className="text-foreground font-semibold">
          We've sent a confirmation link to {email}. Follow it to finish setting up your account.
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Welcome to The Loyalty Loop">
      <GoogleButton onClick={() => signInWithGoogle(asOwner ? 'business_owner' : undefined).catch((e) => setError(e instanceof Error ? e.message : 'Could not sign in with Google.'))} />
      <AuthDivider />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <AuthInput
            placeholder="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <AuthInput
            placeholder="Surname"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
        <AuthInput
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <AuthInput
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
        <AuthInput
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        <button data-press-feedback
          type="submit"
          disabled={loading}
          className="h-14 rounded-lg bg-foreground text-white font-bold text-lg disabled:opacity-50"
        >
          {loading ? 'Creating account…' : asOwner ? 'Create shop account' : 'Sign up'}
        </button>
      </form>

      <AuthLinks>
        <AuthLinkLine prompt="Already registered? –" linkText="Log in" to="/login" />
        {asOwner ? (
          <AuthLinkLine prompt="Just here to collect stamps? –" linkText="Sign up as a customer" to="/signup" />
        ) : (
          <AuthLinkLine
            prompt="Signing up as business? –"
            linkText="Sign up as a Loyalty Loop Retailer"
            to="/signup/owner"
          />
        )}
      </AuthLinks>
    </AuthLayout>
  )
}
