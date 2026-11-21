import * as React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AUTH_REDIRECT_URL, supabase, signInWithGoogle, signInWithApple } from '@/lib/supabase'
import { AuthLayout, AuthInput, AuthLinks, AuthLinkLine, GoogleButton, AppleButton, AuthDivider } from '@/components/auth-layout'
import { EmailCodeStep } from '@/components/email-code-step'
import { isExistingAccount } from '@/lib/email-code'

export function Signup({ asOwner = false }: { asOwner?: boolean }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
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
    const { data, error } = await supabase.auth.signUp({
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
    // Supabase sends nothing to an address that already has an account.
    if (isExistingAccount(data.user)) {
      setError('There is already an account with this email. Log in instead, or reset your password.')
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

    // AuthCallback sends a signed-in visitor to the right home for their role.
    if (data.session) navigate('/auth/callback', { replace: true })
    else setCheckEmailSent(true)
  }

  if (checkEmailSent) {
    return (
      <AuthLayout mascot="think" title={firstName.trim() ? `Nearly there, ${firstName.trim()}.` : 'Check your email'}>
        <EmailCodeStep
          email={email}
          purpose="signup"
          redirectTo={`${AUTH_REDIRECT_URL}/auth/callback`}
          onVerified={() => navigate('/auth/callback', { replace: true })}
          onChangeEmail={() => setCheckEmailSent(false)}
        />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      mascot="wave"
      title={asOwner ? 'Give your regulars a reason to come back.' : 'Your local shops want to say thanks.'}
      subtitle={asOwner ? 'Free to start, no hardware needed. Name your shop, pick a reward, and you’re ready to hand out stamps.' : 'Join a shop’s card for free and earn the rewards it offers. Nothing to carry.'}
    >
      <AppleButton onClick={() => signInWithApple(asOwner ? 'business_owner' : undefined).catch((e) => setError(e instanceof Error ? e.message : 'Could not sign in with Apple.'))} />
      <GoogleButton onClick={() => signInWithGoogle(asOwner ? 'business_owner' : undefined).catch((e) => setError(e instanceof Error ? e.message : 'Could not sign in with Google.'))} />
      <AuthDivider />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <AuthInput
            placeholder="First name"
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
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        <button data-press-feedback
          type="submit"
          disabled={loading}
          className="h-12 rounded-full bg-primary text-primary-foreground font-semibold text-base transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {loading ? 'Creating account…' : asOwner ? 'Create shop account' : 'Create free account'}
        </button>
      </form>

      <AuthLinks>
        <AuthLinkLine prompt="Already registered?" linkText="Log in" to="/login" />
        {asOwner ? (
          <AuthLinkLine prompt="Just here to earn rewards?" linkText="Sign up as a customer" to="/signup" />
        ) : (
          <AuthLinkLine
            prompt="Running a shop?"
            linkText="Sign up as a business"
            to="/signup/owner"
          />
        )}
      </AuthLinks>
    </AuthLayout>
  )
}
