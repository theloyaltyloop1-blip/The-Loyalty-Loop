import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { Megaphone, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { OwnerLayout } from '@/components/owner-layout'
import { BarePageSkeleton } from '@/components/page-skeleton'
import { useOwner } from '@/lib/owner-context'
import { createAnnouncement, deleteAnnouncement, fetchOwnedAnnouncements, updateAnnouncement, type Announcement } from '@/lib/businesses'

const inputClass = 'w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary'
const errorText = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message
  return fallback
}

export function OwnerAnnouncements() {
  const { session, loading: authLoading } = useAuth()
  const { business, loading: ownerLoading } = useOwner()
  const [items, setItems] = React.useState<Announcement[]>([])
  const [title, setTitle] = React.useState('')
  const [body, setBody] = React.useState('')
  const [publishing, setPublishing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const reload = React.useCallback(() => {
    if (!business) return
    fetchOwnedAnnouncements(business.id).then(setItems).catch((err) => setError(errorText(err, 'Could not load announcements.')))
  }, [business])
  React.useEffect(() => { reload() }, [reload])

  if (authLoading || ownerLoading) return <BarePageSkeleton />
  if (!session) return <Navigate to="/login" replace />

  async function publish(e: React.FormEvent) {
    e.preventDefault()
    if (!business || !title.trim()) return
    setPublishing(true); setError(null)
    try {
      await createAnnouncement(business.id, { title: title.trim(), body: body.trim() || null, is_active: true })
      setTitle(''); setBody(''); reload()
    } catch (err) { setError(errorText(err, 'Could not publish announcement.')) } finally { setPublishing(false) }
  }

  return <OwnerLayout>
    
    <h1 className="text-3xl font-display font-bold tracking-tight text-foreground sm:text-4xl">Announcements</h1>
    <p className="text-muted-foreground mt-2 mb-7">Share menu launches, events and updates with customers on the News page.</p>
    {!business ? <div className="rounded-3xl bg-sage px-6 py-10 text-center text-sage-ink">Set up your shop before publishing announcements.</div> : <>
      <form onSubmit={publish} className="rounded-2xl bg-card p-6 ring-1 ring-foreground/8 mb-7">
        <div className="flex items-center gap-2 mb-5"><div className="h-9 w-9 rounded-xl flex items-center justify-center text-white" style={{backgroundColor: business.brand_color}}><Megaphone className="h-4 w-4" /></div><h2 className="font-display text-xl font-semibold tracking-tight">Create an update</h2></div>
        <input className={inputClass + ' mb-3'} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Our summer menu is here" required />
        <textarea className={inputClass + ' min-h-28'} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="Tell customers what’s new…" />
        {error && <p className="mt-3 text-sm font-semibold text-destructive">{error}</p>}
        <button data-press-feedback disabled={publishing} className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary hover:bg-primary-hover transition-colors text-primary-foreground px-5 py-3 font-semibold disabled:opacity-60"><Plus className="h-4 w-4" />{publishing ? 'Publishing…' : 'Publish update'}</button>
      </form>
      <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-4">Your updates</h2>
      <div className="grid gap-4">{items.length === 0 ? <p className="text-muted-foreground">No announcements yet.</p> : items.map((item) => <AnnouncementRow key={item.id} item={item} onChange={reload} />)}</div>
    </>}
  </OwnerLayout>
}

function AnnouncementRow({ item, onChange }: { item: Announcement; onChange: () => void }) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  async function change(values: Parameters<typeof updateAnnouncement>[1]) { setBusy(true); setError(null); try { await updateAnnouncement(item.id, values); onChange() } catch (err) { setError(errorText(err, 'Could not save.')) } finally { setBusy(false) } }
  async function remove() { if (!window.confirm('Delete this announcement?')) return; setBusy(true); try { await deleteAnnouncement(item.id); onChange() } catch (err) { setError(errorText(err, 'Could not delete.')) } finally { setBusy(false) } }
  return <article className="rounded-2xl bg-card p-5 ring-1 ring-foreground/8"><div className="flex justify-between gap-4"><div><p className="font-display font-semibold text-lg tracking-tight text-foreground">{item.title}</p>{item.body && <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{item.body}</p>}<p className="mt-3 text-xs text-muted-foreground">Published {new Date(item.created_at).toLocaleDateString()}</p></div><span className={'h-fit shrink-0 rounded-full px-3 py-1 text-xs font-bold ' + (item.is_active ? 'bg-sage text-sage-ink' : 'bg-secondary text-muted-foreground')}>{item.is_active ? 'Live' : 'Hidden'}</span></div>{error && <p className="mt-3 text-sm text-destructive">{error}</p>}<div className="flex gap-2 mt-4"><button data-press-feedback onClick={() => change({is_active: !item.is_active})} disabled={busy} className="rounded-xl border border-border px-4 py-2 text-sm font-bold">{item.is_active ? 'Hide' : 'Publish'}</button><button data-press-feedback onClick={remove} disabled={busy} className="rounded-xl border border-destructive/30 text-destructive px-3 py-2"><Trash2 className="h-4 w-4" /></button></div></article>
}
