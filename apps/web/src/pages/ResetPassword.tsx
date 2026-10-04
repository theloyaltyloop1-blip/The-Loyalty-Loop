import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { AuthLayout, AuthInput } from '@/components/auth-layout'

export function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [done, setDone] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }
    setDone(true)
    setTimeout(() => navigate('/login'), 2000)
  }

  return (
    <AuthLayout title="Choose a new password">
      {done ? (
        <p className="rounded-xl bg-sage px-4 py-3 text-sage-ink">Password updated. Redirecting to sign in…</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <AuthInput
            type="password"
            label="New password"
            aria-describedby="password-help"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <p id="password-help" className="-mt-2 text-sm text-muted-foreground">At least 8 characters.</p>
          {error && <p className="text-destructive text-sm font-medium">{error}</p>}
          <Button type="submit" size="lg" disabled={loading}>
            {loading ? 'Saving…' : 'Save new password'}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
