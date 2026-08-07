import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { Megaphone, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { OwnerLayout } from '@/components/owner-layout'
import { useOwner } from '@/lib/owner-context'
import { createAnnouncement, deleteAnnouncement, fetchOwnedAnnouncements, updateAnnouncement, type Announcement } from '@/lib/businesses'

const inputClass = 'w-full rounded-xl border border-black/10 bg-white/70 px-4 py-3 text-[#1a1a1a] outline-none focus:border-[#E8703B]'
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

  if (authLoading || ownerLoading) return null
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
    <p className="text-xs font-extrabold uppercase tracking-wide text-[#1a1a1a]/40 mb-1">Customer news</p>
    <h1 className="text-3xl font-display font-extrabold text-[#1a1a1a]">Announcements</h1>
    <p className="text-[#1a1a1a]/55 mt-2 mb-7">Share menu launches, events and updates with customers on the News page.</p>
    {!business ? <div className="rounded-2xl bg-[#FBF6EC] p-8 text-center text-[#1a1a1a]/55">Set up your shop before publishing announcements.</div> : <>
      <form onSubmit={publish} className="rounded-2xl bg-[#FBF6EC] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] mb-7">
        <div className="flex items-center gap-2 mb-5"><div className="h-9 w-9 rounded-xl flex items-center justify-center text-white" style={{backgroundColor: business.brand_color}}><Megaphone className="h-4 w-4" /></div><h2 className="font-display text-xl font-bold">Create an update</h2></div>
        <input className={inputClass + ' mb-3'} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Our summer menu is here" required />
        <textarea className={inputClass + ' min-h-28'} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="Tell customers what’s new…" />
        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
        <button disabled={publishing} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#E8703B] text-white px-5 py-3 font-bold disabled:opacity-60"><Plus className="h-4 w-4" />{publishing ? 'Publishing…' : 'Publish update'}</button>
      </form>
      <h2 className="font-display text-xl font-bold text-[#1a1a1a] mb-4">Your updates</h2>
      <div className="grid gap-4">{items.length === 0 ? <p className="text-[#1a1a1a]/55">No announcements yet.</p> : items.map((item) => <AnnouncementRow key={item.id} item={item} onChange={reload} />)}</div>
    </>}
  </OwnerLayout>
}

function AnnouncementRow({ item, onChange }: { item: Announcement; onChange: () => void }) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  async function change(values: Parameters<typeof updateAnnouncement>[1]) { setBusy(true); setError(null); try { await updateAnnouncement(item.id, values); onChange() } catch (err) { setError(errorText(err, 'Could not save.')) } finally { setBusy(false) } }
  async function remove() { if (!window.confirm('Delete this announcement?')) return; setBusy(true); try { await deleteAnnouncement(item.id); onChange() } catch (err) { setError(errorText(err, 'Could not delete.')) } finally { setBusy(false) } }
  return <article className="rounded-2xl bg-[#FBF6EC] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"><div className="flex justify-between gap-4"><div><p className="font-display font-bold text-lg text-[#1a1a1a]">{item.title}</p>{item.body && <p className="mt-1 text-sm text-[#1a1a1a]/65 whitespace-pre-wrap">{item.body}</p>}<p className="mt-3 text-xs text-[#1a1a1a]/40">Published {new Date(item.created_at).toLocaleDateString()}</p></div><span className={'h-fit shrink-0 rounded-full px-3 py-1 text-xs font-bold ' + (item.is_active ? 'bg-[#DCF1DD] text-[#24722B]' : 'bg-black/8 text-[#1a1a1a]/55')}>{item.is_active ? 'Live' : 'Hidden'}</span></div>{error && <p className="mt-3 text-sm text-red-600">{error}</p>}<div className="flex gap-2 mt-4"><button onClick={() => change({is_active: !item.is_active})} disabled={busy} className="rounded-xl border border-black/10 px-4 py-2 text-sm font-bold">{item.is_active ? 'Hide' : 'Publish'}</button><button onClick={remove} disabled={busy} className="rounded-xl border border-red-200 text-red-600 px-3 py-2"><Trash2 className="h-4 w-4" /></button></div></article>
}
