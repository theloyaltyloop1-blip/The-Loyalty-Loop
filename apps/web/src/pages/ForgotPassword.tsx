import * as React from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { HCaptchaWidget, hcaptchaEnabled } from '@/components/hcaptcha-widget'

export function ForgotPassword() {
  const [email, setEmail] = React.useState('')
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null)
  const [sent, setSent] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (hcaptchaEnabled && !captchaToken) {
      setError('Please complete the captcha.')
      return
    }

    setLoading(true)
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
      captchaToken: captchaToken ?? undefined,
    })
    setLoading(false)
    // Always show the same message, whether or not the address exists —
    // prevents account enumeration.
    setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <h1 className="text-3xl mb-6 text-center">Reset your password</h1>
        {sent ? (
          <p className="text-center">
            If an account exists for {email}, we've sent a password reset link to it.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <HCaptchaWidget onVerify={setCaptchaToken} />
            {error && <p className="text-destructive text-sm font-medium">{error}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        )}
        <div className="text-center mt-6 text-sm font-medium">
          <Link to="/login" className="underline">
            Back to sign in
          </Link>
        </div>
      </Card>
    </div>
  )
}
