import * as React from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Badge, btnDanger, btnGhost, btnPrimary, fmtDate } from '@/pages/admin/kit'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// "What's new" emails after a big release. Claude drafts them into
// release_announcements; you check the words, send yourself a test, then send.
type Announcement = {
  id: string
  audience: 'owners' | 'shoppers'
  subject: string
  body: string
  status: 'draft' | 'sending' | 'sent' | 'cancelled'
  release_note: string | null
  created_at: string
  updated_at: string
  sent_at: string | null
  recipient_count: number | null
  sent_count: number
  failed_count: number
}

const AUDIENCE = { owners: 'Business owners', shoppers: 'Shoppers' } as const

async function invokeSend(action: 'test' | 'send', id: string) {
  const { data, error } = await supabase.functions.invoke('send-release-announcement', { body: { action, announcement_id: id } })
  if (error) {
    let msg = error.message
    try { msg = (await (error as { context?: Response }).context?.json())?.error ?? msg } catch { /* keep generic */ }
    throw new Error(msg)
  }
  return data as { sent_to?: string; totals?: { sent: number; failed: number; pending: number }; status?: string }
}

export function ReleaseEmails() {
  const [items, setItems] = React.useState<Announcement[]>([])
  const [counts, setCounts] = React.useState<Partial<Record<Announcement['audience'], number>>>({})
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('release_announcements').select('*').order('created_at', { ascending: false }).limit(50)
    if (error) toast.error('Couldn’t load release emails.')
    setItems((data ?? []) as Announcement[])
    const [o, s] = await Promise.all([
      supabase.rpc('release_announcement_audience_count', { _audience: 'owners' }),
      supabase.rpc('release_announcement_audience_count', { _audience: 'shoppers' }),
    ])
    setCounts({ owners: o.data ?? undefined, shoppers: s.data ?? undefined })
    setLoading(false)
  }, [])

  React.useEffect(() => { void load() }, [load])

  if (loading && !items.length) return <div role="status" className="admin-loading">Loading release emails…</div>

  return (
    <section className="grid max-w-3xl gap-4">
      <p className="text-sm text-muted-foreground">After each big release Claude drafts a “what’s new” email for business owners and one for shoppers. Edit the words if you like, send yourself a test, then send. Nothing goes out until you press Send. People who unsubscribed from product news are skipped automatically.</p>
      {items.length === 0 && <p className="rounded-2xl border border-border bg-card p-5 text-muted-foreground">No release emails yet.</p>}
      {/* Keyed on updated_at so a reload after saving resets the edit fields. */}
      {items.map((a) => <AnnouncementCard key={`${a.id}:${a.updated_at}`} a={a} audienceCount={counts[a.audience]} onChanged={load} />)}
    </section>
  )
}

function AnnouncementCard({ a, audienceCount, onChanged }: { a: Announcement; audienceCount?: number; onChanged: () => Promise<void> }) {
  const editable = a.status === 'draft'
  const [subject, setSubject] = React.useState(a.subject)
  const [body, setBody] = React.useState(a.body)
  const [busy, setBusy] = React.useState<null | 'save' | 'test' | 'send' | 'cancel'>(null)
  const [confirming, setConfirming] = React.useState(false)
  const dirty = subject !== a.subject || body !== a.body

  async function save() {
    setBusy('save')
    const { error } = await supabase.from('release_announcements').update({ subject: subject.trim(), body, updated_at: new Date().toISOString() }).eq('id', a.id)
    setBusy(null)
    if (error) return void toast.error('Couldn’t save the changes.')
    toast.success('Saved.')
    await onChanged()
  }

  async function test() {
    if (dirty) return void toast.error('Save your changes first, so the test shows them.')
    setBusy('test')
    try {
      const r = await invokeSend('test', a.id)
      toast.success(`Test sent to ${r.sent_to}.`)
    } catch (e) { toast.error((e as Error).message) }
    setBusy(null)
  }

  async function send() {
    setConfirming(false)
    setBusy('send')
    try {
      const r = await invokeSend('send', a.id)
      if (r.status === 'sent') toast.success(`Sent to ${r.totals?.sent ?? 0} people.`)
      else toast.error(`${r.totals?.sent ?? 0} sent, ${r.totals?.failed ?? 0} failed. Press “Retry failed” to try those again.`)
    } catch (e) { toast.error((e as Error).message) }
    setBusy(null)
    await onChanged()
  }

  async function cancel() {
    setBusy('cancel')
    const { error } = await supabase.from('release_announcements').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', a.id)
    setBusy(null)
    if (error) return void toast.error('Couldn’t discard this draft.')
    await onChanged()
  }

  const statusBadge = { draft: <Badge tone="warn">Draft</Badge>, sending: <Badge tone="bad">Partly sent</Badge>, sent: <Badge tone="ok">Sent</Badge>, cancelled: <Badge tone="muted">Discarded</Badge> }[a.status]

  return (
    <article className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        {statusBadge}
        <Badge tone="muted">{AUDIENCE[a.audience]}</Badge>
        {a.release_note && <span className="text-xs text-muted-foreground">{a.release_note}</span>}
        <span className="ml-auto text-xs text-muted-foreground">{a.sent_at ? `Sent ${fmtDate(a.sent_at)}` : `Drafted ${fmtDate(a.created_at)}`}</span>
      </div>

      {editable ? (
        <div className="mt-4 grid gap-3">
          <label className="text-sm font-semibold">Subject
            <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 font-normal text-foreground" />
          </label>
          <label className="text-sm font-semibold">Email
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} maxLength={10000} className="mt-1 w-full rounded-xl border border-border bg-background p-3 font-normal leading-6 text-foreground" />
          </label>
          <p className="text-xs text-muted-foreground">Starts with “Hi &lt;first name&gt;,” and ends with the team sign-off and an unsubscribe link. Leave a blank line between paragraphs; start lines with “- ” for bullet points.</p>
        </div>
      ) : (
        <div className="mt-4">
          <p className="font-bold">{a.subject}</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{a.body}</p>
          {a.status !== 'cancelled' && <p className="mt-3 text-sm">{a.sent_count} sent{a.failed_count ? ` · ${a.failed_count} failed` : ''}{a.recipient_count != null ? ` of ${a.recipient_count}` : ''}</p>}
        </div>
      )}

      {(editable || a.status === 'sending') && (
        <div className="mt-4 flex flex-wrap gap-2">
          {editable && <button className={btnGhost} disabled={!dirty || !!busy} onClick={() => void save()}>{busy === 'save' ? 'Saving…' : 'Save changes'}</button>}
          {editable && <button className={btnGhost} disabled={!!busy} onClick={() => void test()}>{busy === 'test' ? 'Sending test…' : 'Send test to me'}</button>}
          <button className={btnPrimary} disabled={!!busy || dirty} onClick={() => setConfirming(true)}>
            {busy === 'send' ? 'Sending…' : a.status === 'sending' ? 'Retry failed' : `Send to ${audienceCount ?? '…'} ${audienceCount === 1 ? 'person' : 'people'}`}
          </button>
          {editable && <button className={btnDanger} disabled={!!busy} onClick={() => void cancel()}>Discard draft</button>}
        </div>
      )}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{a.status === 'sending' ? 'Retry the failed emails?' : `Email ${audienceCount ?? 'all'} ${AUDIENCE[a.audience].toLowerCase()}?`}</DialogTitle>
            <DialogDescription>“{a.subject}” goes out now. Emails can’t be unsent. Anyone who already got this one won’t get it again.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button className={btnGhost} onClick={() => setConfirming(false)}>Not yet</button>
            <button className={btnPrimary} onClick={() => void send()}>Send now</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  )
}
