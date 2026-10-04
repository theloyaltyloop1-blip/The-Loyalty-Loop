import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { DashboardLayout } from '@/components/dashboard-layout'
import { PageSkeleton } from '@/components/page-skeleton'

export function ComingSoon({ title }: { title: string }) {
  const { session, loading } = useAuth()

  if (loading) return <PageSkeleton />
  if (!session) return <Navigate to="/login" replace />

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-display font-bold tracking-tight text-foreground mb-6">{title}</h1>
      <div className="rounded-3xl bg-sage px-6 py-12 text-center text-sage-ink">Coming soon.</div>
    </DashboardLayout>
  )
}
