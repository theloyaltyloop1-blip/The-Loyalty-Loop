import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { History, Award } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { DashboardLayout } from '@/components/dashboard-layout'
import { fetchActivity, type ActivityItem } from '@/lib/engagement'

const labels: Record<ActivityItem['type'], string> = { stamp: 'Stamp collected', points_earn: 'Points earned', points_spend: 'Points spent', redeem: 'Reward redeemed' }
export function ActivityPage() {
  const { session, loading } = useAuth(); const [items, setItems] = React.useState<ActivityItem[]>([]); const [ready, setReady] = React.useState(false)
  React.useEffect(() => { if (session?.user) fetchActivity(session.user.id).then(setItems).finally(() => setReady(true)) }, [session?.user])
  if (loading || !ready) return null; if (!session) return <Navigate to="/login" replace />
  return <DashboardLayout><p className="text-xs font-extrabold uppercase tracking-wide text-foreground/40 mb-1">Your loyalty</p><h1 className="text-3xl font-display font-extrabold">Activity & achievements</h1><p className="text-foreground/55 mt-2 mb-7">Every stamp, point and reward in one place.</p>
    <section className="grid gap-4 sm:grid-cols-3 mb-8">{[{ name: 'First visit', done: items.some(x=>x.type==='stamp') }, { name: 'Regular', done: items.filter(x=>x.type==='stamp').length>=5 }, { name: 'Reward hunter', done: items.some(x=>x.type==='redeem') }].map(b => <div key={b.name} className={'rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,.08)] ' + (b.done ? 'bg-[#FFF0C2]' : 'bg-card opacity-65')}><Award className={'h-6 w-6 mb-2 ' + (b.done?'text-primary':'text-black/30')}/><p className="font-display font-bold">{b.name}</p><p className="text-xs text-black/50">{b.done ? 'Unlocked' : 'Keep going to unlock'}</p></div>)}</section>
    <section className="rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,.08)] divide-y divide-black/5">{items.length ? items.map(x => <div key={x.id} className="p-5 flex gap-4"><div className="h-10 w-10 rounded-xl grid place-items-center text-white" style={{backgroundColor:x.business?.brand_color ?? '#E8703B'}}><History className="h-4 w-4"/></div><div className="flex-1"><p className="font-bold">{labels[x.type]}{x.value > 1 ? ` ×${x.value}` : ''}</p><p className="text-sm text-black/50">{x.business?.name ?? 'Local shop'} · {new Date(x.created_at).toLocaleString()}</p></div></div>) : <div className="p-10 text-center text-black/50">Your activity will appear after your first visit.</div>}</section>
  </DashboardLayout>
}
