import * as React from 'react'
import { MapPin, Search, Store } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '@/components/dashboard-layout'
import { BusinessesMap } from '@/components/shop-map'
import { SkeletonBlock } from '@/components/page-skeleton'
import { fetchBusinesses, type Business } from '@/lib/businesses'
import { usePageMeta } from '@/lib/use-page-meta'

export function DiscoverPage() {
  const navigate = useNavigate()
  const [businesses, setBusinesses] = React.useState<Business[]>([])
  const [selected, setSelected] = React.useState<Business | null>(null)
  const [query, setQuery] = React.useState('')
  const [loading, setLoading] = React.useState(true)

  usePageMeta({ title: 'Shop map | The Loyalty Loop', description: 'Find local Loyalty Loop shops on the map.', path: '/dashboard/discover', robots: 'noindex,nofollow,noarchive' })

  React.useEffect(() => { fetchBusinesses().then(setBusinesses).finally(() => setLoading(false)) }, [])

  const filtered = businesses.filter((business) => `${business.name} ${business.category ?? ''} ${business.address ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  const located = filtered.filter((business) => business.lat != null && business.lng != null)

  return <DashboardLayout>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm text-foreground/50">Explore The Loyalty Loop</p><h1 className="mt-1 font-display text-3xl text-foreground">Find a local shop</h1></div>
      <label className="relative block w-full sm:w-80"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/45" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shops or areas" className="h-11 w-full rounded-xl border border-black/10 bg-card pl-10 pr-4 text-sm outline-none" /></label>
    </div>
    {loading ? <SkeletonBlock className="h-[560px] w-full rounded-2xl" /> : <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <BusinessesMap businesses={located} onSelect={setSelected} />
      <aside className="max-h-[560px] overflow-y-auto rounded-2xl border border-black/10 bg-card p-2"><p className="px-3 pb-2 pt-3 text-xs font-bold uppercase tracking-wide text-foreground/45">{located.length} on the map</p>
        {located.map((business) => { const active = selected?.id === business.id; return <button key={business.id} onClick={() => setSelected(business)} className={`w-full rounded-xl p-3 text-left transition-colors ${active ? 'bg-primary/10' : 'hover:bg-black/5'}`}><div className="flex items-start gap-3">{business.logo_url ? <img src={business.logo_url} alt="" className="h-10 w-10 rounded-xl object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ backgroundColor: business.brand_color }}><Store className="h-4 w-4" /></span>}<span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-foreground">{business.name}</span><span className="mt-0.5 block truncate text-xs text-foreground/55">{business.category ?? 'Local shop'}</span><span className="mt-1 flex items-center gap-1 text-xs text-foreground/45"><MapPin className="h-3 w-3" />{business.address ?? 'Location confirmed'}</span></span></div></button> })}
        {!located.length && <p className="px-3 py-8 text-center text-sm text-foreground/50">No mapped shops match this search yet.</p>}
      </aside>
    </div>}
    {selected && <section className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-card p-5 shadow-sm"><div><p className="font-display text-xl text-foreground">{selected.name}</p><p className="mt-1 text-sm text-foreground/60">{selected.description || selected.address || 'A local Loyalty Loop shop.'}</p></div><button data-press-feedback onClick={() => navigate(`/dashboard/shop/${selected.slug}`)} className="h-10 rounded-full bg-foreground px-5 text-sm font-bold text-white">View shop</button></section>}
  </DashboardLayout>
}
