import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { AuthLayout, AuthInput, AuthLinks, AuthLinkLine } from '@/components/auth-layout'
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
    navigate('/dashboard')
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <AuthLayout title="Welcome back">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          autoComplete="current-password"
        />
        <HCaptchaWidget onVerify={setCaptchaToken} />
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="h-14 rounded-lg bg-[#1a1a1a] text-white font-bold text-lg disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Log in'}
        </button>
      </form>

      <button
        type="button"
        onClick={handleGoogle}
        className="h-14 rounded-lg border-[1.5px] border-[#1a1a1a] bg-white font-bold"
      >
        Continue with Google
      </button>

      <AuthLinks>
        <AuthLinkLine prompt="Forgot your password? –" linkText="Reset it" to="/forgot-password" />
        <AuthLinkLine prompt="New here? –" linkText="Sign up as a customer" to="/signup" />
        <AuthLinkLine prompt="Run a shop? –" linkText="Sign up as a Loyalty Loop Retailer" to="/signup/owner" />
      </AuthLinks>
    </AuthLayout>
  )
}
