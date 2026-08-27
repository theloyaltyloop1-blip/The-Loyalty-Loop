import * as React from 'react'
import { flushSync } from 'react-dom'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowLeft, Heart, Gift, Lock, MapPin, Share2, Star, Scissors, Coffee, Zap, BadgeCheck, Clock, Navigation } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { DashboardLayout } from '@/components/dashboard-layout'
import { PageSkeleton } from '@/components/page-skeleton'
import { ReviewsSection } from '@/components/reviews-section'
import { ShopMap } from '@/components/shop-map'
import {
  fetchBusinessBySlug,
  fetchMembership,
  fetchRewardCatalog,
  joinBusiness,
  simulateStamp,
  fetchFavouriteIds,
  addFavourite,
  removeFavourite,
  fetchBusinessPhotos,
  type Business,
  type Membership,
  type RewardCatalogItem,
  type BusinessPhoto,
} from '@/lib/businesses'
import { usePageMeta } from '@/lib/use-page-meta'

const STAMP_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Café: Coffee,
  Restaurant: Coffee,
  Barber: Scissors,
}

const UNIT_LABEL: Record<string, string> = {
  stamp_card: 'stamp',
  points: 'point',
  tiered: 'visit',
}

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
  const [stampCode, setStampCode] = React.useState<string | null>(null)
  const [favourite, setFavourite] = React.useState(false)
  const [optedIn, setOptedIn] = React.useState(true)
  const [ready, setReady] = React.useState(false)
  const [joining, setJoining] = React.useState(false)
  const [joinError, setJoinError] = React.useState<string | null>(null)
  const [justJoined, setJustJoined] = React.useState(false)
  const [stamping, setStamping] = React.useState(false)

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
    const biz = await fetchBusinessBySlug(slug)
    if (!biz) {
      if (thisRequestId === requestIdRef.current) setReady(true)
      return
    }
    const [m, cat, pics] = await Promise.all([
      fetchMembership(userId, biz.id),
      fetchRewardCatalog(biz.id),
      fetchBusinessPhotos(biz.id),
    ])
    if (thisRequestId !== requestIdRef.current) return // a newer refetch already landed — drop this stale result
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
    setOptedIn(m ? !m.promos_opted_out : true)
    setReady(true)
  }, [slug, userId])

  React.useEffect(() => {
    refetch()
  }, [refetch])

  usePageMeta({
    title: business ? `${business.name} | The Loyalty Loop` : 'Shop | The Loyalty Loop',
    description: business
      ? (business.description?.trim() || `Join ${business.name}'s digital loyalty card on The Loyalty Loop and start earning rewards.`)
      : 'View this shop’s digital loyalty card on The Loyalty Loop.',
    path: `/dashboard/shop/${slug ?? ''}`,
    image: business?.logo_url || business?.cover_url || undefined,
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
    fetchFavouriteIds(userId).then((ids) => setFavourite(ids.has(business.id)))
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

  if (loading || !ready) return <PageSkeleton variant="detail" />
  if (!session) return <Navigate to="/login" replace />
  if (!business) return <Navigate to="/dashboard" replace />

  const StampIcon = STAMP_ICON[business.category ?? ''] ?? Star
  const isOwner = session.user.id === business.owner_id
  const stampsRequired = catalog[0]?.stamp_threshold ?? business.loyalty_config?.stamps_required ?? 10
  const rewardTitle = catalog[0]?.title ?? 'Free reward'
  const rewardSubtitle = catalog[0]?.description ?? ''
  const unit = UNIT_LABEL[business.loyalty_type] ?? 'stamp'
  const progress = business.loyalty_type === 'points' ? membership?.points_balance ?? 0 : membership?.stamp_count ?? 0

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
    await supabase
      .from('memberships')
      .update({ promos_opted_out: !next })
      .eq('user_id', session.user.id)
      .eq('business_id', business.id)
  }

  async function handleSimulateStamp() {
    if (!session?.user || !business) return
    setStamping(true)
    try {
      await simulateStamp(session.user.id, business.id)
      await refetch()
    } finally {
      setStamping(false)
    }
  }

  return (
    <DashboardLayout>
      <button data-press-feedback
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm font-semibold text-foreground/60 hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div
        className="relative rounded-3xl p-8 mb-6 text-white bg-cover bg-center"
        style={{
          background: business.cover_url
            ? `linear-gradient(135deg, rgba(0,0,0,0.35), rgba(0,0,0,0.45)), url(${business.cover_url}) center/cover`
            : `linear-gradient(135deg, ${business.brand_color}, ${darken(business.brand_color, 40)})`,
        }}
      >
        <button data-press-feedback
          onClick={handleToggleFavourite}
          className={
            'absolute top-6 right-6 h-11 w-11 rounded-full flex items-center justify-center transition-colors duration-150 ease-out ' +
            (favourite ? 'bg-accent text-white' : 'bg-white/90 text-foreground')
          }
        >
          <Heart className="h-5 w-5" fill={favourite ? 'currentColor' : 'none'} />
        </button>

        <div
          className="h-16 w-16 rounded-2xl bg-white flex items-center justify-center font-display font-extrabold text-2xl mb-5 overflow-hidden"
          style={{ color: business.brand_color }}
        >
          {business.logo_url ? (
            <img src={business.logo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            business.name.charAt(0).toUpperCase()
          )}
        </div>

        <h1 className="text-4xl font-display font-extrabold mb-1 flex items-center gap-2">
          {business.name}
          {business.verification_status === 'verified' && (
            <BadgeCheck className="h-7 w-7 text-white shrink-0" aria-label="Verified" />
          )}
        </h1>
        <p className="text-white/80 mb-2">{business.category}</p>
        <p className="text-white/70 max-w-md">{business.description}</p>
      </div>

      {!membership ? (
        <div className="loyalty-card-panel rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-10 text-center mb-6" style={{ viewTransitionName: 'loyalty-card' }}>
          <h2 className="text-2xl font-display font-bold text-foreground mb-4">
            Join {business.name}'s loyalty card
          </h2>
          <span className="inline-block rounded-full bg-black/5 text-foreground/70 text-xs font-semibold px-3 py-1 mb-3">
            Your reward
          </span>
          <p className="text-xl font-display font-bold text-foreground">{rewardTitle}</p>
          <p className="text-sm text-foreground/50 mb-1">{rewardSubtitle}</p>
          <p className="text-sm text-foreground/50 mb-6">
            Collect {stampsRequired} {unit}
            {stampsRequired === 1 ? '' : 's'} to unlock it.
          </p>
          <button data-press-feedback
            onClick={handleJoin}
            disabled={joining}
            className="rounded-full px-8 h-12 font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: business.brand_color }}
          >
            {joining ? 'Joining…' : 'Join card'}
          </button>
          {joinError && <p className="mt-4 text-sm font-semibold text-red-600">{joinError}</p>}
        </div>
      ) : (
        <div className="loyalty-card-panel rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-8 mb-6" style={{ viewTransitionName: 'loyalty-card' }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-display font-bold text-foreground">
              {business.loyalty_type === 'points'
                ? 'Your points'
                : business.loyalty_type === 'tiered'
                  ? 'Your visits'
                  : 'Your stamp card'}
            </h2>
            <p className="text-sm font-semibold text-foreground/60">
              {progress} / {stampsRequired} · {rewardTitle}
            </p>
          </div>

          {business.loyalty_type === 'points' ? (
            <div className="mb-8">
              <div className="h-4 rounded-full bg-black/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-300 ease-in-out"
                  style={{
                    width: `${Math.min(100, (progress / stampsRequired) * 100)}%`,
                    backgroundColor: business.brand_color,
                  }}
                />
              </div>
              <p className="text-sm text-foreground/50 mt-2">
                {Math.max(0, stampsRequired - progress)} more point{stampsRequired - progress === 1 ? '' : 's'} to{' '}
                {rewardTitle.toLowerCase()}.
              </p>
            </div>
          ) : (
          <div className="flex flex-wrap gap-3 mb-8">
            {Array.from({ length: stampsRequired }).map((_, i) => {
              const isLast = i === stampsRequired - 1
              const filled = i < progress
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
                      className="text-[0.5625rem] font-extrabold uppercase tracking-wide"
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
                  <StampIcon className={'h-5 w-5 transition-[color,transform] duration-200 ease-in-out ' + (filled ? 'text-white scale-100' : 'text-foreground/20 scale-90')} />
                </div>
              )
            })}
          </div>
          )}

          <div ref={loyaltyCardRef} className="flex flex-col sm:flex-row items-start gap-6">
            <QRCodeSVG value={`loyaltyloop:customer:${session.user.id}`} size={110} />
            <div>
              <p className="text-[0.625rem] font-bold uppercase tracking-wide text-foreground/40 mb-1">Manual code</p>
              <p className="font-mono font-bold text-lg tracking-widest text-foreground mb-3">
                {stampCode ?? '—'}
              </p>
              <p className="font-semibold text-foreground mb-1">Show this to staff</p>
              <p className="text-sm text-foreground/50 max-w-sm">
                They scan the code to add a {unit}, or type the manual code above. {Math.max(0, stampsRequired - progress)} {unit}
                {Math.max(0, stampsRequired - progress) === 1 ? '' : 's'} to your next reward.
              </p>
            </div>
          </div>

          {isOwner && (
            <div className="border-t border-black/10 mt-6 pt-5">
              <button data-press-feedback
                onClick={handleSimulateStamp}
                disabled={stamping}
                className="flex items-center gap-2 rounded-full border border-dashed border-foreground/30 px-5 h-10 font-semibold text-sm text-foreground/70 disabled:opacity-50"
              >
                <Zap className="h-4 w-4" /> {stamping ? 'Adding…' : 'Simulate stamp (owner testing)'}
              </button>
            </div>
          )}

          <div className="border-t border-black/10 mt-6 pt-5 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-semibold text-foreground">Promotions from {business.name}</p>
              <p className="text-sm text-foreground/50">
                {optedIn
                  ? "You'll get occasional offers and re-engagement messages."
                  : "You won't receive promo notifications from this shop."}
              </p>
            </div>
            <button data-press-feedback
              onClick={handleToggleOptIn}
              className="rounded-full border border-black/15 px-5 h-10 font-semibold text-foreground shrink-0"
            >
              {optedIn ? 'Opt out' : 'Opt in'}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6 mb-6">
        <p className="flex items-center gap-2 font-display font-bold text-foreground mb-4">
          <Gift className="h-5 w-5 text-primary" /> What you can earn
        </p>
        <div className="rounded-xl bg-black/5 flex items-center gap-4 p-4">
          <span className="h-10 w-10 rounded-full bg-[#EFE1C8] flex items-center justify-center shrink-0">
            <Lock className="h-4 w-4 text-foreground/60" />
          </span>
          <div>
            <p className="font-semibold text-foreground">{rewardTitle}</p>
            <p className="text-sm text-foreground/50">{rewardSubtitle}</p>
            <p className="text-xs text-foreground/40 mt-0.5">{stampsRequired} stamps</p>
          </div>
        </div>
      </div>

      {photos.length > 0 && (
        <div className="rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6 mb-6">
          <p className="font-display font-bold text-foreground mb-4">Gallery</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {photos.map((p) => (
              <div key={p.id} className="rounded-xl overflow-hidden aspect-square">
                <img src={p.url} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {business.opening_hours && Object.keys(business.opening_hours).length > 0 && (
        <div className="rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6 mb-6">
          <p className="flex items-center gap-2 font-display font-bold text-foreground mb-4">
            <Clock className="h-5 w-5 text-primary" /> Opening hours
          </p>
          <div className="flex flex-col divide-y divide-black/5">
            {DAY_ORDER.map(({ key, label }) => {
              const day = business.opening_hours?.[key]
              const isToday = key === TODAY_KEY
              return (
                <div
                  key={key}
                  className={
                    'flex items-center justify-between py-2 text-sm ' +
                    (isToday ? 'font-bold text-foreground' : 'text-foreground/60')
                  }
                >
                  <span>
                    {label} {isToday && <span className="text-primary">· Today</span>}
                  </span>
                  <span>{!day || day.closed ? 'Closed' : `${formatTime(day.open)} – ${formatTime(day.close)}`}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <ReviewsSection businessId={business.id} userId={session.user.id} canReview={Boolean(membership)} />

      {business.lat != null && business.lng != null && (
        <div className="mb-6">
          <ShopMap lat={business.lat} lng={business.lng} color={business.brand_color} height={200} />
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-4">
        {business.address ? (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              [business.address, business.postcode].filter(Boolean).join(', ')
            )}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] px-5 h-12 flex items-center gap-2 font-semibold text-foreground hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-shadow duration-150 ease-out"
          >
            <MapPin className="h-4 w-4 text-primary" /> {business.address}
            {business.postcode ? `, ${business.postcode}` : ''}
            <Navigation className="h-3.5 w-3.5 text-foreground/40 ml-1" />
          </a>
        ) : (
          <div />
        )}
        <button data-press-feedback className="rounded-full border border-black/15 px-5 h-10 font-semibold text-foreground flex items-center gap-2">
          <Share2 className="h-4 w-4" /> Share
        </button>
      </div>
    </DashboardLayout>
  )
}
