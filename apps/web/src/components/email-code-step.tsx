import * as React from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { AuthInput } from '@/components/auth-layout'
import { RESEND_SECONDS, cleanCode, codeErrorMessage, isCompleteCode } from '@/lib/email-code'

/** "Type the code from your email" step, shown inside an AuthLayout.
 * `signup` confirms a new account; `recovery` also asks for a new password and
 * saves it. Either way the visitor ends up signed in and `onVerified` runs.
 * Resent emails still carry the old link (`redirectTo`) for anyone who clicks
 * it instead. */
export function EmailCodeStep({
  email,
  purpose,
  redirectTo,
  onVerified,
  onChangeEmail,
  changeEmailLabel = 'Use a different email',
}: {
  email: string
  purpose: 'signup' | 'recovery'
  redirectTo?: string
  onVerified: (session: Session) => Promise<void> | void
  onChangeEmail: () => void
  changeEmailLabel?: string
}) {
  const [code, setCode] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  // An email has just been sent, so the timer starts straight away.
  const [wait, setWait] = React.useState(RESEND_SECONDS)

  React.useEffect(() => {
    if (wait <= 0) return
    const timer = window.setTimeout(() => setWait((s) => s - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [wait])

  async function verify(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setNotice(null)
    if (!isCompleteCode(code)) return setError('Enter the 6-digit code from the email.')
    if (purpose === 'recovery' && password.length < 8) return setError('Choose a new password of at least 8 characters.')
    setError(null)
    setBusy(true)
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({ email, token: code, type: purpose })
      if (verifyError) throw verifyError
      if (!data.session) throw new Error('invalid')
      if (purpose === 'recovery') {
        const { error: saveError } = await supabase.auth.updateUser({ password })
        if (saveError) {
          // The code worked and they are signed in; only the password failed.
          setError(`You're signed in, but your password wasn't changed. ${codeErrorMessage(saveError.message)}`)
          setBusy(false)
          return
        }
      }
      await onVerified(data.session)
    } catch (e) {
      setError(codeErrorMessage(e instanceof Error ? e.message : ''))
      setBusy(false)
    }
  }

  async function resend() {
    if (wait > 0 || sending) return
    setSending(true)
    setError(null)
    setNotice(null)
    const { error: sendError } =
      purpose === 'signup'
        ? await supabase.auth.resend({ type: 'signup', email, options: redirectTo ? { emailRedirectTo: redirectTo } : undefined })
        : await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined)
    setSending(false)
    if (sendError) return setError(codeErrorMessage(sendError.message))
    setCode('')
    setWait(RESEND_SECONDS)
    setNotice(`New code sent to ${email}. Only the newest code works.`)
  }

  return (
    <>
      <p className="text-foreground">
        We've sent a 6-digit code to <strong className="font-semibold">{email}</strong>.{' '}
        {purpose === 'signup' ? 'Type it here to finish setting up your account.' : 'If that address has an account, type the code here with a new password.'}
      </p>
      <form onSubmit={verify} className="flex flex-col gap-4">
        <AuthInput
          label="Code from the email"
          value={code}
          onChange={(e) => setCode(cleanCode(e.target.value))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={10}
          placeholder="000000"
          autoFocus
          required
          className="h-14 text-center font-display text-2xl font-bold tracking-[0.4em] placeholder:text-muted-foreground/40"
        />
        {purpose === 'recovery' && (
          <AuthInput
            type="password"
            label="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        )}
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        {notice && <p role="status" className="rounded-xl bg-sage px-4 py-3 text-sm text-sage-ink">{notice}</p>}
        <button
          data-press-feedback
          type="submit"
          disabled={busy}
          className="h-12 rounded-full bg-primary text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {busy ? 'Checking…' : purpose === 'signup' ? 'Confirm and continue' : 'Save new password'}
        </button>
      </form>
      <div className="flex flex-col items-start gap-1 text-sm">
        <button
          type="button"
          onClick={() => void resend()}
          disabled={wait > 0 || sending}
          className="min-h-11 font-semibold text-foreground underline decoration-primary/60 decoration-[1.5px] underline-offset-4 hover:decoration-primary disabled:text-muted-foreground disabled:no-underline"
        >
          {sending ? 'Sending…' : wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
        </button>
        <button type="button" onClick={onChangeEmail} className="min-h-11 text-muted-foreground hover:text-foreground hover:underline">
          {changeEmailLabel}
        </button>
        <p className="text-muted-foreground">Can't see it? Check your spam folder. The email also has a link you can click instead.</p>
      </div>
    </>
  )
}
