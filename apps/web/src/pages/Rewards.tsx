import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Gift, Ticket } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { DashboardLayout } from '@/components/dashboard-layout'
import { PageSkeleton } from '@/components/page-skeleton'
import { fetchMyRewards, type CustomerReward } from '@/lib/businesses'

function RewardCard({ reward }: { reward: CustomerReward }) {
  const redeemed = Boolean(reward.redeemed_at)
  const expired = Boolean(reward.expires_at && new Date(reward.expires_at) < new Date())
  const unavailable = redeemed || expired

  return (
    <article className={'rounded-2xl bg-card ring-1 ring-foreground/8 overflow-hidden ' + (unavailable ? 'opacity-65' : '')}>
      <div className="p-6 flex gap-5 items-start">
        <div className="h-14 w-14 rounded-xl flex shrink-0 items-center justify-center text-white" style={{ backgroundColor: reward.business?.brand_color ?? '#E8703B' }}>
          {reward.business?.logo_url ? <img src={reward.business.logo_url} alt="" className="h-full w-full rounded-xl object-cover" /> : <Gift className="h-6 w-6" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{reward.business?.name ?? 'Local shop'}</p>
          <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mt-0.5">{reward.title}</h2>
          {redeemed ? <p className="mt-2 text-sm font-semibold text-muted-foreground">Redeemed {new Date(reward.redeemed_at!).toLocaleDateString()}</p> : expired ? <p className="mt-2 text-sm font-semibold text-destructive">This reward has expired</p> : <p className="mt-2 text-sm text-muted-foreground">Show this code to the shop when you’re ready to redeem.</p>}
        </div>
      </div>
      {!unavailable && (
        <div className="border-t-2 border-dashed border-amber-ink/15 bg-amber p-5 flex items-center gap-4 text-amber-ink">
          <div className="rounded-xl bg-white p-2 shrink-0"><QRCodeSVG value={reward.qr_token} size={76} /></div>
          <div>
            <p className="text-sm text-amber-ink/75">Reward code</p>
            <p className="font-display text-3xl font-bold tracking-wider tabular-nums">{reward.short_code}</p>
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

  if (loading || !ready) return <PageSkeleton />
  if (!session) return <Navigate to="/login" replace />

  const available = rewards.filter((reward) => !reward.redeemed_at && (!reward.expires_at || new Date(reward.expires_at) >= new Date()))
  const past = rewards.filter((reward) => !available.includes(reward))

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-display font-bold tracking-tight text-foreground sm:text-4xl">Rewards</h1>
      <p className="text-muted-foreground mt-2 mb-8">Your earned rewards are ready to use here.</p>
      {available.length === 0 ? (
        <div className="rounded-3xl bg-sage px-6 py-12 text-center text-sage-ink">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-card"><Ticket className="h-7 w-7 text-primary" /></span>
          <h2 className="font-display text-2xl font-semibold tracking-tight">No rewards yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sage-ink/80">Keep shopping at your favourite shops. Your reward will appear here automatically.</p>
        </div>
      ) : <div className="grid gap-5 md:grid-cols-2">{available.map((reward, index) => <div key={reward.id} className="stagger-card" style={{ animationDelay: `${Math.min(index, 5) * 45}ms` }}><RewardCard reward={reward} /></div>)}</div>}
      {past.length > 0 && <><h2 className="font-display text-xl font-semibold tracking-tight text-foreground mt-12 mb-4">Past rewards</h2><div className="grid gap-4 md:grid-cols-2">{past.map((reward, index) => <div key={reward.id} className="stagger-card" style={{ animationDelay: `${Math.min(index, 5) * 45}ms` }}><RewardCard reward={reward} /></div>)}</div></>}
    </DashboardLayout>
  )
}
