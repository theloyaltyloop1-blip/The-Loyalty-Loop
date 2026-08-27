import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { Megaphone } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { DashboardLayout } from '@/components/dashboard-layout'
import { PageSkeleton } from '@/components/page-skeleton'
import { fetchAnnouncements, type Announcement } from '@/lib/businesses'

export function NewsPage() {
  const { session, loading } = useAuth()
  const [items, setItems] = React.useState<Announcement[]>([])
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => { if (session) fetchAnnouncements().then(setItems).finally(() => setReady(true)) }, [session])
  if (loading || !ready) return <PageSkeleton />
  if (!session) return <Navigate to="/login" replace />
  return <DashboardLayout>
    <p className="text-xs font-extrabold uppercase tracking-wide text-foreground/40 mb-1">From local shops</p>
    <h1 className="text-3xl font-display font-extrabold text-foreground">News</h1>
    <p className="text-foreground/55 mt-2 mb-7">Fresh updates, menus and good things happening nearby.</p>
    {items.length === 0 ? <div className="rounded-2xl bg-card p-10 text-center shadow-[0_1px_3px_rgba(0,0,0,0.08)]"><Megaphone className="h-9 w-9 mx-auto text-primary mb-3" /><h2 className="font-display text-xl font-bold">Nothing new yet</h2><p className="mt-2 text-sm text-foreground/55">Shop updates will appear here when they’re published.</p></div> : <div className="grid gap-5">{items.map((item) => <article key={item.id} className="rounded-2xl bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"><div className="flex gap-3 items-center mb-4"><div className="h-10 w-10 rounded-xl overflow-hidden flex items-center justify-center text-white font-display font-bold" style={{backgroundColor:item.business?.brand_color ?? '#E8703B'}}>{item.business?.logo_url ? <img src={item.business.logo_url} alt="" className="h-full w-full object-cover" /> : item.business?.name?.[0]}</div><div><p className="font-bold text-foreground">{item.business?.name ?? 'The Loyalty Loop'}</p><p className="text-xs text-foreground/45">{new Date(item.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}</p></div></div><h2 className="font-display text-xl font-extrabold text-foreground">{item.title}</h2>{item.body && <p className="mt-2 text-foreground/70 whitespace-pre-wrap">{item.body}</p>}</article>)}</div>}
  </DashboardLayout>
}
