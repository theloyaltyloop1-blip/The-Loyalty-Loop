import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { LifeBuoy, Send } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { OwnerLayout } from '@/components/owner-layout'
import { useOwner } from '@/lib/owner-context'
import { createSupportRequest, fetchMySupportRequests, type SupportRequest } from '@/lib/businesses'

export function OwnerSupport() {
  const { session, loading: authLoading } = useAuth()
  const { business, loading: ownerLoading } = useOwner()
  const [subject, setSubject] = React.useState('')
  const [body, setBody] = React.useState('')
  const [priority, setPriority] = React.useState<SupportRequest['priority']>('normal')
  const [items, setItems] = React.useState<SupportRequest[]>([])
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const load = React.useCallback(() => { if (business) fetchMySupportRequests(business.id).then(setItems).catch((err) => setError(typeof err?.message === 'string' ? err.message : 'Could not load support requests.')) }, [business])
  React.useEffect(() => { load() }, [load])
  if (authLoading || ownerLoading) return null
  if (!session) return <Navigate to="/login" replace />
  async function submit(e: React.FormEvent) { e.preventDefault(); if (!business || !session || !subject.trim() || !body.trim()) return; setSaving(true); setError(null); try { await createSupportRequest(business.id, session.user.id, { subject: subject.trim(), body: body.trim(), priority }); setSubject(''); setBody(''); load() } catch (err) { setError(typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string' ? err.message : 'Could not send request.') } finally { setSaving(false) } }
  return <OwnerLayout><p className="text-xs font-extrabold uppercase tracking-wide text-foreground/40 mb-1">Help centre</p><h1 className="text-3xl font-display font-extrabold text-foreground">Help & support</h1><p className="mt-2 mb-7 text-foreground/55">Send a request directly to the Loyalty Loop team.</p>{!business ? <div className="rounded-2xl bg-card p-8 text-center text-foreground/55">Set up your shop to request support.</div> : <><form onSubmit={submit} className="rounded-2xl bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"><div className="flex items-center gap-2 mb-5"><LifeBuoy className="h-5 w-5 text-primary" /><h2 className="font-display text-xl font-bold">New request</h2></div><input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} required placeholder="What do you need help with?" className="w-full rounded-xl border border-black/10 bg-white/70 px-4 py-3 outline-none focus:border-primary" /><div className="flex gap-3 mt-3"><select value={priority} onChange={(e) => setPriority(e.target.value as SupportRequest['priority'])} className="rounded-xl border border-black/10 bg-white px-3"><option value="low">Low priority</option><option value="normal">Normal priority</option><option value="high">High priority</option></select><textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} required placeholder="Give us as much detail as you can…" className="min-h-28 flex-1 rounded-xl border border-black/10 bg-white/70 px-4 py-3 outline-none focus:border-primary" /></div>{error && <p className="mt-3 text-sm text-red-600">{error}</p>}<button data-press-feedback disabled={saving} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-white disabled:opacity-60"><Send className="h-4 w-4" />{saving ? 'Sending…' : 'Send request'}</button></form><h2 className="mt-8 mb-4 font-display text-xl font-bold">Your requests</h2><div className="grid gap-4">{items.length === 0 ? <p className="text-foreground/55">No support requests yet.</p> : items.map((item) => <article key={item.id} className="rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"><div className="flex justify-between gap-3"><p className="font-bold">{item.subject}</p><span className={item.status === 'resolved' ? 'text-sm font-bold text-[#24722B]' : 'text-sm font-bold text-primary-hover'}>{item.status === 'resolved' ? 'Resolved' : 'Open'}</span></div><p className="mt-2 text-sm text-foreground/65 whitespace-pre-wrap">{item.body}</p>{item.admin_response && <div className="mt-4 border-l-2 border-primary pl-3"><p className="text-sm font-bold">Loyalty Loop reply</p><p className="mt-1 text-sm text-foreground/65 whitespace-pre-wrap">{item.admin_response}</p></div>}</article>)}</div></>}</OwnerLayout>
}
