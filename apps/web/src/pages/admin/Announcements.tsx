import * as React from 'react'
import { listAnnouncements, publishAnnouncement, setAnnouncementActive } from '@/lib/admin'
import { Badge, Status, btnGhost, btnPrimary, fmtDate, inputCls, useAction, useLoad } from './kit'

export function Announcements() {
  const { data, error, loading, reload } = useLoad(listAnnouncements, [])
  const [title, setTitle] = React.useState('')
  const [body, setBody] = React.useState('')
  const { act, banner } = useAction()
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl bg-white/6 p-6">
        <h2 className="font-display text-lg font-bold">New announcement</h2>
        <p className="mt-1 text-xs text-white/45">Delivered to every customer inbox on publish.</p>
        <input className={`${inputCls} mt-3 w-full`} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 p-3 text-sm" rows={4} placeholder="Message" value={body} onChange={(e) => setBody(e.target.value)} />
        <button className={`${btnPrimary} mt-3`} disabled={!title.trim() || !body.trim()}
          onClick={() => confirm('Send to ALL customers?') && act(() => publishAnnouncement(title.trim(), body.trim()), 'Published', () => { setTitle(''); setBody(''); reload() })}>Publish</button>
      </section>
      <section>
        {banner}
        <Status loading={loading} error={error} />
        <div className="grid gap-3">
          {data?.map((a) => (
            <article key={a.id} className="rounded-2xl bg-white/6 p-4">
              <div className="flex items-center gap-2"><p className="font-bold">{a.title}</p><Badge tone={a.is_active ? 'ok' : 'muted'}>{a.is_active ? 'active' : 'archived'}</Badge></div>
              <p className="mt-1 text-sm text-white/60">{a.body}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-white/40">
                <span>{fmtDate(a.created_at)}</span>
                <button className={btnGhost} onClick={() => act(() => setAnnouncementActive(a.id, !a.is_active), a.is_active ? 'Archived' : 'Restored', reload)}>{a.is_active ? 'Archive' : 'Restore'}</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
