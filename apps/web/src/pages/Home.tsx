import * as React from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Search, Sparkles, Coffee, Scissors, UtensilsCrossed, Store } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { DashboardLayout } from '@/components/dashboard-layout'
import { ShopCard } from '@/components/shop-card'
import { fetchBusinesses, fetchMyMemberships, type Business, type Membership } from '@/lib/businesses'

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Café: Coffee,
  Restaurant: UtensilsCrossed,
  Barber: Scissors,
}

function TrendingCard({ business }: { business: Business }) {
  const navigate = useNavigate()
  const Icon = CATEGORY_ICON[business.category ?? ''] ?? Store

  return (
    <button
      onClick={() => navigate(`/dashboard/shop/${business.slug}`)}
      className="text-left w-64 shrink-0 rounded-2xl bg-[#FBF6EC] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-shadow"
    >
      <div
        className="h-28"
        style={{ background: `linear-gradient(135deg, ${business.brand_color}, ${business.brand_color}99)` }}
      />
      <div className="p-4">
        <h3 className="font-display font-bold text-lg text-[#1a1a1a]">{business.name}</h3>
        <p className="flex items-center gap-1.5 text-sm text-[#1a1a1a]/60 mt-1">
          <Icon className="h-4 w-4" /> {business.category}
        </p>
      </div>
    </button>
  )
}

export function Home() {
  const { session, loading, rolesLoading, primaryRole } = useAuth()
  const [firstName, setFirstName] = React.useState<string | null>(null)
  const [category, setCategory] = React.useState<string>('All')
  const [businesses, setBusinesses] = React.useState<Business[]>([])
  const [memberships, setMemberships] = React.useState<Membership[]>([])
  const [fetching, setFetching] = React.useState(true)

  React.useEffect(() => {
    if (!session?.user) return
    supabase
      .from('profiles')
      .select('first_name')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setFirstName(data?.first_name ?? null))

    Promise.all([fetchBusinesses(), fetchMyMemberships(session.user.id)])
      .then(([b, m]) => {
        setBusinesses(b)
        setMemberships(m)
      })
      .finally(() => setFetching(false))
  }, [session?.user])

  if (loading || rolesLoading) return null
  if (!session) return <Navigate to="/login" replace />
  if (primaryRole === 'admin') return <Navigate to="/access" replace />
  if (primaryRole === 'brand_head') return <Navigate to="/brand" replace />
  if (primaryRole === 'business_owner') return <Navigate to="/owner" replace />
  if (primaryRole === 'staff') return <Navigate to="/owner/scan" replace />

  const membershipByBusiness = new Map(memberships.map((m) => [m.business_id, m]))
  const counts = businesses.reduce<Record<string, number>>((acc, b) => {
    const cat = b.category ?? 'Other'
    acc[cat] = (acc[cat] ?? 0) + 1
    return acc
  }, {})
  const filtered = category === 'All' ? businesses : businesses.filter((b) => b.category === category)

  return (
    <DashboardLayout>
      <div className="relative mb-8">
        <input
          placeholder="Search shops, cafés, salons…"
          className="h-14 w-full rounded-full border border-black/10 bg-[#FBF6EC] pl-14 pr-5 font-medium text-[#1a1a1a] placeholder:text-[#1a1a1a]/40 outline-none"
        />
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-[#1a1a1a]/60" />
      </div>

      <p className="text-sm text-[#1a1a1a]/50 mb-1">
        Hello, {firstName ?? session.user.email?.split('@')[0]}
      </p>
      <h1 className="text-3xl font-display font-extrabold text-[#1a1a1a] mb-5">Discover local rewards</h1>

      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setCategory('All')}
          className={
            'rounded-full px-4 py-2 text-sm font-semibold transition-colors ' +
            (category === 'All' ? 'bg-[#E8703B] text-white' : 'bg-[#FBF6EC] text-[#1a1a1a]/70 border border-black/10')
          }
        >
          All categories
        </button>
        {Object.entries(counts).map(([cat, count]) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={
              'rounded-full px-4 py-2 text-sm font-semibold transition-colors ' +
              (category === cat ? 'bg-[#E8703B] text-white' : 'bg-[#FBF6EC] text-[#1a1a1a]/70 border border-black/10')
            }
          >
            {cat} · {count}
          </button>
        ))}
      </div>

      {!fetching && businesses.length === 0 ? (
        <p className="text-[#1a1a1a]/50">No shops yet — check back soon.</p>
      ) : (
        <>
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-[#1a1a1a]/60 mb-4">
            <Sparkles className="h-4 w-4 text-[#E8703B]" /> Trending nearby
          </p>
          <div className="flex gap-4 overflow-x-auto pb-2 mb-10">
            {businesses.slice(0, 2).map((business) => (
              <TrendingCard key={business.id} business={business} />
            ))}
          </div>

          <p className="text-xs font-extrabold uppercase tracking-wide text-[#1a1a1a]/60 mb-4">Nearby</p>
          <div className="grid sm:grid-cols-2 gap-5">
            {filtered.map((business) => (
              <ShopCard key={business.id} business={business} membership={membershipByBusiness.get(business.id)} />
            ))}
          </div>
        </>
      )}
    </DashboardLayout>
  )
}
