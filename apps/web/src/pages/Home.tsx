import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function Home() {
  const { session, primaryRole, roles, loading, signOut } = useAuth()

  if (loading) return null
  if (!session) return <Navigate to="/login" replace />

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <h1 className="text-3xl mb-2">You're in 🎉</h1>
        <p className="mb-1">
          <span className="font-semibold">{session.user.email}</span>
        </p>
        <p className="mb-1">
          Primary role: <span className="font-semibold">{primaryRole ?? '…resolving'}</span>
        </p>
        <p className="mb-6 text-sm text-foreground/60">All roles: {roles.join(', ') || '—'}</p>
        <Button variant="outline" onClick={signOut}>
          Sign out
        </Button>
      </Card>
    </div>
  )
}
