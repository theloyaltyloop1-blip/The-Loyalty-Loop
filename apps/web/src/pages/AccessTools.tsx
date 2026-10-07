import * as React from 'react'
import { supabase } from '@/lib/supabase'
import { adminTransferBusinessOwnership, fetchBusinesses, type Business } from '@/lib/businesses'
const input = 'mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 h-10 text-sm text-slate-900'

type AnnouncementTargets = {
  target_website: boolean
  target_shopper_ios: boolean
  target_shopper_android: boolean
  target_retailer_ios: boolean
  target_retailer_android: boolean
}

type PlatformAnnouncement = AnnouncementTargets & {
  id: string
  title: string
  body: string | null
  is_active: boolean
  created_at: string
}

const TARGET_OPTIONS: { key: keyof AnnouncementTargets; label: string }[] = [
  { key: 'target_website', label: 'Website' },
  { key: 'target_shopper_ios', label: 'Shopper (iOS)' },
  { key: 'target_shopper_android', label: 'Shopper (Android)' },
  { key: 'target_retailer_ios', label: 'Retailer (iOS)' },
  { key: 'target_retailer_android', label: 'Retailer (Android)' },
]

const EMPTY_TARGETS: AnnouncementTargets = {
  target_website: false,
  target_shopper_ios: false,
  target_shopper_android: false,
  target_retailer_ios: false,
  target_retailer_android: false,
}

function targetSummary(item: AnnouncementTargets) {
  const active = TARGET_OPTIONS.filter((option) => item[option.key]).map((option) => option.label)
  return active.length ? active.join(' · ') : 'No surfaces selected'
}

function AnnouncementComposer({ onPublished }: { onPublished: () => void }) {
  const [title, setTitle] = React.useState('')
  const [body, setBody] = React.useState('')
  const [targets, setTargets] = React.useState<AnnouncementTargets>(EMPTY_TARGETS)
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const anyTarget = TARGET_OPTIONS.some((option) => targets[option.key])

  async function publish() {
    if (!title.trim() || !anyTarget) return
    setBusy(true)
    setMessage(null)
    try {
      const { error } = await supabase.from('platform_announcements').insert({ title: title.trim(), body: body.trim() || null, ...targets })
      if (error) throw error
      setTitle('')
      setBody('')
      setTargets(EMPTY_TARGETS)
      setMessage('Announcement published to the selected surfaces.')
      onPublished()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not publish.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="rounded-2xl bg-white p-6">
    <h2 className="font-display text-xl font-semibold tracking-tight">Platform announcement</h2>
    <p className="mt-1 text-sm text-slate-600">Shows as a banner on whichever surfaces you pick below. Shoppers/owners also get it in their inbox with a push, if their app is one of the targets.</p>
    <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Announcement title" placeholder="Title" maxLength={160} />
    <textarea className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900" value={body} onChange={(e) => setBody(e.target.value)} aria-label="Announcement message" placeholder="Message" maxLength={1000} />
    <div className="mt-3 flex flex-wrap gap-2">
      {TARGET_OPTIONS.map((option) => (
        <button
          key={option.key}
          data-press-feedback
          type="button"
          aria-pressed={targets[option.key]}
          onClick={() => setTargets((t) => ({ ...t, [option.key]: !t[option.key] }))}
          className={'rounded-full border px-3 py-1.5 text-sm font-semibold ' + (targets[option.key] ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600')}
        >
          {option.label}
        </button>
      ))}
    </div>
    <button data-press-feedback disabled={busy || !title.trim() || !anyTarget} onClick={() => void publish()} className="mt-4 rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Publishing…' : 'Publish'}</button>
    {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
  </section>
}

function AnnouncementList({ items, onChanged }: { items: PlatformAnnouncement[]; onChanged: () => void }) {
  const [errorMessage, setErrorMessage] = React.useState('')
  const actionRef = React.useRef(false)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  async function deactivate(id: string) {
    if (actionRef.current) return
    actionRef.current = true
    setErrorMessage(''); setBusyId(id)
    try {
      const { error } = await supabase.from('platform_announcements').update({ is_active: false }).eq('id', id)
      if (error) throw new Error(error.message)
      onChanged()
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : 'Could not take down announcement.') }
    finally { setBusyId(null); actionRef.current = false }
  }
  return <section className="rounded-2xl bg-white p-6 lg:col-span-2">
    <h2 className="font-display text-xl font-semibold tracking-tight">Recent announcements</h2>{errorMessage && <p role="alert" className="mt-3 text-sm text-red-700">{errorMessage}</p>}
    <div className="mt-4 grid gap-3">
      {items.length ? items.map((item) => <article key={item.id} className={'rounded-xl border p-4 ' + (item.is_active ? 'border-slate-200 bg-white' : 'border-slate-200 bg-white opacity-60')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-bold">{item.title}</p>
            {item.body && <p className="mt-1 text-sm text-slate-600">{item.body}</p>}
            <p className="mt-2 text-xs text-slate-600">{targetSummary(item)} · {new Date(item.created_at).toLocaleString()}</p>
          </div>
          {item.is_active ? <button data-press-feedback disabled={busyId !== null} onClick={() => void deactivate(item.id)} className="shrink-0 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold disabled:opacity-50">{busyId === item.id ? 'Removing…' : 'Take down'}</button> : <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">Taken down</span>}
        </div>
      </article>) : <p className="text-sm text-slate-600">No announcements published yet.</p>}
    </div>
  </section>
}

export function AccessTools() {
  const [email, setEmail] = React.useState(''); const [role, setRole] = React.useState('consumer'); const [message, setMessage] = React.useState(''); const [businessId, setBusinessId] = React.useState(''); const [threshold, setThreshold] = React.useState(10); const [transferBusinessId, setTransferBusinessId] = React.useState(''); const [newOwnerEmail, setNewOwnerEmail] = React.useState(''); const [businesses, setBusinesses] = React.useState<Business[]>([])
  const [acting, setActing] = React.useState(false)
  const actionRef = React.useRef(false)
  const [actionFailed, setActionFailed] = React.useState(false)
  const [announcements, setAnnouncements] = React.useState<PlatformAnnouncement[]>([])
  const loadAnnouncements = React.useCallback(() => {
    void supabase.from('platform_announcements').select('*').order('created_at', { ascending: false }).limit(20).then(({ data, error }) => { if (error) { setActionFailed(true); setMessage(error.message); return } setAnnouncements((data ?? []) as PlatformAnnouncement[]) })
  }, [])
  React.useEffect(() => { void fetchBusinesses().then(setBusinesses).catch(() => setBusinesses([])) }, [])
  React.useEffect(() => { loadAnnouncements() }, [loadAnnouncements])
  const act = async (work: () => PromiseLike<unknown>, success: string) => {
    if (actionRef.current) return
    actionRef.current = true; setActing(true); setMessage(''); setActionFailed(false)
    try {
      const result = await work()
      if (result && typeof result === 'object' && 'error' in result && result.error) {
        const error = result.error as { message?: string }
        throw new Error(error.message ?? 'Action failed')
      }
      setMessage(success)
    } catch (error) { setActionFailed(true); setMessage(error instanceof Error ? error.message : 'Action failed') }
    finally { actionRef.current = false; setActing(false) }
  }

  return <div className="grid gap-5 lg:grid-cols-2">
    <section className="rounded-2xl bg-white p-6"><h2 className="font-display text-xl font-semibold tracking-tight">Roles</h2><input className={input} value={email} onChange={e => setEmail(e.target.value)} aria-label="Account email" placeholder="Account email"/><select className={input} aria-label="Account role" value={role} onChange={e => setRole(e.target.value)}><option value="consumer">Consumer</option><option value="business_owner">Business owner</option><option value="staff">Staff</option><option value="admin">Admin</option></select><div className="mt-3 flex gap-2"><button data-press-feedback disabled={acting} onClick={() => act(() => supabase.rpc('admin_set_role', { _email: email, _role: role, _grant: true }), 'Role granted.')} className="rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-bold">Grant</button><button data-press-feedback disabled={acting} onClick={() => act(() => supabase.rpc('admin_set_role', { _email: email, _role: role, _grant: false }), 'Role revoked.')} className="rounded-xl border border-red-400/50 px-4 py-2 text-sm font-bold text-red-700">Revoke</button></div></section>
    <section className="rounded-2xl bg-white p-6"><h2 className="font-display text-xl font-semibold tracking-tight">Loyalty override</h2><input className={input} value={businessId} onChange={e => setBusinessId(e.target.value)} aria-label="Business UUID" placeholder="Business UUID"/><input className={input} aria-label="Loyalty threshold" type="number" min="1" value={threshold} onChange={e => setThreshold(Number(e.target.value))}/><button data-press-feedback disabled={acting} onClick={() => act(() => supabase.rpc('admin_override_loyalty_threshold', { _business_id: businessId, _threshold: threshold }), 'Threshold updated and audited.')} className="mt-3 rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-bold">Override threshold</button></section>
    <section className="rounded-2xl bg-white p-6"><h2 className="font-display text-xl font-semibold tracking-tight">Transfer shop ownership</h2><p className="mt-1 text-sm text-slate-600">The recipient must already have an account. This action is recorded in the audit log.</p><select className={input} aria-label="Shop to transfer" value={transferBusinessId} onChange={e => setTransferBusinessId(e.target.value)}><option value="">Choose a shop</option>{businesses.map(business => <option key={business.id} value={business.id}>{business.name}</option>)}</select><input className={input} type="email" value={newOwnerEmail} onChange={e => setNewOwnerEmail(e.target.value)} aria-label="New owner account email" placeholder="New owner account email"/><button data-press-feedback disabled={acting || !transferBusinessId || !newOwnerEmail.trim()} onClick={() => { if (!window.confirm('Transfer this shop to the new owner? The previous owner will lose business access unless they own another shop.')) return; void act(() => adminTransferBusinessOwnership(transferBusinessId, newOwnerEmail), 'Shop ownership transferred and recorded.') }} className="mt-3 rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50">Transfer ownership</button></section>
    <AnnouncementComposer onPublished={loadAnnouncements} />
    {message && <p role={actionFailed ? "alert" : "status"} className={"text-sm lg:col-span-2 " + (actionFailed ? "text-red-700" : "text-emerald-700")}>{message}</p>}
    <AnnouncementList items={announcements} onChanged={loadAnnouncements} />
  </div>
}
