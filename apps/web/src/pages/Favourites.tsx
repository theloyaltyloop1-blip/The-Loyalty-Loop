import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { DashboardLayout } from '@/components/dashboard-layout'
import { ShopCard } from '@/components/shop-card'
import { fetchFavouriteBusinesses, fetchMyMemberships, type Business, type Membership } from '@/lib/businesses'
import { StatusCard, StatusText } from '@/components/ui/states'

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

  if (loading) return null
  if (!session) return <Navigate to="/login" replace />

  const membershipByBusiness = new Map(memberships.map((m) => [m.business_id, m]))

  return (
    <DashboardLayout>
      <p className="text-xs font-extrabold uppercase tracking-wide text-[#1a1a1a]/40 mb-1">Favourites</p>
      <h1 className="text-3xl font-display font-extrabold text-[#1a1a1a] mb-6">Shops you've saved</h1>

      {fetching ? (
        <StatusText className="text-base" />
      ) : businesses.length === 0 ? (
        <StatusCard>
          <Heart className="h-8 w-8 text-[#1a1a1a]/20 mx-auto mb-3" />
          <p className="text-[#1a1a1a]/50">
            No favourites yet — tap the heart on a shop's page to save it here.
          </p>
        </StatusCard>
      ) : (
        <div className="grid sm:grid-cols-2 gap-5">
          {businesses.map((business) => (
            <ShopCard key={business.id} business={business} membership={membershipByBusiness.get(business.id)} />
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}
