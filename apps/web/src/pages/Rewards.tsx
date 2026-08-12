import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Gift, Ticket } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { DashboardLayout } from '@/components/dashboard-layout'
import { fetchMyRewards, type CustomerReward } from '@/lib/businesses'

function RewardCard({ reward }: { reward: CustomerReward }) {
  const redeemed = Boolean(reward.redeemed_at)
  const expired = Boolean(reward.expires_at && new Date(reward.expires_at) < new Date())
  const unavailable = redeemed || expired

  return (
    <article className={'rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden ' + (unavailable ? 'opacity-65' : '')}>
      <div className="p-6 flex gap-5 items-start">
        <div className="h-14 w-14 rounded-2xl flex shrink-0 items-center justify-center text-white" style={{ backgroundColor: reward.business?.brand_color ?? '#E8703B' }}>
          {reward.business?.logo_url ? <img src={reward.business.logo_url} alt="" className="h-full w-full rounded-2xl object-cover" /> : <Gift className="h-6 w-6" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-wide text-foreground/45">{reward.business?.name ?? 'Local shop'}</p>
          <h2 className="font-display text-xl font-extrabold text-foreground mt-1">{reward.title}</h2>
          {redeemed ? <p className="mt-2 text-sm font-semibold text-foreground/55">Redeemed {new Date(reward.redeemed_at!).toLocaleDateString()}</p> : expired ? <p className="mt-2 text-sm font-semibold text-red-600">This reward has expired</p> : <p className="mt-2 text-sm text-foreground/55">Show this code to the shop when you’re ready to redeem.</p>}
        </div>
      </div>
      {!unavailable && (
        <div className="border-t border-black/8 p-5 flex items-center gap-4 bg-white/30">
          <div className="rounded-xl bg-white p-2 shrink-0"><QRCodeSVG value={reward.qr_token} size={72} /></div>
          <div>
            <p className="text-xs font-bold text-foreground/45 uppercase tracking-wide">Reward code</p>
            <p className="font-display text-2xl font-extrabold tracking-wider text-foreground">{reward.short_code}</p>
          </div>
        </div>
      )}
    </article>
  )
}

export function RewardsPage() {
  const { session, loading } = useAuth()
  const [rewards, setRewards] = React.useState<CustomerReward[]>([])
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    if (!session?.user) return
    fetchMyRewards(session.user.id).then(setRewards).finally(() => setReady(true))
  }, [session?.user])

  if (loading || !ready) return null
  if (!session) return <Navigate to="/login" replace />

  const available = rewards.filter((reward) => !reward.redeemed_at && (!reward.expires_at || new Date(reward.expires_at) >= new Date()))
  const past = rewards.filter((reward) => !available.includes(reward))

  return (
    <DashboardLayout>
      <p className="text-xs font-extrabold uppercase tracking-wide text-foreground/40 mb-1">Your loyalty</p>
      <h1 className="text-3xl font-display font-extrabold text-foreground">Rewards</h1>
      <p className="text-foreground/55 mt-2 mb-7">Your earned rewards are ready to use here.</p>
      {available.length === 0 ? (
        <div className="rounded-2xl bg-card p-10 text-center shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <Ticket className="h-9 w-9 mx-auto text-primary mb-3" />
          <h2 className="font-display text-xl font-bold text-foreground">No rewards yet</h2>
          <p className="text-sm text-foreground/55 mt-2">Keep collecting stamps or points at your favourite shops — your reward will appear here automatically.</p>
        </div>
      ) : <div className="grid gap-5 md:grid-cols-2">{available.map((reward, index) => <div key={reward.id} className="stagger-card" style={{ animationDelay: `${Math.min(index, 5) * 45}ms` }}><RewardCard reward={reward} /></div>)}</div>}
      {past.length > 0 && <><h2 className="font-display text-xl font-bold text-foreground mt-10 mb-4">Past rewards</h2><div className="grid gap-4 md:grid-cols-2">{past.map((reward, index) => <div key={reward.id} className="stagger-card" style={{ animationDelay: `${Math.min(index, 5) * 45}ms` }}><RewardCard reward={reward} /></div>)}</div></>}
    </DashboardLayout>
  )
}
