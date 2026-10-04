import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { History, Award } from 'lucide-react'
import { SkeletonBlock } from '@/components/page-skeleton'
import { fetchActivity, type ActivityItem } from '@/lib/engagement'

const labels: Record<ActivityItem['type'], string> = { stamp: 'Stamp collected', points_earn: 'Points earned', points_spend: 'Points spent', redeem: 'Reward redeemed', spend: 'Purchase' }

/** Activity now lives on the profile page; the old route forwards there. */
export function ActivityPage() {
  return <Navigate to="/dashboard/profile#activity" replace />
}

/** Achievements and purchase history, shown in the profile page's Activity section. */
export function ActivityFeed({ userId }: { userId: string }) {
  const [items, setItems] = React.useState<ActivityItem[]>([])
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => { fetchActivity(userId).then(setItems).finally(() => setReady(true)) }, [userId])

  const badges = [
    { name: 'First visit', done: items.some((x) => x.type === 'stamp' || x.type === 'spend') },
    { name: 'Regular', done: items.filter((x) => (x.type === 'stamp' || x.type === 'spend') && !x.voided_at).length >= 5 },
    { name: 'Reward hunter', done: items.some((x) => x.type === 'redeem') },
  ]

  return (
    <section id="activity" aria-labelledby="activity-title" className="scroll-mt-24 rounded-2xl bg-card p-6 ring-1 ring-foreground/8 sm:p-7">
      <h2 id="activity-title" className="font-display text-xl font-semibold tracking-tight text-foreground">Activity & achievements</h2>
      <p className="mt-1 text-sm text-muted-foreground">Every purchase and reward in one place.</p>

      {!ready ? (
        <div role="status" aria-label="Loading activity" className="mt-5 space-y-3"><SkeletonBlock className="h-11 w-2/3" /><SkeletonBlock className="h-16" /><SkeletonBlock className="h-16" /></div>
      ) : (
        <>
          <div aria-label="Achievements" className="mt-5 flex flex-wrap gap-3">
            {badges.map((b) => (
              <div key={b.name} className={'flex items-center gap-3 rounded-full py-2 pl-2 pr-5 ' + (b.done ? 'bg-amber text-amber-ink' : 'bg-secondary text-muted-foreground')}>
                <span className={'grid h-9 w-9 place-items-center rounded-full ' + (b.done ? 'bg-card text-primary' : 'bg-card')}><Award className="h-5 w-5" /></span>
                <span><span className="block font-semibold leading-tight">{b.name}</span><span className="block text-xs opacity-80">{b.done ? 'Unlocked' : 'Keep going to unlock'}</span></span>
              </div>
            ))}
          </div>

          <div className="mt-5 divide-y divide-border border-t border-border">
            {items.length ? items.map((x) => (
              <div key={x.id} className="flex gap-4 py-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ backgroundColor: x.business?.brand_color ?? '#E8703B' }}><History className="h-4 w-4" /></div>
                <div className="flex-1">
                  <p className="font-semibold">{labels[x.type]}{x.type === 'spend' ? ` £${(x.value / 100).toFixed(2)}${x.voided_at ? ' (undone)' : ''}` : x.value > 1 ? ` ×${x.value}` : ''}</p>
                  <p className="text-sm text-muted-foreground">{x.business?.name ?? 'Local shop'} · {new Date(x.created_at).toLocaleString()}</p>
                </div>
              </div>
            )) : <p className="py-8 text-center text-muted-foreground">Your activity will appear after your first visit.</p>}
          </div>
        </>
      )}
    </section>
  )
}
