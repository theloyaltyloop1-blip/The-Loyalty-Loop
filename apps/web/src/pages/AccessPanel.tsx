import * as React from 'react'
import { Navigate, Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Users as UsersIcon, ScrollText, BarChart3, LayoutDashboard, SlidersHorizontal, Store, LifeBuoy, MessageSquareWarning, HardDrive, Gift, RefreshCw, LogOut, ArrowUpRight, CheckCircle2, Download, LockKeyhole, PauseCircle, ShieldCheck, XCircle, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { fetchPlatformHealth } from '@/lib/platform-health'
import './admin-panel.css'
import './admin-reference.css'
import { Audit } from '@/pages/admin/Audit'
import { Businesses } from '@/pages/admin/Businesses'
import { Loyalty } from '@/pages/admin/Loyalty'
import { Users } from '@/pages/admin/Users'
import { TrendingAdmin } from '@/pages/TrendingAdmin'
import { ShopRequests } from '@/pages/ShopRequests'
import { AdminCharts, AdminMetrics, AdminQueueSummary } from '@/components/admin-dashboard'
import { AccessTools } from '@/pages/AccessTools'
import { BarePageSkeleton } from '@/components/page-skeleton'
import { dismissReviewReport, fetchAdminSupportRequests, fetchOpenReviewReports, fetchPendingVerifications, removeReportedReview, resolveSupportRequest, reviewBusinessVerification, type PendingVerification, type ReviewReport, type SupportRequest } from '@/lib/businesses'

type Tab = 'overview' | 'analytics' | 'controls' | 'verifications' | 'support' | 'moderation' | 'backups' | 'features' | 'trending' | 'shop-requests' | 'users' | 'businesses' | 'loyalty' | 'audit'
type Health = { count?: number; label: string; detail: string; ok: boolean; targetTab?: Tab }
type UsageEvent = { event_name: string; surface: string; events: number; people: number; last_seen: string }

const tabLabels: Record<Tab, string> = {
  overview: 'Overview', analytics: 'Product analytics', controls: 'Platform controls', verifications: 'Business listings', support: 'Owner support', moderation: 'Reported reviews', backups: 'Laptop backups', features: 'Paused features', trending: 'Trending shops', 'shop-requests': 'Shop requests', users: 'Users & roles', businesses: 'All businesses', loyalty: 'Loyalty data', audit: 'Audit log',
}

const navGroups: { label: string; tabs: Tab[] }[] = [
  { label: 'Workspace', tabs: ['overview', 'analytics', 'users', 'businesses', 'loyalty'] },
  { label: 'Manage', tabs: ['verifications', 'trending', 'shop-requests', 'support', 'moderation', 'controls'] },
  { label: 'System', tabs: ['audit', 'backups', 'features'] },
]

// Features that were built and shipped, then deliberately switched off at
// the owner's request — kept here so it's obvious what still exists and how
// to bring each one back, rather than that knowledge only living in git log.
const PAUSED_FEATURES = [
  {
    name: 'Dark mode toggle',
    where: 'Site-wide (every page)',
    detail: 'The floating sun/moon button that let visitors switch themes was removed. Dark mode itself (the theme provider, localStorage persistence and every .dark CSS rule) is untouched and still fully working, there\'s just no UI control to switch it anymore.',
    toBringBack: 'Re-add <ThemeToggle compact /> in App.tsx (see git history for the exact spot).',
  },
  {
    name: 'WhatsApp QR onboarding',
    where: 'Every shop\'s Growth Tools page',
    detail: 'The card that let a shop owner route their printed poster through a WhatsApp join flow (scan → WhatsApp chat → joined) instead of the standard QR join was removed from the Growth Tools page for every shop. The underlying capability (the database flag, the poster\'s conditional QR routing and the /whatsapp/* pages) is untouched, so any shop that had already turned it on keeps working exactly as before.',
    toBringBack: 'Re-add the WhatsApp QR onboarding card in apps/web/src/pages/owner/Tools.tsx (see git history for the removed block).',
  },
] as const

const REASON_LABELS: Record<ReviewReport['reason'], string> = {
  spam: 'Spam or fake', offensive: 'Offensive or hateful', harassment: 'Harassment or bullying', off_topic: 'Not about this shop', other: 'Other',
}

// Apple caps "Sign in with Apple" OAuth client secrets (the JWT in Supabase →
// Auth → Providers → Apple → "Secret Key (for OAuth)") at 6 months. There's
// no reminder from Apple or Supabase when it's about to expire — it just
// silently starts rejecting every Apple sign-in one day. This constant is the
// exact expiry of the secret generated 2026-09-08 (Key ID A2QVMBB8JN, Services
// ID com.theloyaltyloop.shopper.signin); regenerate it with the same script
// used to create this one before this date, paste the new JWT into Supabase,
// and update this constant to the new expiry.
const APPLE_SECRET_EXPIRES_AT = '2027-03-10T10:04:36.000Z'

function appleSignInHealth(): Health {
  const expiresAt = new Date(APPLE_SECRET_EXPIRES_AT)
  const daysLeft = Math.round((expiresAt.getTime() - Date.now()) / 86_400_000)
  const expiredOrSoon = daysLeft <= 45
  return {
    label: 'Apple Sign-In secret',
    ok: !expiredOrSoon,
    detail: daysLeft <= 0
      ? `Expired ${expiresAt.toLocaleDateString('en-GB')}. Apple sign-in is broken until you generate a new secret and paste it into Supabase → Auth → Providers → Apple.`
      : expiredOrSoon
        ? `Expires ${expiresAt.toLocaleDateString('en-GB')}, ${daysLeft} days left. Generate a new secret soon and paste it into Supabase → Auth → Providers → Apple, or Apple sign-in will silently break.`
        : `Expires ${expiresAt.toLocaleDateString('en-GB')} (Apple caps these at 6 months). No action needed yet.`,
  }
}

export function AccessPanel() {
  const { session, loading, rolesLoading, primaryRole, signOut } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('view')
  const tab: Tab = requestedTab && requestedTab in tabLabels ? requestedTab as Tab : 'overview'
  const setTab = (next: Tab) => setSearchParams(next === 'overview' ? {} : { view: next })
  const [health, setHealth] = React.useState<Health[]>([])
  const [selectedHealth, setSelectedHealth] = React.useState<Health | null>(null)
  const [verifications, setVerifications] = React.useState<PendingVerification[]>([])
  const [support, setSupport] = React.useState<SupportRequest[]>([])
  const [reports, setReports] = React.useState<ReviewReport[]>([])
  const [usage, setUsage] = React.useState<UsageEvent[]>([])
  const [busy, setBusy] = React.useState(true)
  const [errors, setErrors] = React.useState<string[]>([])
  const [updatedAt, setUpdatedAt] = React.useState<Date | null>(null)
  const loadingRef = React.useRef(false)

  const load = React.useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    setBusy(true)
    const failures: string[] = []
    async function safe<T>(label: string, work: PromiseLike<T>, fallback: T): Promise<T> {
      try { return await work } catch (error) {
        failures.push(`${label}: ${error instanceof Error ? error.message : 'Could not load data'}`)
        return fallback
      }
    }
    try {
      const [tableChecks, storage, functionChecks, pending, requests, reviewReports, usageData] = await Promise.all([
        Promise.all(['businesses', 'memberships', 'transactions', 'rewards', 'announcements', 'reviews', 'support_requests'].map(async (label) => {
          try {
            const { count, error } = await supabase.from(label).select('*', { head: true, count: 'exact' })
            return { label, ok: !error, count: error ? undefined : count ?? 0, targetTab: label === 'businesses' ? 'verifications' as const : label === 'support_requests' ? 'support' as const : undefined, detail: error ? error.message : `${count ?? 0} records reachable` }
          } catch { return { label, ok: false, detail: 'Could not reach this table' } }
        })),
        safe('Storage', supabase.storage.from('logos').list('', { limit: 1 }).then(({ error }) => ({ label: 'Storage', ok: !error, detail: error ? error.message : 'Logo storage bucket reachable' })), { label: 'Storage', ok: false, detail: 'Storage unavailable' }),
        safe('Platform health', fetchPlatformHealth(), [{ label: 'Platform health function', ok: false, detail: 'Health report unavailable' }]),
        safe('Business listings', fetchPendingVerifications(), []),
        safe('Owner support', fetchAdminSupportRequests(), []),
        safe('Reported reviews', fetchOpenReviewReports(), []),
        safe('Product analytics', (async () => {
          const { data, error } = await supabase.rpc('admin_usage_analytics', { _days: 30 })
          if (error) throw new Error(error.message)
          return (data || []) as UsageEvent[]
        })(), []),
      ])
      setHealth([...tableChecks, storage, ...functionChecks, appleSignInHealth()])
      setVerifications(pending); setSupport(requests); setReports(reviewReports); setUsage(usageData)
      setUpdatedAt(new Date())
    } catch (error) { failures.push(error instanceof Error ? error.message : 'Dashboard unavailable') }
    finally { setErrors(failures); setBusy(false); loadingRef.current = false }

  }, [])

  React.useEffect(() => { if (primaryRole === 'admin') void load() }, [primaryRole, load])
  if (loading || rolesLoading) return <BarePageSkeleton />
  if (!session) return <Navigate to="/login" replace />
  if (primaryRole !== 'admin') return <Navigate to="/dashboard" replace />

  const icons = { overview: LayoutDashboard, analytics: BarChart3, controls: SlidersHorizontal, verifications: Store, support: LifeBuoy, moderation: MessageSquareWarning, backups: HardDrive, features: PauseCircle, trending: BarChart3, 'shop-requests': Store, users: UsersIcon, businesses: Store, loyalty: Gift, audit: ScrollText }
  const queueCount = verifications.length + support.filter(item => item.status === 'open').length + reports.length
  const analyticsFailed = errors.some(error => error.startsWith('Product analytics:'))
  return <div className="admin-panel admin-shell">
    <aside className="admin-sidebar">
      <Link to="/access" className="admin-brand"><span className="admin-brand-mark"><Gift size={21}/></span><span>The Loyalty Loop<small>Admin workspace</small></span></Link>
      <nav aria-label="Access panel navigation">
        {navGroups.map(group => <div className="admin-nav-group" key={group.label}><p className="admin-nav-label">{group.label}</p>{group.tabs.map(key => { const Icon = icons[key]; const count = key === 'verifications' ? verifications.length : key === 'support' ? support.filter(item => item.status === 'open').length : key === 'moderation' ? reports.length : 0
          return <button key={key} aria-current={tab === key ? 'page' : undefined} onClick={() => { setTab(key); setSelectedHealth(null) }} className={'admin-nav-item ' + (tab === key ? 'is-active' : '')}><Icon size={18}/><span>{tabLabels[key]}</span>{count > 0 && <span className="admin-badge">{count}</span>}</button>
        })}</div>)}
      </nav>
      <div className="admin-sidebar-footer"><Link to="/dashboard">Customer app <ArrowUpRight size={14}/></Link><Link to="/owner">Business app <ArrowUpRight size={14}/></Link><button onClick={() => void signOut()}><LogOut size={16}/>Sign out</button></div>
    </aside>
    <main className="admin-main">
      <div className="admin-topbar"><span>Workspace / {tabLabels[tab]}</span><div className="admin-topbar-tools"><span className="admin-date"><CalendarDays size={16}/>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span><span className="admin-admin-chip"><ShieldCheck size={14}/>Admin access</span></div></div>
      <header className="admin-page-header"><div><h1>{tab === 'overview' ? 'Welcome back.' : tabLabels[tab]}</h1><p>{tab === 'overview' ? 'Here’s what’s happening across The Loyalty Loop.' : 'Your platform. Everything in its place.'}</p></div>{!(['users', 'businesses', 'loyalty', 'audit'] as Tab[]).includes(tab) && <button disabled={busy} onClick={() => void load()} className="admin-refresh"><RefreshCw size={16}/>{busy ? 'Refreshing…' : 'Refresh data'}</button>}</header>
      {!(['users', 'businesses', 'loyalty', 'audit'] as Tab[]).includes(tab) && <div className="admin-update">{updatedAt ? `Last checked ${updatedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'Waiting for first check'}{(tab === 'overview' || tab === 'analytics') && <span>Analytics · last 30 days</span>}</div>}
      {!!errors.length && <div role="alert" className="admin-error"><strong>Some data could not be loaded.</strong>{errors.map(error => <p key={error}>{error}</p>)}<button disabled={busy} onClick={() => void load()}>Retry failed checks</button></div>}
      {tab === 'users' ? <Users/> : tab === 'businesses' ? <Businesses/> : tab === 'loyalty' ? <Loyalty/> : tab === 'audit' ? <Audit/> : busy ? <div role="status" className="admin-loading">Loading your dashboard…</div> : tab === 'trending' ? <TrendingAdmin embedded/> : tab === 'shop-requests' ? <ShopRequests embedded/> : tab === 'controls' ? <AccessTools/> : tab === 'overview' ? <>
        <AdminMetrics counts={Object.fromEntries(health.filter(item => item.count !== undefined).map(item => [item.label, item.count!]))}/>
        <AdminCharts items={usage} unavailable={analyticsFailed}/>
        <AdminQueueSummary message={queueCount ? 'A few things need your attention.' : errors.length ? 'Refresh failed checks to confirm your queues.' : 'You’re all caught up.'} queues={([
          { key: 'verifications', label: 'Business listings', count: verifications.length, source: 'Business listings:' },
          { key: 'support', label: 'Owner support', count: support.filter(item => item.status === 'open').length, source: 'Owner support:' },
          { key: 'moderation', label: 'Reported reviews', count: reports.length, source: 'Reported reviews:' },
        ] as const).map(queue => ({ ...queue, unavailable: errors.some(error => error.startsWith(queue.source)), onOpen: () => setTab(queue.key) }))}/>
        <div className="admin-section-heading"><div><h2>System checks</h2><p>Reachability and configuration at the last refresh.</p></div><span>{health.filter(item => item.ok).length} / {health.length} passing</span></div>
        <Overview health={health} selected={selectedHealth} onSelect={setSelectedHealth} onRefresh={load} onOpenTab={setTab}/>
      </> : tab === 'analytics' ? <><AdminCharts items={usage} unavailable={analyticsFailed}/>{!analyticsFailed && <ProductAnalytics items={usage}/>}</> : tab === 'verifications' ? <VerificationQueue items={verifications} refresh={load}/> : tab === 'support' ? <SupportQueue items={support} refresh={load}/> : tab === 'moderation' ? <ReviewReportsQueue items={reports} refresh={load}/> : tab === 'backups' ? <LaptopBackups/> : <PausedFeatures/>}
    </main>
  </div>
}

function ProductAnalytics({ items }: { items: UsageEvent[] }) {
  const total = items.reduce((sum, item) => sum + Number(item.events), 0)
  const people = Math.max(0, ...items.map((item) => Number(item.people)))
  return <section><div className="grid gap-4 sm:grid-cols-2"><article className="rounded-2xl bg-card p-5"><p className="text-sm text-muted-foreground">Tracked actions, last 30 days</p><p className="mt-2 font-display text-4xl font-bold">{total}</p></article><article className="rounded-2xl bg-card p-5"><p className="text-sm text-muted-foreground">Most users on one feature</p><p className="mt-2 font-display text-4xl font-bold">{people}</p></article></div><p className="mt-6 text-sm text-muted-foreground">Only people who opt in are included. Events never include passwords, emails, QR codes or message content.</p><div className="mt-4 overflow-x-auto rounded-2xl border border-border"><table className="w-full min-w-[560px] text-left text-sm"><thead className="border-b border-border text-muted-foreground"><tr><th className="p-4">Feature</th><th className="p-4">Where</th><th className="p-4">Uses</th><th className="p-4">People</th><th className="p-4">Last used</th></tr></thead><tbody>{items.length ? items.map((item) => <tr key={`${item.surface}-${item.event_name}`} className="border-b border-border"><td className="p-4 font-semibold">{item.event_name.replaceAll('_', ' ')}</td><td className="p-4 text-muted-foreground">{item.surface.replaceAll('_', ' ')}</td><td className="p-4">{item.events}</td><td className="p-4">{item.people}</td><td className="p-4 text-muted-foreground">{new Date(item.last_seen).toLocaleString()}</td></tr>) : <tr><td colSpan={5} className="p-5 text-muted-foreground">No opted-in usage yet. It will appear here after people use the website or updated apps.</td></tr>}</tbody></table></div></section>
}

function Overview({ health, selected, onSelect, onRefresh, onOpenTab }: { health: Health[]; selected: Health | null; onSelect: (item: Health | null) => void; onRefresh: () => Promise<void>; onOpenTab: (tab: Tab) => void }) {
  return <><div className="admin-health-grid">{health.map(item => <button key={item.label} type="button" onClick={() => onSelect(item)} className={'admin-health-card ' + (item.ok ? '' : 'has-error')}><div><span>{item.label.replaceAll('_', ' ')}</span>{item.ok ? <CheckCircle2 size={17}/> : <XCircle size={17}/>}</div><p>{item.detail}</p><small>View details →</small></button>)}</div>
    {selected && <section className="mt-5 rounded-2xl border border-border bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{selected.label}</p><p className="mt-1 text-sm text-muted-foreground">{selected.detail}</p></div><button data-press-feedback onClick={() => onSelect(null)} className="rounded-lg px-2 py-1 text-sm text-muted-foreground">Close</button></div><div className="mt-4 flex flex-wrap gap-2"><button data-press-feedback onClick={() => void onRefresh()} className="rounded-xl bg-info text-info-foreground px-4 py-2 text-sm font-bold">Run check again</button>{selected.targetTab && <button data-press-feedback onClick={() => onOpenTab(selected.targetTab!)} className="rounded-xl border border-border px-4 py-2 text-sm font-bold">Open related queue</button>}{selected.label === 'Storage' && <a href="https://supabase.com/dashboard/project/tgukdabfvvoywawmzbdo/storage/buckets" target="_blank" rel="noreferrer" className="rounded-xl border border-border px-4 py-2 text-sm font-bold">Open Storage</a>}{selected.label === 'Platform health function' && <a href="https://supabase.com/dashboard/project/tgukdabfvvoywawmzbdo/functions/platform-health" target="_blank" rel="noreferrer" className="rounded-xl border border-border px-4 py-2 text-sm font-bold">Open function</a>}</div></section>}</>
}

function RejectListingDialog({ name, onReject }: { name: string; onReject: (reason: string) => Promise<void> }) {
  const [open, setOpen] = React.useState(false)
  const [reason, setReason] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  async function submit() {
    if (!reason.trim()) return
    setBusy(true)
    try {
      await onReject(reason.trim())
      setOpen(false)
      setReason('')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button data-press-feedback className="rounded-xl border border-destructive-border/50 px-4 py-2 text-sm font-bold text-destructive">Reject</button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject {name}?</DialogTitle>
          <DialogDescription>The owner will see this reason.</DialogDescription>
        </DialogHeader>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Rejection reason" autoFocus />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" disabled={!reason.trim() || busy} onClick={() => void submit()}>{busy ? 'Rejecting…' : 'Reject listing'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function VerificationQueue({ items, refresh }: { items: PendingVerification[]; refresh: () => Promise<void> }) {
  return <div className="grid gap-4">{items.length ? items.map((item) => <article key={item.id} className="rounded-2xl bg-card p-4 sm:p-5"><p className="font-bold">{item.name}</p><p className="break-all text-sm text-muted-foreground">{item.owner_email}</p><div className="mt-3 flex flex-wrap gap-2"><button data-press-feedback onClick={async () => { await reviewBusinessVerification(item.id, true); void refresh() }} className="rounded-xl bg-info text-info-foreground px-4 py-2 text-sm font-bold">Approve</button><RejectListingDialog name={item.name} onReject={async (reason) => { await reviewBusinessVerification(item.id, false, reason); void refresh() }} /></div></article>) : <p className="text-muted-foreground">No listings waiting.</p>}</div>
}

function SupportQueue({ items, refresh }: { items: SupportRequest[]; refresh: () => Promise<void> }) {
  const open = items.filter((item) => item.status === 'open')
  return <div className="grid gap-4">{open.length ? open.map((item) => <article key={item.id} className="rounded-2xl bg-card p-4 sm:p-5"><p className="font-bold">{item.subject}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{item.body}</p><button data-press-feedback onClick={async () => { await resolveSupportRequest(item.id); void refresh() }} className="mt-3 rounded-xl bg-info text-info-foreground px-4 py-2 text-sm font-bold">Resolve</button></article>) : <p className="text-muted-foreground">No open support requests.</p>}</div>
}

function ReviewReportsQueue({ items, refresh }: { items: ReviewReport[]; refresh: () => Promise<void> }) {
  const [busyId, setBusyId] = React.useState<string | null>(null)
  async function act(fn: () => Promise<void>, id: string) {
    setBusyId(id)
    try { await fn(); void refresh() } catch (error) { toast.error(error instanceof Error ? error.message : 'Something went wrong.') } finally { setBusyId(null) }
  }
  return <div className="grid gap-4">
    <p className="text-sm text-muted-foreground">Reviews a shopper flagged as objectionable. It’s already hidden from the person who reported it. Decide within 24 hours whether to remove it for everyone.</p>
    {items.length ? items.map((report) => <article key={report.id} className="rounded-2xl bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-destructive/20 px-3 py-1 text-xs font-bold text-destructive">{REASON_LABELS[report.reason]}</span>
        <span className="text-xs text-muted-foreground">reported {new Date(report.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      {report.review ? <>
        <p className="mt-3 text-sm text-muted-foreground">{report.review.business?.name ?? 'Unknown shop'} · {'★'.repeat(report.review.rating)}{'☆'.repeat(5 - report.review.rating)}</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{report.review.body || <span className="italic text-muted-foreground">(rating only, no text)</span>}</p>
      </> : <p className="mt-3 text-sm italic text-muted-foreground">The review has already been deleted.</p>}
      {report.detail && <p className="mt-2 text-sm text-muted-foreground">Reporter added: “{report.detail}”</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {report.review && <button data-press-feedback disabled={busyId === report.id} onClick={() => act(() => removeReportedReview(report.review_id), report.id)} className="rounded-xl bg-destructive text-destructive-foreground px-4 py-2 text-sm font-bold disabled:opacity-50">Remove review</button>}
        <button data-press-feedback disabled={busyId === report.id} onClick={() => act(() => dismissReviewReport(report.id), report.id)} className="rounded-xl border border-border px-4 py-2 text-sm font-bold disabled:opacity-50">Dismiss report</button>
      </div>
    </article>) : <p className="text-muted-foreground">No reported reviews. 🎉</p>}
  </div>
}

type LaptopBackup = {
  id: string
  created_at: string
  download_confirmed_at: string | null
  table_count: number
  record_count: number
  archive_bytes: number
  status: 'prepared' | 'download_confirmed'
}

type BackupArchive = {
  format: string
  format_version: number
  created_at: string
  recovery_notes: string
  tables: Record<string, unknown[]>
}

function toBase64(bytes: Uint8Array) {
  let result = ''
  for (let index = 0; index < bytes.length; index += 0x8000) result += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return window.btoa(result)
}

async function encryptArchive(archive: BackupArchive, passphrase: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 600_000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt'])
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(archive)))
  return JSON.stringify({
    format: 'the-loyalty-loop-encrypted-backup',
    format_version: 1,
    created_at: archive.created_at,
    encryption: { algorithm: 'AES-GCM', key_derivation: 'PBKDF2-SHA-256', iterations: 600_000, salt: toBase64(salt), iv: toBase64(iv) },
    ciphertext: toBase64(new Uint8Array(encrypted)),
  })
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function PausedFeatures() {
  return <div className="grid gap-4"><p className="text-sm text-muted-foreground">Built, shipped, then deliberately switched off. Nothing here was removed by accident, and none of it needs to be rebuilt to come back.</p>
    {PAUSED_FEATURES.map((feature) => <article key={feature.name} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="font-bold">{feature.name}</p><p className="mt-1 text-sm text-muted-foreground">{feature.where}</p></div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-bold text-muted-foreground"><PauseCircle className="h-3.5 w-3.5" />Paused</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{feature.detail}</p>
      <p className="mt-3 text-sm text-muted-foreground">To bring it back: {feature.toBringBack}</p>
    </article>)}
  </div>
}

function LaptopBackups() {
  const [history, setHistory] = React.useState<LaptopBackup[]>([])
  const [passphrase, setPassphrase] = React.useState('')
  const [confirmation, setConfirmation] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const loadHistory = React.useCallback(async () => {
    const { data, error: historyError } = await supabase.from('admin_laptop_backups').select('id, created_at, download_confirmed_at, table_count, record_count, archive_bytes, status').order('created_at', { ascending: false }).limit(30)
    if (historyError) { setError(historyError.message); return }
    setHistory((data ?? []) as LaptopBackup[])
  }, [])

  React.useEffect(() => { void loadHistory() }, [loadHistory])

  async function createBackup() {
    setMessage(null)
    setError(null)
    if (passphrase.length < 12) { setError('Use an encryption password of at least 12 characters.'); return }
    if (passphrase !== confirmation) { setError('The two encryption passwords do not match.'); return }
    setBusy(true)
    try {
      const { data, error: exportError } = await supabase.functions.invoke<{ backup: LaptopBackup; archive: BackupArchive }>('export-platform-backup', { body: {} })
      if (exportError || !data?.archive || !data.backup) throw new Error(exportError?.message ?? 'The backup could not be prepared.')
      const encryptedArchive = await encryptArchive(data.archive, passphrase)
      const blob = new Blob([encryptedArchive], { type: 'application/json' })
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `the-loyalty-loop-backup-${data.archive.created_at.slice(0, 10)}.tllbackup`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(downloadUrl)
      const { error: confirmationError } = await supabase.functions.invoke('export-platform-backup', { body: { action: 'confirm_download', backup_id: data.backup.id } })
      if (confirmationError) setError('Download started, but backup history could not be updated. Check your downloads before trying again.')
      setMessage(`Encrypted backup download started. It contains ${data.backup.record_count.toLocaleString()} records from ${data.backup.table_count} tables.`)
      setPassphrase('')
      setConfirmation('')
      await loadHistory()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The backup could not be created.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="max-w-3xl"><div className="rounded-2xl border border-border bg-card p-5 sm:p-7"><div className="flex gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-info text-info-foreground"><LockKeyhole className="h-5 w-5" /></span><div><h2 className="font-display text-2xl font-bold">Encrypted backup for this laptop</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Create a recovery copy of the Loyalty Loop application data and save it on this device. The encryption password stays only with you. We cannot recover it.</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Encryption password<input value={passphrase} onChange={(event) => setPassphrase(event.target.value)} type="password" autoComplete="new-password" className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-foreground outline-none focus:border-info-border" placeholder="At least 12 characters" /></label><label className="text-sm font-semibold">Repeat password<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} type="password" autoComplete="new-password" className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-foreground outline-none focus:border-info-border" placeholder="Repeat it exactly" /></label></div><p className="mt-4 text-xs leading-5 text-muted-foreground">Includes the recovery data needed for accounts, shops, loyalty cards, stamps, rewards, reviews and promotions. It deliberately excludes passwords, service secrets, uploaded file bytes, WhatsApp chats, push tokens and support messages. Keep the backup file and its password separately and securely.</p>{error && <p className="mt-4 text-sm text-destructive">{error}</p>}{message && <p className="mt-4 text-sm text-success">{message}</p>}<button data-press-feedback disabled={busy} onClick={() => void createBackup()} className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-info text-info-foreground px-5 text-sm font-bold disabled:opacity-60"><Download className="h-4 w-4" />{busy ? 'Preparing encrypted backup…' : 'Download encrypted backup'}</button></div><div className="mt-6"><h2 className="font-display text-xl font-semibold tracking-tight">Backup history</h2><p className="mt-1 text-sm text-muted-foreground">This shows exports prepared from the admin panel. “Download started” records initiation; check your downloads to confirm the file was saved.</p><div className="mt-4 overflow-hidden rounded-2xl border border-border">{history.length ? history.map((backup) => <div key={backup.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 last:border-b-0"><div><p className="font-semibold">{new Date(backup.created_at).toLocaleString()}</p><p className="mt-1 text-sm text-muted-foreground">{backup.record_count.toLocaleString()} records · {backup.table_count} tables · {formatBytes(backup.archive_bytes)}</p></div><span className={backup.status === 'download_confirmed' ? 'rounded-full bg-success-subtle px-3 py-1 text-xs font-bold text-success' : 'rounded-full bg-card px-3 py-1 text-xs font-bold text-muted-foreground'}>{backup.status === 'download_confirmed' ? 'Download started' : 'Prepared'}</span></div>) : <p className="p-5 text-sm text-muted-foreground">No laptop backups yet.</p>}</div></div></section>
}
