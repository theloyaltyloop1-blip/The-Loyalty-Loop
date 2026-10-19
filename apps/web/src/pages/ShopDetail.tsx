import * as React from 'react'
import { rewardWords } from '@/lib/shop-types'
import { flushSync } from 'react-dom'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowLeft, Heart, Gift, MapPin, Share2, BadgeCheck, Clock, Navigation } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { DashboardLayout } from '@/components/dashboard-layout'
import { PageSkeleton } from '@/components/page-skeleton'
import { ReviewsSection } from '@/components/reviews-section'
import { HowItWorks, openStatus } from '@/components/shop-profile'
import { programmeIdFor } from '@loyalty-loop/loyalty'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ShopMap } from '@/components/shop-map'
import { featureBadge } from '@/lib/shop-features'
import {
  fetchBusinessBySlug,
  fetchMembership,
  fetchRewardCatalog,
  joinBusiness,
  fetchFavouriteIds,
  addFavourite,
  removeFavourite,
  fetchBusinessPhotos,
  fetchMembershipTiers,
  fetchRollingSpendPence,
  type MembershipTier,
  type Business,
  type Membership,
  type RewardCatalogItem,
  type BusinessPhoto,
} from '@/lib/businesses'
import { usePageMeta } from '@/lib/use-page-meta'
import { categoryCopy } from '@/lib/categories'
import { onBrandColor } from '@/lib/utils'

const poundsLabel = (pence: number) => `£${pence % 100 === 0 ? pence / 100 : (pence / 100).toFixed(2)}`

const DAY_ORDER: { key: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]
const TODAY_KEY = DAY_ORDER[(new Date().getDay() + 6) % 7].key

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, '0')}${period}`
}

function darken(hex: string, amount: number) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (n >> 16) - amount)
  const g = Math.max(0, ((n >> 8) & 0xff) - amount)
  const b = Math.max(0, (n & 0xff) - amount)
  return `rgb(${r}, ${g}, ${b})`
}

export function ShopDetail() {
  const { id: slug } = useParams()
  const navigate = useNavigate()
  const { session, loading } = useAuth()

  const [business, setBusiness] = React.useState<Business | null>(null)
  const [membership, setMembership] = React.useState<Membership | null>(null)
  const [catalog, setCatalog] = React.useState<RewardCatalogItem[]>([])
  const [photos, setPhotos] = React.useState<BusinessPhoto[]>([])
  const [levels, setLevels] = React.useState<MembershipTier[]>([])
  const [rollingSpend, setRollingSpend] = React.useState<number | null>(null)
  const [stampCode, setStampCode] = React.useState<string | null>(null)
  const [favourite, setFavourite] = React.useState(false)
  const [optedIn, setOptedIn] = React.useState(true)
  const [ready, setReady] = React.useState(false)
  const [joining, setJoining] = React.useState(false)
  const [shared, setShared] = React.useState(false)
  const [joinError, setJoinError] = React.useState<string | null>(null)
  const [justJoined, setJustJoined] = React.useState(false)
  const [loadError, setLoadError] = React.useState(false)

  // Supabase fires onAuthStateChange multiple times in quick succession after
  // login/navigation (INITIAL_SESSION, token refresh, etc.), each producing a
  // *new* session object for the same logged-in user. refetch was keyed off
  // session?.user (the object), so each of those events re-triggered the
  // fetch-on-mount effect below, spawning an extra in-flight request. If one
  // of those older, slower requests (fetched before the user had joined)
  // resolved *after* the join button's own refetch, it silently overwrote the
  // freshly-joined membership back to null — the card would flash "joined"
  // then revert to "Join card". Fixed two ways: key off the stable user id
  // instead of the object, and ignore any refetch whose result is no longer
  // the latest one in flight.
  const userId = session?.user?.id
  const requestIdRef = React.useRef(0)
  const joiningCardRef = React.useRef(false)
  const loyaltyCardRef = React.useRef<HTMLDivElement>(null)

  const refetch = React.useCallback(async () => {
    if (!slug || !userId) return
    const thisRequestId = ++requestIdRef.current
    let biz: Business | null
    let m: Membership | null, cat: RewardCatalogItem[], pics: BusinessPhoto[]
    let tierRows: MembershipTier[] = []
    let spendPence: number | null = null
    try {
      biz = await fetchBusinessBySlug(slug)
      if (!biz) {
        if (thisRequestId === requestIdRef.current) setReady(true)
        return
      }
      ;[m, cat, pics] = await Promise.all([
        fetchMembership(userId, biz.id),
        fetchRewardCatalog(biz.id),
        fetchBusinessPhotos(biz.id),
      ])
      if (programmeIdFor(biz) === 'tiers') {
        tierRows = await fetchMembershipTiers(biz.id).catch(() => [])
        // If this fails the page shows the next level's threshold, not a guessed distance.
        spendPence = m ? await fetchRollingSpendPence(userId, biz.id).catch(() => null) : null
      }
    } catch {
      if (thisRequestId === requestIdRef.current) { setLoadError(true); setReady(true) }
      return
    }
    if (thisRequestId !== requestIdRef.current) return
    setLoadError(false) // a newer refetch already landed — drop this stale result
    setBusiness(biz)
    const applyMembership = () => setMembership(m)
    const documentWithViewTransition = document as Document & { startViewTransition?: (update: () => void) => unknown }
    if (joiningCardRef.current && m && documentWithViewTransition.startViewTransition) {
      // startViewTransition is a Document method. Calling a detached reference
      // loses its `this` value in Chromium and throws "Illegal invocation".
      documentWithViewTransition.startViewTransition(() => flushSync(applyMembership))
    } else {
      applyMembership()
    }
    joiningCardRef.current = false
    setCatalog(cat)
    setPhotos(pics)
    setLevels(tierRows)
    setRollingSpend(spendPence)
    setOptedIn(m ? !m.promos_opted_out : true)
    setReady(true)
  }, [slug, userId])

  React.useEffect(() => {
    void refetch()
  }, [refetch])

  const shopStructuredData = business
    ? {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: business.name,
        description: business.description ?? undefined,
        url: `https://www.the-loyalty-loop.com/dashboard/shop/${business.slug}`,
        image: business.cover_url ?? business.logo_url ?? undefined,
        telephone: business.phone ?? undefined,
        address:
          business.address || business.postcode
            ? {
                '@type': 'PostalAddress',
                streetAddress: business.address ?? undefined,
                postalCode: business.postcode ?? undefined,
                addressCountry: 'GB',
              }
            : undefined,
        geo:
          business.lat != null && business.lng != null
            ? { '@type': 'GeoCoordinates', latitude: business.lat, longitude: business.lng }
            : undefined,
        sameAs: [business.website, business.instagram, business.tiktok, business.youtube].filter(Boolean),
      }
    : undefined

  usePageMeta({
    title: business ? `${business.name} | The Loyalty Loop` : 'Shop | The Loyalty Loop',
    description: business
      ? (business.description?.trim() || `Join ${business.name}'s digital loyalty card on The Loyalty Loop and start earning rewards.`)
      : 'View this shop’s digital loyalty card on The Loyalty Loop.',
    path: `/dashboard/shop/${slug ?? ''}`,
    image: business?.logo_url || business?.cover_url || undefined,
    robots: 'noindex,nofollow,noarchive',
    structuredData: shopStructuredData,
  })

  React.useEffect(() => {
    if (!justJoined || !membership) return
    requestAnimationFrame(() => loyaltyCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    setJustJoined(false)
  }, [justJoined, membership])

  React.useEffect(() => {
    if (!userId) return
    supabase
      .from('profiles')
      .select('stamp_code')
      .eq('id', userId)
      .single()
      .then(({ data }) => setStampCode(data?.stamp_code ?? null))
  }, [userId])

  React.useEffect(() => {
    if (!userId || !business) return
    fetchFavouriteIds(userId).then((ids) => setFavourite(ids.has(business.id))).catch(() => undefined)
  }, [userId, business?.id])

  async function handleToggleFavourite() {
    if (!session?.user || !business) return
    const next = !favourite
    setFavourite(next)
    try {
      if (next) await addFavourite(session.user.id, business.id)
      else await removeFavourite(session.user.id, business.id)
    } catch {
      setFavourite(!next)
    }
  }

  if (loading || (session && !ready)) return <PageSkeleton variant="detail" />
  if (!session) return <Navigate to="/login" replace />
  if (loadError && !business) {
    return (
      <DashboardLayout>
        <div role="alert" className="mx-auto max-w-md rounded-3xl bg-card p-8 text-center ring-1 ring-foreground/8">
          <h1 className="font-display text-2xl font-semibold">We couldn’t load this shop</h1>
          <p className="mt-2 text-sm text-muted-foreground">Check your connection and try again.</p>
          <button data-press-feedback onClick={() => { setReady(false); void refetch() }} className="mt-5 min-h-11 rounded-full bg-primary px-5 font-semibold text-primary-foreground">Try again</button>
        </div>
      </DashboardLayout>
    )
  }
  if (!business) return <Navigate to="/dashboard" replace />

  // Customers earn by spending; each reward unlocks at a £ amount (ARCH_PLAN.md §4.11).
  // The next reward is the lowest tier above their progress; after the top tier a new round starts.
  const tiers = catalog
    .filter((r) => r.spend_threshold_pence != null)
    .sort((a, b) => a.spend_threshold_pence! - b.spend_threshold_pence!)
  const progress = Math.max(0, membership?.reward_progress_pence ?? 0)
  const nextTier = tiers.find((r) => r.spend_threshold_pence! > progress) ?? tiers[tiers.length - 1]
  const targetPence = nextTier?.spend_threshold_pence ?? business.reward_threshold_pence ?? 2000
  const rewardTitle = nextTier?.title ?? 'Free reward'
  const remainingPence = Math.max(0, targetPence - progress)

  // Stamp / points / visits shops (reward_model 'stamp_legacy').
  const spendShop = business.reward_model === 'spend_threshold'
  const programmeId = programmeIdFor(business)
  const tierShop = programmeId === 'tiers'
  const pointsShop = programmeId === 'points'
  const status = openStatus(business.opening_hours)
  const featureChips = [business.category, ...(business.features ?? []).map((id) => featureBadge(id, business.halal_certifier))].filter(Boolean) as string[]
  const StampIcon = categoryCopy(business.category).icon
  const stampsRequired = catalog[0]?.stamp_threshold ?? business.loyalty_config?.stamps_required ?? 10
  const unit = rewardWords(business.loyalty_type).unit
  const stampProgress = business.loyalty_type === 'points' ? membership?.points_balance ?? 0 : membership?.stamp_count ?? 0

  async function handleJoin() {
    if (!session?.user || !business) return
    setJoining(true)
    setJoinError(null)
    try {
      await joinBusiness(session.user.id, business.id)
      joiningCardRef.current = true
      setJustJoined(true)
      await refetch()
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : 'Could not join this loyalty card. Please try again.')
    } finally {
      setJoining(false)
    }
  }

  async function handleToggleOptIn() {
    if (!session?.user || !business || !membership) return
    const next = !optedIn
    setOptedIn(next)
    const { error } = await supabase
      .from('memberships')
      .update({ promos_opted_out: !next })
      .eq('user_id', session.user.id)
      .eq('business_id', business.id)
    if (error) {
      setOptedIn(!next)
      toast.error('We could not update your promotion setting. Please try again.')
    }
  }

  async function handleShare() {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: business?.name, url })
      else {
        await navigator.clipboard.writeText(url)
        setShared(true)
        setTimeout(() => setShared(false), 2000)
      }
    } catch {
      // Share sheet dismissed: nothing to do.
    }
  }

  return (
    <DashboardLayout>
      <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link to="/dashboard" className="hover:text-primary">Home</Link>
        <span aria-hidden="true">/</span>
        <Link to="/dashboard/discover" className="hover:text-primary">Discover</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="font-semibold text-foreground">{business.name}</span>
      </nav>
      <button data-press-feedback
        onClick={() => navigate(-1)}
        className="mb-4 -ml-3 flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <section aria-label={`${business.name} profile`} className="mb-6 overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/8">
        <div
          className="relative h-44 sm:h-60"
          style={{
            background: business.cover_url
              ? `url(${business.cover_url}) center/cover`
              : `linear-gradient(135deg, ${business.brand_color}, ${darken(business.brand_color, 40)})`,
          }}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button data-press-feedback
                onClick={handleToggleFavourite}
                aria-label={favourite ? `Remove ${business.name} from favourites` : `Add ${business.name} to favourites`}
                className={
                  'absolute top-4 right-4 h-11 w-11 rounded-full flex items-center justify-center transition-colors duration-150 ease-out ' +
                  (favourite ? 'bg-card text-primary' : 'bg-card/90 text-foreground hover:bg-card')
                }
              >
                <Heart className="h-5 w-5" fill={favourite ? 'currentColor' : 'none'} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">{favourite ? 'Remove from favourites' : 'Add to favourites'}</TooltipContent>
          </Tooltip>
        </div>
        <div className="px-5 pb-6 sm:px-8 sm:pb-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div
              className="-mt-10 flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl bg-card font-display text-3xl font-bold ring-4 ring-card sm:-mt-12 sm:h-24 sm:w-24"
              style={{ backgroundColor: business.logo_url ? undefined : business.brand_color }}
            >
              {business.logo_url ? (
                <img src={business.logo_url} alt={`${business.name} logo`} className="h-full w-full object-cover" />
              ) : (
                <span style={{ color: onBrandColor(business.brand_color) }}>{business.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <button data-press-feedback
                onClick={membership ? () => loyaltyCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : handleJoin}
                disabled={joining}
                className="h-12 rounded-full px-8 font-semibold transition-transform active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: business.brand_color, color: onBrandColor(business.brand_color) }}
              >
                {joining ? 'Joining…' : membership ? 'Your card' : 'Join card'}
              </button>
              {joinError && <p role="alert" className="text-sm font-semibold text-destructive">{joinError}</p>}
            </div>
          </div>
          <h1 className="mt-4 flex min-w-0 items-center gap-2 font-display text-3xl font-bold tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-4xl">
            <span className="min-w-0">{business.name}</span>
            {business.verification_status === 'verified' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <BadgeCheck tabIndex={0} className="h-7 w-7 shrink-0 rounded-full text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Verified: we've confirmed this is a real business" />
                </TooltipTrigger>
                <TooltipContent>Verified: we've confirmed this is a real business</TooltipContent>
              </Tooltip>
            )}
          </h1>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {featureChips.map((chip) => <li key={chip} className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-foreground">{chip}</li>)}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold text-foreground">
            {business.rating_avg != null && (business.rating_count ?? 0) > 0 && (
              <span>★ {Number(business.rating_avg).toFixed(1)} <span className="font-normal">({business.rating_count} {business.rating_count === 1 ? 'review' : 'reviews'})</span></span>
            )}
            {status && (
              <span className={'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ' + (status.open ? 'bg-sage text-sage-ink' : 'bg-destructive/10 text-foreground')}>
                <span className={'h-2 w-2 rounded-full ' + (status.open ? 'bg-green-600' : 'bg-destructive')} />
                {status.label}
              </span>
            )}
          </div>
          {business.description && <p className="mt-4 max-w-2xl text-foreground">{business.description}</p>}
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-6">
      {membership ? (
        <div className="loyalty-card-panel rounded-3xl bg-card ring-1 ring-foreground/8 p-6 sm:p-8" style={{ viewTransitionName: 'loyalty-card' }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-display font-semibold tracking-tight text-foreground">
              {tierShop
                ? 'Your level'
                : pointsShop
                  ? 'Your points'
                  : spendShop
                ? 'Your progress'
                : business.loyalty_type === 'points'
                  ? 'Your points'
                  : business.loyalty_type === 'tiered'
                    ? 'Your visits'
                    : 'Your stamp card'}
            </h2>
            <p className="text-sm font-semibold tabular-nums text-muted-foreground">
              {tierShop
                ? membership.current_tier || 'Getting started'
                : pointsShop
                  ? `${membership.points_balance} ${membership.points_balance === 1 ? 'point' : 'points'}`
                  : spendShop
                ? `${poundsLabel(progress)} / ${poundsLabel(targetPence)} · ${rewardTitle}`
                : `${stampProgress} / ${stampsRequired} · ${catalog[0]?.title ?? 'Free reward'}`}
            </p>
          </div>

          {tierShop || pointsShop ? null : !spendShop ? (
            <>
          {business.loyalty_type === 'points' ? (
            <div className="mb-8">
              <div className="h-4 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-300 ease-in-out"
                  style={{
                    width: `${Math.min(100, (stampProgress / stampsRequired) * 100)}%`,
                    backgroundColor: business.brand_color,
                  }}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {Math.max(0, stampsRequired - stampProgress)} more point{stampsRequired - stampProgress === 1 ? '' : 's'} to{' '}
                {rewardTitle.toLowerCase()}.
              </p>
            </div>
          ) : (
          <div className="flex flex-wrap gap-3 mb-8">
            {Array.from({ length: stampsRequired }).map((_, i) => {
              const isLast = i === stampsRequired - 1
              const filled = i < stampProgress
              if (isLast) {
                return (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div
                      className="h-16 w-16 rounded-full border-2 border-dashed flex items-center justify-center"
                      style={{ borderColor: business.brand_color, color: business.brand_color }}
                    >
                      <Gift className="h-5 w-5" />
                    </div>
                    <span
                      className="text-[0.5625rem] font-bold"
                      style={{ color: business.brand_color }}
                    >
                      Free {rewardTitle.replace(/^free\s+/i, '')}
                    </span>
                  </div>
                )
              }
              return (
                <div
                  key={i}
                  data-filled={filled}
                  className="loyalty-stamp h-16 w-16 rounded-full border flex items-center justify-center"
                  style={
                    filled
                      ? { backgroundColor: business.brand_color, borderColor: business.brand_color }
                      : { borderColor: 'rgba(0,0,0,0.12)' }
                  }
                >
                  <StampIcon className={'h-5 w-5 transition-[color,transform] duration-200 ease-in-out ' + (filled ? 'scale-100' : 'text-foreground/20 scale-90')} style={filled ? { color: onBrandColor(business.brand_color) } : undefined} />
                </div>
              )
            })}
          </div>
          )}
            </>
          ) : (
          <div className="mb-8">
            <div className="h-4 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-300 ease-in-out"
                style={{
                  width: `${Math.min(100, (progress / targetPence) * 100)}%`,
                  backgroundColor: business.brand_color,
                }}
              />
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Spend {poundsLabel(remainingPence)} more to unlock {rewardTitle}.
            </p>
          </div>
          )}

          <div ref={loyaltyCardRef} className="flex flex-col sm:flex-row items-start gap-6 rounded-2xl bg-sage p-5 text-sage-ink">
            <div className="rounded-xl bg-white p-2.5"><QRCodeSVG value={`loyaltyloop:customer:${session.user.id}`} size={112} /></div>
            <div>
              <p className="text-sm text-sage-ink/75 mb-0.5">Manual code</p>
              <p className="font-mono font-bold text-xl tracking-widest mb-3">
                {stampCode ?? '-'}
              </p>
              <p className="font-semibold mb-1">Show this to staff</p>
              <p className="text-sm text-sage-ink/80 max-w-sm">
                {tierShop || pointsShop
                  ? 'They scan the code, or type the manual code above, and add what you spent.'
                  : spendShop
                  ? 'They scan the code, or type the manual code above, and add what you spent. Rewards are added to your wallet automatically.'
                  : `They scan the code to add a ${unit}, or type the manual code above. ${Math.max(0, stampsRequired - stampProgress)} ${unit}${Math.max(0, stampsRequired - stampProgress) === 1 ? '' : 's'} to your next reward.`}
              </p>
            </div>
          </div>

          <div className="border-t border-border mt-6 pt-5 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-semibold text-foreground">Promotions from {business.name}</p>
              <p className="text-sm text-muted-foreground">
                {optedIn
                  ? "You'll get occasional offers and re-engagement messages."
                  : "You won't receive promo notifications from this shop."}
              </p>
            </div>
            <button data-press-feedback
              onClick={handleToggleOptIn}
              className="rounded-full px-5 h-10 font-semibold text-foreground shrink-0 ring-1 ring-foreground/15 transition-colors hover:bg-secondary"
            >
              {optedIn ? 'Opt out' : 'Opt in'}
            </button>
          </div>
        </div>
      ) : null}

      <HowItWorks business={business} membership={membership} catalog={catalog} tiers={levels} rollingSpendPence={rollingSpend} refetch={refetch} />

      {photos.length > 0 && (
        <div className="rounded-3xl bg-card ring-1 ring-foreground/8 p-6 sm:p-7">
          <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-4">Gallery</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {photos.map((p, index) => (
              <div key={p.id} className="rounded-xl overflow-hidden aspect-square">
                <img src={p.url} alt={`${business.name} gallery photo ${index + 1}`} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      <ReviewsSection businessId={business.id} userId={session.user.id} canReview={Boolean(membership)} />
      </div>
      <aside className="space-y-4 lg:sticky lg:top-24">
      {business.opening_hours && Object.keys(business.opening_hours).length > 0 && (
        <div className="rounded-3xl bg-card ring-1 ring-foreground/8 p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-foreground mb-3">
            <Clock className="h-5 w-5 text-primary" /> Opening hours
          </h2>
          <div className="flex flex-col divide-y divide-border">
            {DAY_ORDER.map(({ key, label }) => {
              const day = business.opening_hours?.[key]
              const isToday = key === TODAY_KEY
              return (
                <div
                  key={key}
                  className={
                    'flex items-center justify-between py-2 text-sm ' +
                    (isToday ? 'font-semibold text-foreground' : 'text-muted-foreground')
                  }
                >
                  <span>
                    {label} {isToday && <span className="ml-1 rounded-full bg-peach px-2 py-0.5 text-xs font-semibold text-peach-ink">Today</span>}
                  </span>
                  <span>{!day || day.closed ? 'Closed' : `${formatTime(day.open)} to ${formatTime(day.close)}`}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}


      {business.lat != null && business.lng != null && (
        <div className="overflow-hidden rounded-3xl">
          <ShopMap lat={business.lat} lng={business.lng} color={business.brand_color} height={200} />
        </div>
      )}

      <div className="flex flex-col gap-3">
        {business.address ? (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              [business.address, business.postcode].filter(Boolean).join(', ')
            )}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl bg-card ring-1 ring-foreground/8 px-5 py-3.5 flex items-start gap-2 font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {business.address}
            {business.postcode ? `, ${business.postcode}` : ''}
            <Navigation className="mt-1 ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </a>
        ) : null}
        <button data-press-feedback onClick={handleShare} className="rounded-full px-5 h-11 font-semibold text-foreground flex items-center justify-center gap-2 ring-1 ring-foreground/15 transition-colors hover:bg-secondary">
          <Share2 className="h-4 w-4" /> {shared ? 'Link copied' : 'Share'}
        </button>
      </div>
      </aside>
      </div>
    </DashboardLayout>
  )
}
