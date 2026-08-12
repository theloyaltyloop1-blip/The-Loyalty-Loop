import * as React from 'react'
import { Navigate, Link } from 'react-router-dom'
import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { fetchPlatformHealth } from '@/lib/platform-health'
import { AccessTools } from '@/pages/AccessTools'
import { fetchAdminSupportRequests, fetchPendingVerifications, resolveSupportRequest, reviewBusinessVerification, type PendingVerification, type SupportRequest } from '@/lib/businesses'

type Health = { label: string; detail: string; ok: boolean }
type Tab = 'overview' | 'controls' | 'verifications' | 'support'
const tabLabels: Record<Tab, string> = { overview: 'System overview', controls: 'Platform controls', verifications: 'Business listings', support: 'Owner support' }

export function AccessPanel() {
  const { session, loading, rolesLoading, primaryRole, signOut } = useAuth()
  const [tab, setTab] = React.useState<Tab>('overview')
  const [health, setHealth] = React.useState<Health[]>([])
  const [verifications, setVerifications] = React.useState<PendingVerification[]>([])
  const [support, setSupport] = React.useState<SupportRequest[]>([])
  const [busy, setBusy] = React.useState(true)

  const load = React.useCallback(async () => {
    setBusy(true)
    const tables = await Promise.all(['businesses', 'memberships', 'transactions', 'rewards', 'announcements', 'reviews', 'support_requests', 'storage.objects'].map(async (label) => {
      const [schema, table] = label.includes('.') ? label.split('.') : ['public', label]
      const { count, error } = await supabase.schema(schema).from(table).select('*', { head: true, count: 'exact' })
      return { label, ok: !error, detail: error ? error.message : `${count ?? 0} records reachable` }
    }))
    const [checks, pending, requests] = await Promise.all([
      fetchPlatformHealth().catch((error) => [{ label: 'Platform health function', ok: false, detail: error instanceof Error ? error.message : 'Unavailable' }]),
      fetchPendingVerifications().catch(() => []),
      fetchAdminSupportRequests().catch(() => []),
    ])
    setHealth([...tables, ...checks]); setVerifications(pending); setSupport(requests); setBusy(false)
  }, [])

  React.useEffect(() => { if (primaryRole === 'admin') void load() }, [primaryRole, load])
  if (loading || rolesLoading) return null
  if (!session) return <Navigate to="/login" replace />
  if (primaryRole !== 'admin') return <Navigate to="/dashboard" replace />

  return <div className="min-h-screen bg-[#171412] text-[#FCF8F0] lg:flex">
    <aside className="border-b border-white/10 p-4 sm:p-6 lg:flex lg:w-72 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary"><ShieldCheck className="h-6 w-6" /></span><div><p className="font-display font-bold">Access Panel</p><p className="text-xs text-white/45">The Loyalty Loop</p></div></div>
      <nav aria-label="Access panel navigation" className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:mt-10 lg:flex-col lg:overflow-visible">
        {(Object.keys(tabLabels) as Tab[]).map((key) => <button data-press-feedback key={key} onClick={() => setTab(key)} className={'shrink-0 rounded-xl px-4 py-2.5 text-left text-sm font-semibold lg:w-full lg:py-3 lg:text-base ' + (tab === key ? 'bg-primary' : 'text-white/60 hover:bg-white/10')}>
          {key === 'verifications' ? `Listings (${verifications.length})` : key === 'support' ? `Support (${support.filter((item) => item.status === 'open').length})` : tabLabels[key]}
        </button>)}
        <button data-press-feedback onClick={signOut} className="shrink-0 rounded-xl px-4 py-2.5 text-left text-sm font-semibold text-white/60 hover:bg-white/10 lg:hidden">Sign out</button>
      </nav>
      <div className="mt-4 hidden lg:mt-auto lg:block"><Link to="/dashboard" className="block px-4 py-3 text-sm text-white/60">Customer app</Link><Link to="/owner" className="block px-4 py-3 text-sm text-white/60">Business app</Link><button data-press-feedback onClick={signOut} className="px-4 py-3 text-sm text-white/60">Sign out</button></div>
    </aside>
    <main className="w-full flex-1 p-4 sm:p-6 lg:max-w-6xl lg:p-10"><div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs uppercase tracking-wide text-white/40">Platform operations</p><h1 className="font-display text-3xl font-extrabold sm:text-4xl">{tabLabels[tab]}</h1></div><button data-press-feedback onClick={load} className="w-fit rounded-xl border border-white/15 px-4 py-2 text-sm font-bold">Refresh</button></div>
      {busy ? <p className="text-white/50">Checking systems…</p> : tab === 'controls' ? <AccessTools /> : tab === 'overview' ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{health.map((item) => <article key={item.label} className={'rounded-2xl border p-5 ' + (item.ok ? 'border-fun-green/40 bg-[#1E2820]' : 'border-red-500/50 bg-[#351B1B]')}><div className="flex justify-between gap-3"><p className="font-bold">{item.label}</p>{item.ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[#5ACA64]" /> : <XCircle className="h-5 w-5 shrink-0 text-red-400" />}</div><p className="mt-3 break-words text-sm text-white/60">{item.detail}</p></article>)}</div> : tab === 'verifications' ? <div className="grid gap-4">{verifications.length ? verifications.map((item) => <article key={item.id} className="rounded-2xl bg-white/6 p-4 sm:p-5"><p className="font-bold">{item.name}</p><p className="break-all text-sm text-white/55">{item.owner_email}</p><div className="mt-3 flex flex-wrap gap-2"><button data-press-feedback onClick={async () => { await reviewBusinessVerification(item.id, true); void load() }} className="rounded-xl bg-fun-green px-4 py-2 text-sm font-bold">Approve</button><button data-press-feedback onClick={async () => { const reason = prompt('Rejection reason') || ''; if (reason) { await reviewBusinessVerification(item.id, false, reason); void load() } }} className="rounded-xl border border-red-400/50 px-4 py-2 text-sm font-bold text-red-300">Reject</button></div></article>) : <p className="text-white/55">No listings waiting.</p>}</div> : <div className="grid gap-4">{support.filter((item) => item.status === 'open').map((item) => <article key={item.id} className="rounded-2xl bg-white/6 p-4 sm:p-5"><p className="font-bold">{item.subject}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm text-white/60">{item.body}</p><button data-press-feedback onClick={async () => { await resolveSupportRequest(item.id); void load() }} className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-bold">Resolve</button></article>)}</div>}
    </main>
  </div>
}
