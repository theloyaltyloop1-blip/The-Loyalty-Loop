import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { LifeBuoy, Send } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { OwnerLayout } from '@/components/owner-layout'
import { BarePageSkeleton } from '@/components/page-skeleton'
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
  if (authLoading || ownerLoading) return <BarePageSkeleton />
  if (!session) return <Navigate to="/login" replace />
  async function submit(e: React.FormEvent) { e.preventDefault(); if (!business || !session || !subject.trim() || !body.trim()) return; setSaving(true); setError(null); try { await createSupportRequest(business.id, session.user.id, { subject: subject.trim(), body: body.trim(), priority }); setSubject(''); setBody(''); load() } catch (err) { setError(typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string' ? err.message : 'Could not send request.') } finally { setSaving(false) } }
  return <OwnerLayout><h1 className="text-3xl font-display font-bold tracking-tight text-foreground sm:text-4xl">Help & support</h1><p className="mt-2 mb-7 text-muted-foreground">Send a request directly to the Loyalty Loop team.</p>{!business ? <div className="rounded-3xl bg-sage px-6 py-10 text-center text-sage-ink">Set up your shop to request support.</div> : <><form onSubmit={submit} className="rounded-3xl bg-card p-6 ring-1 ring-foreground/8 sm:p-7"><div className="flex items-center gap-2 mb-5"><LifeBuoy className="h-5 w-5 text-primary" /><h2 className="font-display text-xl font-semibold tracking-tight">New request</h2></div><input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} required aria-label="Subject" placeholder="What do you need help with?" className="h-12 w-full rounded-xl border border-input bg-background px-4 outline-none focus:border-primary focus:ring-3 focus:ring-primary/20" /><div className="flex gap-3 mt-3"><select value={priority} onChange={(e) => setPriority(e.target.value as SupportRequest['priority'])} aria-label="Priority" className="h-12 rounded-xl border border-input bg-card px-3"><option value="low">Low priority</option><option value="normal">Normal priority</option><option value="high">High priority</option></select><textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} required placeholder="Give us as much detail as you can…" className="min-h-28 flex-1 rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary" /></div>{error && <p className="mt-3 text-sm text-destructive">{error}</p>}<button data-press-feedback disabled={saving} className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary hover:bg-primary-hover transition-colors px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60"><Send className="h-4 w-4" />{saving ? 'Sending…' : 'Send request'}</button></form><h2 className="mt-8 mb-4 font-display text-xl font-semibold tracking-tight">Your requests</h2><div className="grid gap-4">{items.length === 0 ? <p className="text-muted-foreground">No support requests yet.</p> : items.map((item) => <article key={item.id} className="rounded-2xl bg-card p-5 ring-1 ring-foreground/8"><div className="flex justify-between gap-3"><p className="font-bold">{item.subject}</p><span className={'h-fit rounded-full px-3 py-1 text-xs font-semibold ' + (item.status === 'resolved' ? 'bg-sage text-sage-ink' : 'bg-peach text-peach-ink')}>{item.status === 'resolved' ? 'Resolved' : 'Open'}</span></div><p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{item.body}</p>{item.admin_response && <div className="mt-4 border-l-2 border-primary pl-3"><p className="text-sm font-bold">Loyalty Loop reply</p><p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{item.admin_response}</p></div>}</article>)}</div></>}</OwnerLayout>
}
