import * as React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { HCaptchaWidget, hcaptchaEnabled } from '@/components/hcaptcha-widget'

export function Signup({ asOwner = false }: { asOwner?: boolean }) {
  const [searchParams] = useSearchParams()
  const [firstName, setFirstName] = React.useState('')
  const [lastName, setLastName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null)
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
    if (hcaptchaEnabled && !captchaToken) {
      setError('Please complete the captcha.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        captchaToken: captchaToken ?? undefined,
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
    setCheckEmailSent(true)
  }

  if (checkEmailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <h1 className="text-2xl mb-2">Check your email</h1>
          <p>We've sent a confirmation link to {email}. Follow it to finish setting up your account.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <h1 className="text-3xl mb-6 text-center">
          {asOwner ? 'Set up your shop' : 'Create your account'}
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-3">
            <Input
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <Input
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            type="password"
            placeholder="Password (min. 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <HCaptchaWidget onVerify={setCaptchaToken} />
          {error && <p className="text-destructive text-sm font-medium">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating account…' : asOwner ? 'Create shop account' : 'Sign up'}
          </Button>
        </form>
        <div className="flex justify-between mt-6 text-sm font-medium">
          <Link to="/login" className="underline">
            Already have an account?
          </Link>
          <Link to={asOwner ? '/signup' : '/signup/owner'} className="underline">
            {asOwner ? "I'm a customer" : "I'm a shop owner"}
          </Link>
        </div>
      </Card>
    </div>
  )
}
