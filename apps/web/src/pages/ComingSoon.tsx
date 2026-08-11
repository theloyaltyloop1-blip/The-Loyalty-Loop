import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { DashboardLayout } from '@/components/dashboard-layout'

export function ComingSoon({ title }: { title: string }) {
  const { session, loading } = useAuth()

  if (loading) return null
  if (!session) return <Navigate to="/login" replace />

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-foreground mb-4">{title}</h1>
      <p className="text-foreground/60 font-semibold">Coming soon.</p>
    </DashboardLayout>
  )
}
