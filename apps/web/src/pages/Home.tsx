import * as React from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Search, Sparkles, Coffee, Scissors, UtensilsCrossed, Store } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { DashboardLayout } from '@/components/dashboard-layout'
import { PageSkeleton } from '@/components/page-skeleton'
import { ShopCard } from '@/components/shop-card'
import { fetchBusinesses, fetchMyMemberships, type Business, type Membership } from '@/lib/businesses'
import {AskShopDialog} from '@/components/shop-requests'
import { trendingShops } from '@/lib/trending'

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Café: Coffee,
  Restaurant: UtensilsCrossed,
  Barber: Scissors,
}

function TrendingCard({ business }: { business: Business }) {
  const navigate = useNavigate()
  const Icon = CATEGORY_ICON[business.category ?? ''] ?? Store

  return (
    <button data-press-feedback
      onClick={() => navigate(`/dashboard/shop/${business.slug}`)}
      className="group text-left w-64 shrink-0 rounded-2xl bg-card overflow-hidden ring-1 ring-foreground/8 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgb(28_38_32/0.12)]"
    >
      <div className="relative h-28" style={{ background: business.brand_color }}>
        <span className="absolute bottom-3 left-4 grid h-10 w-10 place-items-center rounded-full bg-card font-display text-lg font-bold" style={{ color: business.brand_color }} aria-hidden="true">
          {business.name.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="p-4">
        <h3 className="font-display font-semibold text-lg tracking-tight text-foreground">{business.name}</h3>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
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
  const [query, setQuery] = React.useState('')
  const [askOpen,setAskOpen]=React.useState(false)
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

  if (loading || rolesLoading) return <PageSkeleton />
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
  const search = query.trim().toLowerCase()
  const filtered = businesses.filter((business) =>
    (category === 'All' || business.category === category) &&
    `${business.name} ${business.category ?? ''} ${business.address ?? ''} ${business.postcode ?? ''}`.toLowerCase().includes(search)
  )
  const trending = trendingShops(businesses, filtered, { fallback: 2 })

  return (
    <DashboardLayout>
      <section className="mb-8 rounded-3xl bg-olive px-5 py-8 text-olive-ink sm:px-10 sm:py-10">
        <p className="text-olive-ink/75">
          Hello, {firstName ?? session.user.email?.split('@')[0]}
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">Discover local rewards</h1>
        <div className="relative mt-6 max-w-2xl">
          <input
            type="search"
            aria-label="Search shops, categories or areas"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search shops, cafés, salons…"
            className="h-14 w-full rounded-full bg-card pl-14 pr-5 font-medium text-foreground placeholder:text-muted-foreground outline-none ring-0 transition-shadow focus:ring-4 focus:ring-amber/60"
          />
          <Search className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        </div>
      </section>

      <div className="flex flex-wrap gap-2 mb-8">
        <button data-press-feedback
          onClick={() => setCategory('All')}
          className={
            'rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-150 ease-out ' +
            (category === 'All' ? 'bg-peach text-peach-ink' : 'bg-card text-muted-foreground ring-1 ring-foreground/10 hover:text-foreground')
          }
        >
          All categories
        </button>
        {Object.entries(counts).map(([cat, count]) => (
          <button data-press-feedback
            key={cat}
            onClick={() => setCategory(cat)}
            className={
              'rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-150 ease-out ' +
              (category === cat ? 'bg-peach text-peach-ink' : 'bg-card text-muted-foreground ring-1 ring-foreground/10 hover:text-foreground')
            }
          >
            {cat} · {count}
          </button>
        ))}
      </div>

      {!fetching && businesses.length === 0 ? (
        <p className="rounded-2xl bg-sage px-5 py-6 text-sage-ink">No shops yet. Check back soon.</p>
      ) : !fetching && filtered.length === 0 ? (
        <div className="rounded-2xl bg-sage px-5 py-6 text-sage-ink"><p role="status">No shops match. Try another search or category.</p></div>
      ) : (
        <>
          {trending.length > 0 && (
            <>
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight mb-4">
                <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" /> Trending nearby
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-2 mb-10">
                {trending.map((business, index) => (
                  <div key={business.id} className="stagger-card" style={{ animationDelay: `${index * 45}ms` }}><TrendingCard business={business} /></div>
                ))}
              </div>
            </>
          )}

          <h2 className="font-display text-xl font-semibold tracking-tight mb-4">Nearby</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {filtered.map((business, index) => (
              <div key={business.id} className="stagger-card w-full" style={{ animationDelay: `${Math.min(index, 5) * 45}ms` }}><ShopCard business={business} membership={membershipByBusiness.get(business.id)} /></div>
            ))}
          </div>
        </>
      )}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-peach px-5 py-5 text-peach-ink sm:px-7"><p className="font-semibold">Can’t find your favourite shop?</p><button data-press-feedback onClick={()=>setAskOpen(true)} className="rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-colors hover:bg-primary-hover">Ask a shop to join</button></div>
      <AskShopDialog open={askOpen} onOpenChange={setAskOpen} initialQuery={query}/>
    </DashboardLayout>
  )
}
