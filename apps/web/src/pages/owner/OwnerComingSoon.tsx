import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { OwnerLayout } from '@/components/owner-layout'

export function OwnerComingSoon({ title }: { title: string }) {
  const { session, loading } = useAuth()

  if (loading) return null
  if (!session) return <Navigate to="/login" replace />

  return (
    <OwnerLayout>
      <h1 className="text-3xl font-display font-extrabold text-foreground mb-6">{title}</h1>
      <div className="rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-10 text-center">
        <p className="text-foreground/50">Coming soon.</p>
      </div>
    </OwnerLayout>
  )
}
