import * as React from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowLeft, Heart, Gift, Lock, MapPin, Share2, Star, Scissors, Coffee, Zap } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { DashboardLayout } from '@/components/dashboard-layout'
import {
  fetchBusinessBySlug,
  fetchMembership,
  fetchRewardCatalog,
  joinBusiness,
  simulateStamp,
  type Business,
  type Membership,
  type RewardCatalogItem,
} from '@/lib/businesses'

const STAMP_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Café: Coffee,
  Restaurant: Coffee,
  Barber: Scissors,
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
  const [stampCode, setStampCode] = React.useState<string | null>(null)
  const [favourite, setFavourite] = React.useState(false)
  const [optedIn, setOptedIn] = React.useState(true)
  const [ready, setReady] = React.useState(false)
  const [joining, setJoining] = React.useState(false)
  const [stamping, setStamping] = React.useState(false)

  const refetch = React.useCallback(async () => {
    if (!slug || !session?.user) return
    const biz = await fetchBusinessBySlug(slug)
    if (!biz) {
      setReady(true)
      return
    }
    const [m, cat] = await Promise.all([fetchMembership(session.user.id, biz.id), fetchRewardCatalog(biz.id)])
    setBusiness(biz)
    setMembership(m)
    setCatalog(cat)
    setOptedIn(m ? !m.promos_opted_out : true)
    setReady(true)
  }, [slug, session?.user])

  React.useEffect(() => {
    refetch()
  }, [refetch])

  React.useEffect(() => {
    if (!session?.user) return
    supabase
      .from('profiles')
      .select('stamp_code')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setStampCode(data?.stamp_code ?? null))
  }, [session?.user])

  if (loading || !ready) return null
  if (!session) return <Navigate to="/login" replace />
  if (!business) return <Navigate to="/dashboard" replace />

  const StampIcon = STAMP_ICON[business.category ?? ''] ?? Star
  const isOwner = session.user.id === business.owner_id
  const stampsRequired = catalog[0]?.stamp_threshold ?? business.loyalty_config?.stamps_required ?? 10
  const rewardTitle = catalog[0]?.title ?? 'Free reward'
  const rewardSubtitle = catalog[0]?.description ?? ''

  async function handleJoin() {
    if (!session?.user || !business) return
    setJoining(true)
    try {
      await joinBusiness(session.user.id, business.id)
      await refetch()
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
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm font-semibold text-[#1a1a1a]/60 hover:text-[#1a1a1a] mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div
        className="relative rounded-3xl p-8 mb-6 text-white"
        style={{ background: `linear-gradient(135deg, ${business.brand_color}, ${darken(business.brand_color, 40)})` }}
      >
        <button
          onClick={() => setFavourite((f) => !f)}
          className={
            'absolute top-6 right-6 h-11 w-11 rounded-full flex items-center justify-center transition-colors ' +
            (favourite ? 'bg-[#F6AF23] text-white' : 'bg-white/90 text-[#1a1a1a]')
          }
        >
          <Heart className="h-5 w-5" fill={favourite ? 'currentColor' : 'none'} />
        </button>

        <div
          className="h-16 w-16 rounded-2xl bg-white flex items-center justify-center font-display font-extrabold text-2xl mb-5"
          style={{ color: business.brand_color }}
        >
          {business.name.charAt(0).toUpperCase()}
        </div>

        <h1 className="text-4xl font-display font-extrabold mb-1">{business.name}</h1>
        <p className="text-white/80 mb-2">{business.category}</p>
        <p className="text-white/70 max-w-md">{business.description}</p>
      </div>

      {!membership ? (
        <div className="rounded-2xl bg-[#FBF6EC] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-10 text-center mb-6">
          <h2 className="text-2xl font-display font-bold text-[#1a1a1a] mb-4">
            Join {business.name}'s loyalty card
          </h2>
          <span className="inline-block rounded-full bg-black/5 text-[#1a1a1a]/70 text-xs font-semibold px-3 py-1 mb-3">
            Your reward
          </span>
          <p className="text-xl font-display font-bold text-[#1a1a1a]">{rewardTitle}</p>
          <p className="text-sm text-[#1a1a1a]/50 mb-1">{rewardSubtitle}</p>
          <p className="text-sm text-[#1a1a1a]/50 mb-6">Collect {stampsRequired} stamps to unlock it.</p>
          <button
            onClick={handleJoin}
            disabled={joining}
            className="rounded-full px-8 h-12 font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: business.brand_color }}
          >
            {joining ? 'Joining…' : 'Join card'}
          </button>
        </div>
      ) : (
        <div className="rounded-2xl bg-[#FBF6EC] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-8 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-display font-bold text-[#1a1a1a]">Your stamp card</h2>
            <p className="text-sm font-semibold text-[#1a1a1a]/60">
              {membership.stamp_count} / {stampsRequired} · {rewardTitle}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 mb-8">
            {Array.from({ length: stampsRequired }).map((_, i) => {
              const isLast = i === stampsRequired - 1
              const filled = i < membership.stamp_count
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
                      className="text-[9px] font-extrabold uppercase tracking-wide"
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
                  className="h-16 w-16 rounded-full border flex items-center justify-center"
                  style={
                    filled
                      ? { backgroundColor: business.brand_color, borderColor: business.brand_color }
                      : { borderColor: 'rgba(0,0,0,0.12)' }
                  }
                >
                  <StampIcon className={'h-5 w-5 ' + (filled ? 'text-white' : 'text-[#1a1a1a]/20')} />
                </div>
              )
            })}
          </div>

          <div className="flex flex-col sm:flex-row items-start gap-6">
            <QRCodeSVG value={`loyaltyloop:customer:${session.user.id}`} size={110} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#1a1a1a]/40 mb-1">Manual code</p>
              <p className="font-mono font-bold text-lg tracking-widest text-[#1a1a1a] mb-3">
                {stampCode ?? '—'}
              </p>
              <p className="font-semibold text-[#1a1a1a] mb-1">Show this to staff</p>
              <p className="text-sm text-[#1a1a1a]/50 max-w-sm">
                They scan the code to add a stamp, or type the manual code above. {stampsRequired} stamps
                to your next reward.
              </p>
            </div>
          </div>

          {isOwner && (
            <div className="border-t border-black/10 mt-6 pt-5">
              <button
                onClick={handleSimulateStamp}
                disabled={stamping}
                className="flex items-center gap-2 rounded-full border border-dashed border-[#1a1a1a]/30 px-5 h-10 font-semibold text-sm text-[#1a1a1a]/70 disabled:opacity-50"
              >
                <Zap className="h-4 w-4" /> {stamping ? 'Adding…' : 'Simulate stamp (owner testing)'}
              </button>
            </div>
          )}

          <div className="border-t border-black/10 mt-6 pt-5 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-semibold text-[#1a1a1a]">Promotions from {business.name}</p>
              <p className="text-sm text-[#1a1a1a]/50">
                {optedIn
                  ? "You'll get occasional offers and re-engagement messages."
                  : "You won't receive promo notifications from this shop."}
              </p>
            </div>
            <button
              onClick={handleToggleOptIn}
              className="rounded-full border border-black/15 px-5 h-10 font-semibold text-[#1a1a1a] shrink-0"
            >
              {optedIn ? 'Opt out' : 'Opt in'}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-[#FBF6EC] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6 mb-6">
        <p className="flex items-center gap-2 font-display font-bold text-[#1a1a1a] mb-4">
          <Gift className="h-5 w-5 text-[#E8703B]" /> What you can earn
        </p>
        <div className="rounded-xl bg-black/5 flex items-center gap-4 p-4">
          <span className="h-10 w-10 rounded-full bg-[#EFE1C8] flex items-center justify-center shrink-0">
            <Lock className="h-4 w-4 text-[#1a1a1a]/60" />
          </span>
          <div>
            <p className="font-semibold text-[#1a1a1a]">{rewardTitle}</p>
            <p className="text-sm text-[#1a1a1a]/50">{rewardSubtitle}</p>
            <p className="text-xs text-[#1a1a1a]/40 mt-0.5">{stampsRequired} stamps</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="rounded-full bg-[#FBF6EC] shadow-[0_1px_3px_rgba(0,0,0,0.08)] px-5 h-12 flex items-center gap-2 font-semibold text-[#1a1a1a]">
          <MapPin className="h-4 w-4 text-[#E8703B]" /> {business.address}
          {business.postcode ? `, ${business.postcode}` : ''}
        </div>
        <button className="rounded-full border border-black/15 px-5 h-10 font-semibold text-[#1a1a1a] flex items-center gap-2">
          <Share2 className="h-4 w-4" /> Share
        </button>
      </div>
    </DashboardLayout>
  )
}
