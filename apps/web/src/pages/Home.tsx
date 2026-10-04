import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { ArrowRight, Search } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { DashboardLayout } from '@/components/dashboard-layout'
import { PageSkeleton } from '@/components/page-skeleton'
import { HomeCollection } from '@/components/home-collection'
import { AskShopDialog } from '@/components/shop-requests'
import { fetchBusinesses, fetchMyMemberships, type Business, type Membership, type RewardCatalogItem } from '@/lib/businesses'
import { trendingShops } from '@/lib/trending'
import { useUserLocation } from '@/lib/use-user-location'

export function Home() {
  const { session, loading, rolesLoading, primaryRole } = useAuth()
  const [firstName, setFirstName] = React.useState<string | null>(null)
  const [category, setCategory] = React.useState('All')
  const [query, setQuery] = React.useState('')
  const [askOpen, setAskOpen] = React.useState(false)
  const [businesses, setBusinesses] = React.useState<Business[]>([])
  const [memberships, setMemberships] = React.useState<Membership[]>([])
  const [catalog, setCatalog] = React.useState<RewardCatalogItem[]>([])
  const [fetching, setFetching] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const { coords: userLocation, status: locationStatus, locate } = useUserLocation()

  React.useEffect(() => {
    if (!session?.user) return
    let active = true
    supabase
      .from('profiles')
      .select('first_name')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => { if (active) setFirstName(data?.first_name ?? null) })

    const catalogRequest = supabase
      .from('reward_catalog')
      .select('id,business_id,title,description,stamp_threshold,spend_threshold_pence,sort_order')
      .order('sort_order')
      .then(({ data, error }) => error ? [] : (data ?? []) as RewardCatalogItem[])

    Promise.all([fetchBusinesses(), fetchMyMemberships(session.user.id), catalogRequest])
      .then(([shopRows, memberRows, rewardRows]) => {
        if (!active) return
        setBusinesses(shopRows)
        setMemberships(memberRows)
        setCatalog(rewardRows)
        setLoadError(null)
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Could not load your shops. Please refresh and try again.')
      })
      .finally(() => { if (active) setFetching(false) })

    return () => { active = false }
  }, [session?.user])

  if (loading || rolesLoading) return <PageSkeleton />
  if (!session) return <Navigate to="/login" replace />
  if (primaryRole === 'admin') return <Navigate to="/access" replace />
  if (primaryRole === 'brand_head') return <Navigate to="/brand" replace />
  if (primaryRole === 'business_owner') return <Navigate to="/owner" replace />
  if (primaryRole === 'staff') return <Navigate to="/owner/scan" replace />

  const counts = businesses.reduce<Record<string, number>>((acc, business) => {
    const name = business.category ?? 'Other'
    acc[name] = (acc[name] ?? 0) + 1
    return acc
  }, {})
  const search = query.trim().toLowerCase()
  const filtered = businesses.filter((business) =>
    (category === 'All' || (business.category ?? 'Other') === category) &&
    `${business.name} ${business.category ?? ''} ${business.address ?? ''} ${business.postcode ?? ''}`.toLowerCase().includes(search)
  )
  const trending = trendingShops(businesses, filtered, { fallback: 2 })
  const joinedIds = new Set(memberships.map((membership) => membership.business_id))
  const featured = trending.find((business) => !joinedIds.has(business.id) && business.cover_url)
    ?? trending.find((business) => !joinedIds.has(business.id))
    ?? (trending.length > 1 ? trending.find((business) => Boolean(business.cover_url)) ?? trending[0] : undefined)

  return (
    <DashboardLayout>
      <header className="mb-6 sm:mb-8">
        <p className="mb-2 text-sm font-medium text-muted-foreground">Hello, {firstName ?? session.user.email?.split('@')[0]}</p>
        <h1 className="max-w-2xl font-display text-4xl font-bold leading-[1.04] tracking-tight text-foreground sm:text-5xl">Make a local stop.</h1>
        <div className="relative mt-5 max-w-2xl">
          <label htmlFor="shop-home-search" className="sr-only">Search shops, categories or areas</label>
          <input
            id="shop-home-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a shop"
            className="h-14 w-full rounded-full border border-foreground/10 bg-card pl-12 pr-5 text-base font-medium text-foreground placeholder:text-muted-foreground outline-none transition-shadow focus-visible:ring-4 focus-visible:ring-accent/50"
          />
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        </div>
      </header>

      <div role="group" aria-label="Filter shops by category" className="mb-7 flex gap-2 overflow-x-auto pb-1">
        <button type="button" aria-pressed={category === 'All'} onClick={() => setCategory('All')} className={'min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-primary ' + (category === 'All' ? 'bg-[#3E5235] text-[#F1F4EC]' : 'bg-card text-foreground ring-1 ring-foreground/10 hover:bg-[#DCE6D2]')}>
          All shops
        </button>
        {Object.entries(counts).map(([name, count]) => <button type="button" key={name} aria-pressed={category === name} onClick={() => setCategory(name)} className={'min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-primary ' + (category === name ? 'bg-[#3E5235] text-[#F1F4EC]' : 'bg-card text-foreground ring-1 ring-foreground/10 hover:bg-[#DCE6D2]')}>
          {name} <span aria-hidden="true">·</span> {count}
        </button>)}
      </div>

      {fetching && !businesses.length ? <p role="status" className="rounded-2xl bg-[#DCE6D2] px-5 py-6 text-[#24331F]">Finding your local favourites…</p>
        : loadError ? <div role="alert" className="rounded-2xl bg-[#F8DCCB] px-5 py-6 text-[#6E2C0F]"><p>{loadError}</p><button type="button" onClick={() => window.location.reload()} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 font-semibold text-white">Refresh <ArrowRight className="h-4 w-4" aria-hidden="true" /></button></div>
          : <HomeCollection businesses={filtered} featured={featured} memberships={memberships} catalog={catalog} filtered={category !== 'All' || Boolean(search)} location={userLocation} locationStatus={locationStatus} onUseLocation={locate} />}

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#F8DCCB] px-5 py-5 text-[#6E2C0F] sm:px-7">
        <p className="font-semibold">Can’t find your favourite shop?</p>
        <button type="button" onClick={() => setAskOpen(true)} className="min-h-11 rounded-full bg-primary px-5 py-2.5 font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-3 focus-visible:outline-foreground">Ask a shop to join</button>
      </div>
      <AskShopDialog open={askOpen} onOpenChange={setAskOpen} initialQuery={query} />
    </DashboardLayout>
  )
}
