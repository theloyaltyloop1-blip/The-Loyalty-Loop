import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { DashboardLayout } from '@/components/dashboard-layout'
import { ShopCard } from '@/components/shop-card'
import { fetchBusinesses, fetchMyMemberships, type Business, type Membership } from '@/lib/businesses'

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

// Centered on the Tooting/Balham area used throughout the marketing copy —
// will become a live pin-per-shop map once businesses have real lat/lng
// (§3 shop setup with a map pin).
const EMBED_SRC = MAPS_API_KEY
  ? `https://www.google.com/maps/embed/v1/search?key=${MAPS_API_KEY}&q=cafes+near+Tooting+Bec,London`
  : null

type View = 'map' | 'list'

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div className="inline-flex rounded-xl border-2 border-[#1a1a1a] overflow-hidden">
      {(['map', 'list'] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={
            'px-6 h-11 font-bold capitalize transition-colors ' +
            (view === v ? 'bg-[#1a1a1a] text-white' : 'bg-white text-[#1a1a1a] hover:bg-[#1a1a1a]/5')
          }
        >
          {v}
        </button>
      ))}
    </div>
  )
}

export function MapPage() {
  const { session, loading } = useAuth()
  const [view, setView] = React.useState<View>('map')
  const [businesses, setBusinesses] = React.useState<Business[]>([])
  const [memberships, setMemberships] = React.useState<Membership[]>([])

  React.useEffect(() => {
    if (!session?.user) return
    Promise.all([fetchBusinesses(), fetchMyMemberships(session.user.id)]).then(([b, m]) => {
      setBusinesses(b)
      setMemberships(m)
    })
  }, [session?.user])

  if (loading) return null
  if (!session) return <Navigate to="/login" replace />

  const membershipByBusiness = new Map(memberships.map((m) => [m.business_id, m]))

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-[#1a1a1a]">Browse shops</h1>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {view === 'map' ? (
        <div className="rounded-xl border-2 border-[#1a1a1a] overflow-hidden h-[600px]">
          {EMBED_SRC ? (
            <iframe
              title="Shops map"
              src={EMBED_SRC}
              className="w-full h-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-[#FBF6EC] text-[#1a1a1a]/50 font-semibold text-center px-8">
              Set VITE_GOOGLE_MAPS_API_KEY to show the map.
            </div>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {businesses.map((business) => (
            <ShopCard key={business.id} business={business} membership={membershipByBusiness.get(business.id)} />
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}
