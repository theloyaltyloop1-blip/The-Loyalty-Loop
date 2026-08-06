import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { OwnerLayout } from '@/components/owner-layout'
import { useOwner } from '@/lib/owner-context'

export function OwnerAnalytics() {
  const { session, loading } = useAuth()
  const { business } = useOwner()

  if (loading) return null
  if (!session) return <Navigate to="/login" replace />

  return (
    <OwnerLayout>
      <p className="text-xs font-extrabold uppercase tracking-wide text-[#1a1a1a]/40 mb-1">Analytics</p>
      <h1 className="text-3xl font-display font-extrabold text-[#1a1a1a] mb-6">Know your customers</h1>
      <div className="rounded-2xl bg-[#FBF6EC] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-10 text-center">
        <p className="text-[#1a1a1a]/50">
          {business ? `Stats and the AI coach for ${business.name} land here soon.` : 'Set up a shop to see analytics.'}
        </p>
      </div>
    </OwnerLayout>
  )
}
