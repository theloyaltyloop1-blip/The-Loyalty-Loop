import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { HCaptchaWidget, hcaptchaEnabled } from '@/components/hcaptcha-widget'

export function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null)
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
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }
    navigate('/')
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <h1 className="text-3xl mb-6 text-center">Welcome back</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <HCaptchaWidget onVerify={setCaptchaToken} />
          {error && <p className="text-destructive text-sm font-medium">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <Button variant="outline" className="w-full mt-3" onClick={handleGoogle} type="button">
          Continue with Google
        </Button>
        <div className="flex justify-between mt-6 text-sm font-medium">
          <Link to="/forgot-password" className="underline">
            Forgot password?
          </Link>
          <Link to="/signup" className="underline">
            Create an account
          </Link>
        </div>
      </Card>
    </div>
  )
}
