import * as React from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, LockKeyhole, MessageCircle } from 'lucide-react'
import { AUTH_REDIRECT_URL, supabase } from '@/lib/supabase'
import { AuthInput, AuthLayout } from '@/components/auth-layout'

type Handoff = {
  kind: 'signup'
  email: string
  firstName: string | null
  business: { name: string; slug: string } | null
}

export function WhatsAppOnboarding() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const [handoff, setHandoff] = React.useState<Handoff | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [mode, setMode] = React.useState<'create' | 'signin'>('create')
  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [confirmationSent, setConfirmationSent] = React.useState(false)

  React.useEffect(() => {
    if (token.length < 32) {
      setError('This WhatsApp link is invalid. Return to WhatsApp and send START again.')
      setLoading(false)
      return
    }
    supabase.functions.invoke<Handoff>('whatsapp-handoff', { body: { action: 'signup', token } })
      .then(({ data, error: requestError }) => {
        if (requestError || !data) throw requestError ?? new Error('This link has expired.')
        setHandoff(data)
      })
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : 'This link has expired.'))
      .finally(() => setLoading(false))
  }, [token])

  async function finishLinking() {
    const { data, error: completionError } = await supabase.rpc('complete_whatsapp_signup', { _token: token })
    if (completionError) throw completionError
    const slug = (data as { business_slug?: string | null } | null)?.business_slug
    navigate(slug ? `/dashboard/shop/${slug}` : '/dashboard', { replace: true })
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!handoff) return
    setError(null)
    if (password.length < 8) return setError('Choose a password with at least 8 characters.')
    if (mode === 'create' && password !== confirmPassword) return setError('Passwords do not match.')
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: handoff.email, password })
        if (signInError) throw signInError
        await finishLinking()
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: handoff.email,
          password,
          options: {
            emailRedirectTo: `${AUTH_REDIRECT_URL}/auth/callback?whatsapp_token=${encodeURIComponent(token)}`,
            data: { first_name: handoff.firstName ?? undefined, intent: 'consumer' },
          },
        })
        if (signUpError) throw signUpError
        if (data.session) await finishLinking()
        else setConfirmationSent(true)
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'We could not complete your account.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <AuthLayout title="Opening your loyalty card"><p className="text-foreground/65">Just a moment while we secure your details.</p></AuthLayout>
  if (error && !handoff) return <AuthLayout title="That link has expired"><p className="font-semibold text-red-600">{error}</p><Link className="mt-5 inline-block font-bold text-primary" to="/">Back to The Loyalty Loop</Link></AuthLayout>
  if (!handoff) return null
  if (confirmationSent) return <AuthLayout title="Check your email"><p className="font-semibold text-foreground">We’ve sent a confirmation link to {handoff.email}. Open it to finish linking WhatsApp to your Loyalty Loop account.</p></AuthLayout>

  return (
    <AuthLayout title={mode === 'create' ? 'Secure your rewards' : 'Link your account'}>
      <div className="mb-6 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm">
        <div className="flex items-center gap-2 font-bold text-foreground"><MessageCircle className="h-4 w-4 text-primary" />From WhatsApp{handoff.business ? ` · ${handoff.business.name}` : ''}</div>
        <p className="mt-2 text-foreground/65">Your password is entered only here, never in WhatsApp.</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="text-sm font-bold text-foreground">Email address</label>
        <AuthInput value={handoff.email} readOnly aria-label="Email address" className="-mt-2 bg-black/[.03] text-foreground/70" />
        <AuthInput type="password" placeholder={mode === 'create' ? 'Choose a password' : 'Your password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === 'create' ? 'new-password' : 'current-password'} />
        {mode === 'create' && <AuthInput type="password" placeholder="Confirm password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} autoComplete="new-password" />}
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        <button data-press-feedback type="submit" disabled={busy} className="flex h-14 items-center justify-center gap-2 rounded-lg bg-foreground text-lg font-bold text-white disabled:opacity-50">
          <LockKeyhole className="h-4 w-4" />{busy ? 'Please wait…' : mode === 'create' ? 'Create secure account' : 'Sign in and link WhatsApp'}
        </button>
      </form>
      <button data-press-feedback type="button" onClick={() => { setMode(mode === 'create' ? 'signin' : 'create'); setError(null); setPassword(''); setConfirmPassword('') }} className="mt-5 text-sm font-bold text-primary">
        {mode === 'create' ? 'Already have an account? Sign in' : 'New to The Loyalty Loop? Create an account'}
      </button>
      <p className="mt-5 flex gap-2 text-xs leading-5 text-foreground/55"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-fun-green" />Your WhatsApp number is linked only after you have securely signed in or confirmed your email.</p>
    </AuthLayout>
  )
}
