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
  React.useEffect(() => { if (session) fetchAnnouncements(session.user.id).then(setItems).finally(() => setReady(true)) }, [session])
  if (loading || !ready) return <PageSkeleton />
  if (!session) return <Navigate to="/login" replace />
  return <DashboardLayout>
    <h1 className="text-3xl font-display font-bold tracking-tight text-foreground sm:text-4xl">News</h1>
    <p className="text-muted-foreground mt-2 mb-8">Fresh updates, menus and good things happening nearby.</p>
    {items.length === 0 ? <div className="rounded-3xl bg-sage px-6 py-12 text-center text-sage-ink"><span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-card"><Megaphone className="h-7 w-7 text-primary" /></span><h2 className="font-display text-2xl font-semibold tracking-tight">Nothing new yet</h2><p className="mt-2 text-sage-ink/80">Shop updates will appear here when they’re published.</p></div> : <div className="grid max-w-3xl gap-5">{items.map((item) => <article key={item.id} className="rounded-2xl bg-card p-6 ring-1 ring-foreground/8 sm:p-7"><div className="flex gap-3 items-center mb-4"><div className="h-10 w-10 rounded-xl overflow-hidden flex items-center justify-center text-white font-display font-bold" style={{backgroundColor:item.business?.brand_color ?? '#E8703B'}}>{item.business?.logo_url ? <img src={item.business.logo_url} alt="" className="h-full w-full object-cover" /> : item.business?.name?.[0]}</div><div><p className="font-semibold text-foreground">{item.business?.name ?? 'The Loyalty Loop'}</p><p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}</p></div></div><h2 className="font-display text-xl font-semibold tracking-tight text-foreground">{item.title}</h2>{item.body && <p className="mt-2 max-w-[65ch] leading-relaxed text-muted-foreground whitespace-pre-wrap">{item.body}</p>}</article>)}</div>}
  </DashboardLayout>
}
