import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { DashboardLayout } from '@/components/dashboard-layout'
import { PageSkeleton, SkeletonBlock } from '@/components/page-skeleton'
import { ShopCard } from '@/components/shop-card'
import { fetchFavouriteBusinesses, fetchMyMemberships, type Business, type Membership } from '@/lib/businesses'

export function FavouritesPage() {
  const { session, loading } = useAuth()
  const [businesses, setBusinesses] = React.useState<Business[]>([])
  const [memberships, setMemberships] = React.useState<Membership[]>([])
  const [fetching, setFetching] = React.useState(true)

  React.useEffect(() => {
    if (!session?.user) return
    Promise.all([fetchFavouriteBusinesses(session.user.id), fetchMyMemberships(session.user.id)])
      .then(([b, m]) => {
        setBusinesses(b)
        setMemberships(m)
      })
      .finally(() => setFetching(false))
  }, [session?.user])

  if (loading) return <PageSkeleton />
  if (!session) return <Navigate to="/login" replace />

  const membershipByBusiness = new Map(memberships.map((m) => [m.business_id, m]))

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-display font-extrabold text-foreground mb-6">Shops you’ve saved</h1>

      {fetching ? (
        <div role="status" aria-live="polite" className="grid gap-5 sm:grid-cols-2"><span className="sr-only">Loading favourite shops</span><SkeletonBlock className="h-64" /><SkeletonBlock className="h-64" /></div>
      ) : businesses.length === 0 ? (
        <div className="rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-10 text-center">
          <Heart className="h-8 w-8 text-foreground/20 mx-auto mb-3" />
          <p className="text-foreground/50">
            No favourites yet — tap the heart on a shop's page to save it here.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-5">
          {businesses.map((business, index) => (
            <div key={business.id} className="stagger-card" style={{ animationDelay: `${Math.min(index, 5) * 45}ms` }}><ShopCard business={business} membership={membershipByBusiness.get(business.id)} /></div>
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}
