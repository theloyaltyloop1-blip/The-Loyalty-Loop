import * as React from 'react'
import { MapPin, Search, Store } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '@/components/dashboard-layout'
import { BusinessesMap } from '@/components/shop-map'
import { SkeletonBlock } from '@/components/page-skeleton'
import { fetchBusinesses, type Business } from '@/lib/businesses'
import { usePageMeta } from '@/lib/use-page-meta'
import {AskShopDialog} from '@/components/shop-requests'

export function DiscoverPage() {
  const navigate = useNavigate()
  const [businesses, setBusinesses] = React.useState<Business[]>([])
  const [selected, setSelected] = React.useState<Business | null>(null)
  const [query, setQuery] = React.useState('')
  const [askOpen,setAskOpen]=React.useState(false)
  const [loading, setLoading] = React.useState(true)

  usePageMeta({ title: 'Shop map | The Loyalty Loop', description: 'Find local Loyalty Loop shops on the map.', path: '/dashboard/discover', robots: 'noindex,nofollow,noarchive' })

  React.useEffect(() => { fetchBusinesses().then(setBusinesses).finally(() => setLoading(false)) }, [])

  const filtered = businesses.filter((business) => `${business.name} ${business.category ?? ''} ${business.address ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  const located = filtered.filter((business) => business.lat != null && business.lng != null)

  return <DashboardLayout>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Find a local shop</h1>
      <label className="relative block w-full sm:w-80"><span className="sr-only">Search shops or areas</span><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shops or areas" className="h-12 w-full rounded-full border border-input bg-card pl-11 pr-4 outline-none transition-shadow focus:border-primary focus:ring-3 focus:ring-primary/20" /></label>
    </div>
    {loading ? <SkeletonBlock className="h-[560px] w-full rounded-3xl" /> : <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <BusinessesMap businesses={located} onSelect={setSelected} />
      <aside className="max-h-[560px] overflow-y-auto rounded-3xl bg-card p-2 ring-1 ring-foreground/8"><p className="px-3 pb-2 pt-3 text-sm font-semibold text-muted-foreground">{located.length} on the map</p>
        {located.map((business) => { const active = selected?.id === business.id; return <button key={business.id} onClick={() => setSelected(business)} className={`w-full rounded-xl p-3 text-left transition-colors ${active ? 'bg-peach text-peach-ink' : 'hover:bg-secondary'}`}><div className="flex items-start gap-3">{business.logo_url ? <img src={business.logo_url} alt="" className="h-10 w-10 rounded-xl object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ backgroundColor: business.brand_color }}><Store className="h-4 w-4" /></span>}<span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{business.name}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{business.category ?? 'Local shop'}</span><span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{business.address ?? 'Location confirmed'}</span></span></div></button> })}
        {!located.length && <p className="px-3 py-8 text-center text-sm text-muted-foreground">No mapped shops match this search yet.</p>}
      </aside>
    </div>}
    {selected && <section className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-olive p-6 text-olive-ink"><div><p className="font-display text-xl font-semibold tracking-tight">{selected.name}</p><p className="mt-1 text-sm text-olive-ink/80">{selected.description || selected.address || 'A local Loyalty Loop shop.'}</p></div><button data-press-feedback onClick={() => navigate(`/dashboard/shop/${selected.slug}`)} className="h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover">View shop</button></section>}
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-peach px-5 py-5 text-peach-ink sm:px-7"><p className="font-semibold">Can’t find your favourite shop?</p><button data-press-feedback onClick={()=>setAskOpen(true)} className="rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-colors hover:bg-primary-hover">Ask a shop to join</button></div>
    <AskShopDialog open={askOpen} onOpenChange={setAskOpen} initialQuery={query}/>
  </DashboardLayout>
}
