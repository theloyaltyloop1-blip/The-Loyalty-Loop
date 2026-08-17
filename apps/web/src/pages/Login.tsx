import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, setRememberMe } from '@/lib/supabase'
import { AuthLayout, AuthInput, AuthLinks, AuthLinkLine, AuthMinorLink } from '@/components/auth-layout'

export function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [remember, setRemember] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    setLoading(true)
    setRememberMe(remember)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }
    await supabase.rpc('ensure_current_user_bootstrap')
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', data.user.id)
    navigate(
      roles?.some((role) => role.role === 'admin')
        ? '/access'
        : roles?.some((role) => role.role === 'staff')
          ? '/owner/scan'
          : roles?.some((role) => role.role === 'brand_head')
            ? '/brand'
          : roles?.some((role) => role.role === 'business_owner')
            ? '/owner'
            : '/dashboard'
    )
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
        <label className="flex items-center gap-2 -mt-1 text-sm font-semibold text-foreground/70 select-none">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded accent-foreground"
          />
          Remember me for 6 months
        </label>
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        <button data-press-feedback
          type="submit"
          disabled={loading}
          className="h-14 rounded-lg bg-foreground text-white font-bold text-lg disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Log in'}
        </button>
      </form>

      <AuthLinks>
        <AuthLinkLine prompt="New here? –" linkText="Sign up as a customer" to="/signup" />
        <AuthLinkLine prompt="Run a shop? –" linkText="Sign up as a Loyalty Loop Retailer" to="/signup/owner" />
        <AuthMinorLink linkText="Forgot your password?" to="/forgot-password" />
      </AuthLinks>
    </AuthLayout>
  )
}
