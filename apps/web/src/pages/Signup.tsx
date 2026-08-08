import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { AuthLayout, AuthInput, AuthLinks, AuthLinkLine } from '@/components/auth-layout'

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
  const [agreed, setAgreed] = React.useState(false)

  const refCode = searchParams.get('ref')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!agreed) { setError('Please accept the applicable legal documents to continue.'); return }
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
        data: {
          first_name: firstName,
          last_name: lastName,
          intent: asOwner ? 'business_owner' : 'consumer',
          ref_code: refCode ?? undefined,
          legal_accepted: true,
        },
      },
    })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }
    setCheckEmailSent(true)
  }

  if (checkEmailSent) {
    return (
      <AuthLayout title="Check your email">
        <p className="text-[#1a1a1a] font-semibold">
          We've sent a confirmation link to {email}. Follow it to finish setting up your account.
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Welcome to The Loyalty Loop">
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
        <label className="flex gap-2 text-sm text-[#1a1a1a]/70 items-start"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />{asOwner ? <>I agree to the <a href="/legal/merchant-agreement" className="underline font-bold">Merchant Agreement</a>, <a href="/legal/data-processing" className="underline font-bold">Data Processing Addendum</a>, <a href="/terms" className="underline font-bold">Terms</a> and <a href="/privacy" className="underline font-bold">Privacy Notice</a>.</> : <>I agree to the <a href="/terms" className="underline font-bold">Terms</a> and <a href="/privacy" className="underline font-bold">Privacy Notice</a>.</>}</label>
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
        <button
          type="submit"
          disabled={loading}
          className="h-14 rounded-lg bg-[#1a1a1a] text-white font-bold text-lg disabled:opacity-50"
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
