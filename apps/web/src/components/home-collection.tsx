import { useState } from 'react'
import { ArrowRight, Check, MapPin, Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Business, Membership, RewardCatalogItem } from '@/lib/businesses'
import { getHomeProgress } from '@/lib/home-progress'
import { formatMiles, nearestFirst, type Coords, type FeaturedReason } from '@/lib/distance'
import type { LocationStatus } from '@/lib/use-user-location'

// Only the closest shops get a photo card. The rest wait behind a button, as quiet rows.
const PHOTO_CARDS = 6
const ROWS_PER_TAP = 8

function Photo({ business, hero = false, distance, heroLabel }: { business: Business; hero?: boolean; distance?: string; heroLabel?: string }) {
  const [failedLogo, setFailedLogo] = useState(false)
  const [failedCover, setFailedCover] = useState(false)
  return (
    <div className={'relative overflow-hidden ' + (hero ? 'h-64 sm:h-80' : 'h-36 sm:h-40')} style={{ backgroundColor: business.brand_color || 'var(--color-sage)' }}>
      <div className="absolute inset-0 grid place-items-center text-olive-ink/80" style={{ backgroundColor: business.brand_color || 'var(--color-olive)' }} aria-hidden="true">
        {business.logo_url && !failedLogo
          ? <img src={business.logo_url} alt="" onError={() => setFailedLogo(true)} className="h-20 w-20 rounded-2xl bg-background object-contain p-2" />
          : <span className="font-display text-6xl font-bold">{business.name.trim().charAt(0).toUpperCase() || <Store />}</span>}
      </div>
      {business.cover_url && <img
        src={business.cover_url}
        alt=""
        onError={() => setFailedCover(true)}
        className={'absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.025] ' + (failedCover ? 'hidden' : '')}
      />}
      {!hero && distance && <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/95 px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm"><MapPin className="h-3 w-3 text-primary" aria-hidden="true" />{distance}</span>}
      {hero && heroLabel && <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm"><MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />{heroLabel}</span>}
      {hero && !heroLabel && business.address && <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm"><MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />{business.postcode || business.address}</span>}
    </div>
  )
}

function Mark({ business }: { business: Business }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl font-display text-lg font-bold text-olive-ink" style={{ backgroundColor: business.brand_color || 'var(--color-olive)' }} aria-hidden="true">
      {business.logo_url && !failed
        ? <img src={business.logo_url} alt="" onError={() => setFailed(true)} className="h-full w-full bg-background object-contain p-1" />
        : business.name.trim().charAt(0).toUpperCase() || <Store className="h-5 w-5" />}
    </span>
  )
}

function LocationNote({ status, onUseLocation }: { status: LocationStatus; onUseLocation: () => void }) {
  const button = 'inline-flex min-h-11 items-center gap-2 rounded-full bg-card px-4 text-sm font-semibold text-foreground ring-1 ring-foreground/10 transition-colors hover:bg-sage focus-visible:outline-3 focus-visible:outline-primary'
  if (status === 'ask') return <button type="button" onClick={onUseLocation} className={button}><MapPin className="h-4 w-4 text-primary" aria-hidden="true" />Show closest first</button>
  if (status === 'unavailable') return <button type="button" onClick={onUseLocation} className={button}><MapPin className="h-4 w-4 text-primary" aria-hidden="true" />Couldn’t find you. Try again</button>
  if (status === 'locating') return <p role="status" className="text-sm font-medium text-muted-foreground">Finding the closest shops…</p>
  if (status === 'ready') return <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground"><MapPin className="h-4 w-4 text-primary" aria-hidden="true" />Closest first</p>
  if (status === 'denied') return <p className="max-w-xs text-sm text-muted-foreground sm:text-right">Location is off for this site. Allow it in your browser settings to see the closest shops first.</p>
  return null
}

export function HomeCollection({ businesses, featured, featuredReason, memberships, catalog, filtered, location, locationStatus, onUseLocation }: {
  businesses: Business[]
  featured: Business | undefined
  featuredReason?: FeaturedReason
  memberships: Membership[]
  catalog: RewardCatalogItem[]
  filtered: boolean
  location: Coords | null
  locationStatus: LocationStatus
  onUseLocation: () => void
}) {
  const [showAll, setShowAll] = useState(false)
  const [moreRows, setMoreRows] = useState(0)
  const membershipByBusiness = new Map(memberships.map((membership) => [membership.business_id, membership]))
  // The shop in the big card at the top isn't repeated in the list of your cards.
  const joined = businesses.filter((business) => membershipByBusiness.has(business.id) && business.id !== featured?.id)
  const discoveries = businesses.filter((business) => business.id !== featured?.id)
  const ranked = location ? nearestFirst(discoveries, location) : discoveries.map((shop) => ({ shop, miles: null as number | null }))
  const nearby = ranked.slice(0, PHOTO_CARDS)
  const rest = ranked.slice(PHOTO_CARDS)
  const hiddenRows = Math.max(0, rest.length - moreRows)
  const nextBatch = Math.min(ROWS_PER_TAP, hiddenRows)
  const featuredMiles = featured && location ? nearestFirst([featured], location)[0].miles : null
  const heroLabel = featuredReason === 'visited' ? 'Your most visited' : featuredReason === 'closest' && featuredMiles !== null ? `Closest to you \u00b7 ${formatMiles(featuredMiles)}` : undefined
  const featuredProgress = featured ? getHomeProgress(featured, membershipByBusiness.get(featured.id), catalog) : null
  return <>
    {featured && featuredProgress && <Link
      to={`/dashboard/shop/${featured.slug}`}
      aria-label={`Explore ${featured.name}${featured.category ? `, ${featured.category}` : ''}`}
      className="group block overflow-hidden rounded-3xl bg-olive text-olive-ink shadow-sticker transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sticker-lifted focus-visible:outline-3 focus-visible:outline-primary"
    >
      <Photo business={featured} hero heroLabel={heroLabel} />
      <div className="p-5 sm:p-7">
        <p className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{featured.name}</p>
        <p className="mt-1 text-sm text-olive-ink/85">{featured.description || featured.category || 'A local favourite'}</p>
        <div className="mt-5 flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-sage px-4 py-3 text-sage-ink sm:rounded-full sm:px-5">
          <span className="min-w-0 text-sm font-semibold">{featuredProgress.title || `${featuredProgress.label} towards a reward`}</span>
          <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
        </div>
      </div>
    </Link>}

    {joined.length > 0 && <section aria-labelledby="home-membership-heading" className="mt-10 sm:mt-14">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 id="home-membership-heading" className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Your regulars. Your rewards.</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(showAll ? joined : joined.slice(0, 3)).map((business, index) => {
          const progress = getHomeProgress(business, membershipByBusiness.get(business.id), catalog)
          const background = index % 3 === 0 ? 'var(--color-olive)' : index % 3 === 1 ? 'var(--color-peach)' : 'var(--color-sage)'
          const ink = index % 3 === 0 ? 'var(--color-olive-ink)' : index % 3 === 1 ? 'var(--color-peach-ink)' : 'var(--color-sage-ink)'
          return <Link key={business.id} to={`/dashboard/shop/${business.slug}`} aria-label={`${business.name}. ${progress.label}. View loyalty card.`} className="block rounded-2xl p-5 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sticker-lifted focus-visible:outline-3 focus-visible:outline-primary" style={{ backgroundColor: background, color: ink }}>
            <p className="font-display text-xl font-bold tracking-tight">{business.name}</p>
            <p className="mt-1 text-sm">{progress.reward}</p>
            {progress.target && !progress.spend && progress.target <= 12
              ? <div className="mt-5 flex flex-wrap gap-2" role="img" aria-label={progress.label}>{Array.from({ length: progress.target }, (_, stamp) => <span key={stamp} aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-full border text-xs font-bold" style={{ borderColor: ink, backgroundColor: stamp < progress.value ? ink : 'transparent', color: background }}>{stamp < progress.value && <Check className="h-3.5 w-3.5" aria-hidden="true" />}</span>)}</div>
              : progress.target ? <div className="mt-6" role="progressbar" aria-label={`${business.name} loyalty progress`} aria-valuemin={0} aria-valuemax={progress.target} aria-valuenow={Math.min(progress.value, progress.target)} aria-valuetext={progress.label}><div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: index % 3 === 0 ? 'color-mix(in srgb, var(--color-olive-ink) 25%, var(--color-olive))' : `color-mix(in srgb, ${ink} 20%, transparent)` }}><div className="h-full rounded-full transition-[width] duration-300 ease-out" style={{ width: `${progress.fraction * 100}%`, backgroundColor: ink }} /></div></div> : <p className="mt-6 text-sm">Keep collecting to discover your next reward.</p>}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{progress.label}</span><span className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold" style={{ backgroundColor: index % 3 === 0 ? 'var(--color-olive-ink)' : 'var(--color-primary)', color: index % 3 === 0 ? 'var(--color-olive)' : 'var(--color-primary-foreground)' }}>View card <ArrowRight className="h-4 w-4" aria-hidden="true" /></span></div>
          </Link>
        })}
      </div>
      {joined.length > 3 && <button type="button" onClick={() => setShowAll((value) => !value)} aria-expanded={showAll} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-card px-5 text-sm font-semibold text-foreground ring-1 ring-foreground/10 transition-colors hover:bg-sage focus-visible:outline-3 focus-visible:outline-primary">{showAll ? 'Show fewer cards' : `See all ${joined.length} cards`}<ArrowRight className="h-4 w-4" aria-hidden="true" /></button>}
    </section>}

    {discoveries.length > 0 && <section aria-labelledby="home-discovery-heading" className="mt-10 sm:mt-14">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <h2 id="home-discovery-heading" className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{filtered ? 'More matching shops' : 'Find your next favourite'}</h2>
        <LocationNote status={locationStatus} onUseLocation={onUseLocation} />
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-3">
        {nearby.map(({ shop: business, miles }) => <Link key={business.id} to={`/dashboard/shop/${business.slug}`} aria-label={`Explore ${business.name}${business.category ? `, ${business.category}` : ''}${miles !== null ? `, ${formatMiles(miles)} away` : ''}`} className="group w-[78%] shrink-0 snap-start overflow-hidden rounded-2xl bg-card text-foreground shadow-sm transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sticker focus-visible:outline-3 focus-visible:outline-primary sm:w-auto">
          <Photo business={business} distance={miles !== null ? formatMiles(miles) : undefined} />
          <div className="flex items-center justify-between gap-3 p-4"><div className="min-w-0"><p className="truncate font-display text-lg font-bold">{business.name}</p><p className="mt-1 truncate text-sm text-muted-foreground">{business.category || 'Local independent'}</p></div><ArrowRight className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" /></div>
        </Link>)}
      </div>
      {moreRows > 0 && <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {rest.slice(0, moreRows).map(({ shop: business, miles }) => <li key={business.id}>
          <Link to={`/dashboard/shop/${business.slug}`} aria-label={`Explore ${business.name}${business.category ? `, ${business.category}` : ''}${miles !== null ? `, ${formatMiles(miles)} away` : ''}`} className="flex min-h-16 items-center gap-3 rounded-2xl bg-card px-3 py-2.5 text-foreground ring-1 ring-foreground/5 transition-colors hover:bg-sage/60 focus-visible:outline-3 focus-visible:outline-primary">
            <Mark business={business} />
            <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{business.name}</span><span className="block truncate text-sm text-muted-foreground">{[business.category || 'Local independent', miles !== null ? formatMiles(miles) : null].filter(Boolean).join(' \u00b7 ')}</span></span>
            <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          </Link>
        </li>)}
      </ul>}
      {hiddenRows > 0 && <button type="button" onClick={() => setMoreRows((count) => count + ROWS_PER_TAP)} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-card px-5 text-sm font-semibold text-foreground ring-1 ring-foreground/10 transition-colors hover:bg-sage focus-visible:outline-3 focus-visible:outline-primary">{`Show ${nextBatch} more ${nextBatch === 1 ? 'shop' : 'shops'}`}<ArrowRight className="h-4 w-4" aria-hidden="true" /></button>}
    </section>}

    {!featured && !joined.length && !discoveries.length && <p role="status" className="rounded-2xl bg-sage px-5 py-6 text-sage-ink">{filtered ? 'No shops match. Try another search or category.' : 'No local shops yet. Check back soon.'}</p>}
  </>
}
