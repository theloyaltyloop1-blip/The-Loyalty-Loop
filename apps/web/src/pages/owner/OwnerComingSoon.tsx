import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { OwnerLayout } from '@/components/owner-layout'
import { BarePageSkeleton } from '@/components/page-skeleton'

export function OwnerComingSoon({ title }: { title: string }) {
  const { session, loading } = useAuth()

  if (loading) return <BarePageSkeleton />
  if (!session) return <Navigate to="/login" replace />

  return (
    <OwnerLayout>
      <h1 className="text-3xl font-display font-bold tracking-tight text-foreground sm:text-4xl mb-6">{title}</h1>
      <div className="rounded-3xl bg-sage px-6 py-12 text-center text-sage-ink">
        <p>Coming soon.</p>
      </div>
    </OwnerLayout>
  )
}
