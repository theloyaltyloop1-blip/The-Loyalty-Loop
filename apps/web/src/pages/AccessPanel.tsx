import * as React from 'react'
import { Navigate, Link } from 'react-router-dom'
import { CheckCircle2, Download, LockKeyhole, ShieldCheck, XCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { fetchPlatformHealth } from '@/lib/platform-health'
import { AccessTools } from '@/pages/AccessTools'
import { BarePageSkeleton } from '@/components/page-skeleton'
import { fetchAdminSupportRequests, fetchPendingVerifications, resolveSupportRequest, reviewBusinessVerification, type PendingVerification, type SupportRequest } from '@/lib/businesses'

type Tab = 'overview' | 'analytics' | 'controls' | 'verifications' | 'support' | 'backups'
type Health = { label: string; detail: string; ok: boolean; targetTab?: Tab }
type UsageEvent = { event_name: string; surface: string; events: number; people: number; last_seen: string }

const tabLabels: Record<Tab, string> = {
  overview: 'System overview', analytics: 'Product analytics', controls: 'Platform controls', verifications: 'Business listings', support: 'Owner support', backups: 'Laptop backups',
}

export function AccessPanel() {
  const { session, loading, rolesLoading, primaryRole, signOut } = useAuth()
  const [tab, setTab] = React.useState<Tab>('overview')
  const [health, setHealth] = React.useState<Health[]>([])
  const [selectedHealth, setSelectedHealth] = React.useState<Health | null>(null)
  const [verifications, setVerifications] = React.useState<PendingVerification[]>([])
  const [support, setSupport] = React.useState<SupportRequest[]>([])
  const [usage, setUsage] = React.useState<UsageEvent[]>([])
  const [busy, setBusy] = React.useState(true)

  const load = React.useCallback(async () => {
    setBusy(true)
    const tableChecks = await Promise.all(['businesses', 'memberships', 'transactions', 'rewards', 'announcements', 'reviews', 'support_requests'].map(async (label) => {
      const { count, error } = await supabase.from(label).select('*', { head: true, count: 'exact' })
      const targetTab = label === 'businesses' ? 'verifications' : label === 'support_requests' ? 'support' : undefined
      return { label, ok: !error, targetTab, detail: error ? error.message : `${count ?? 0} records reachable` }
    }))
    const [storage, functionChecks, pending, requests, usageData] = await Promise.all([
      supabase.storage.from('logos').list('', { limit: 1 }).then(({ error }) => ({ label: 'Storage', ok: !error, detail: error ? error.message : 'Logo storage bucket reachable' })),
      fetchPlatformHealth().catch((error) => [{ label: 'Platform health function', ok: false, detail: error instanceof Error ? error.message : 'Unavailable' }]),
      fetchPendingVerifications().catch(() => []),
      fetchAdminSupportRequests().catch(() => []),
      (async () => { const { data } = await supabase.rpc('admin_usage_analytics', { _days: 30 }); return (data || []) as UsageEvent[] })().catch(() => []),
    ])
    setHealth([...tableChecks, storage, ...functionChecks])
    setVerifications(pending)
    setSupport(requests)
    setUsage(usageData)
    setBusy(false)
  }, [])

  React.useEffect(() => { if (primaryRole === 'admin') void load() }, [primaryRole, load])
  if (loading || rolesLoading) return <BarePageSkeleton />
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
    <main className="w-full flex-1 p-4 sm:p-6 lg:max-w-6xl lg:p-10">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs uppercase tracking-wide text-white/40">Platform operations</p><h1 className="font-display text-3xl font-extrabold sm:text-4xl">{tabLabels[tab]}</h1></div><button data-press-feedback onClick={() => void load()} className="w-fit rounded-xl border border-white/15 px-4 py-2 text-sm font-bold">Refresh</button></div>
      {busy ? <p className="text-white/50">Checking systems…</p> : tab === 'controls' ? <AccessTools /> : tab === 'overview' ? <Overview health={health} selected={selectedHealth} onSelect={setSelectedHealth} onRefresh={load} onOpenTab={(next) => { setTab(next); setSelectedHealth(null) }} /> : tab === 'analytics' ? <ProductAnalytics items={usage} /> : tab === 'verifications' ? <VerificationQueue items={verifications} refresh={load} /> : tab === 'support' ? <SupportQueue items={support} refresh={load} /> : <LaptopBackups />}
    </main>
  </div>
}

function ProductAnalytics({ items }: { items: UsageEvent[] }) {
  const total = items.reduce((sum, item) => sum + Number(item.events), 0)
  const people = Math.max(0, ...items.map((item) => Number(item.people)))
  return <section><div className="grid gap-4 sm:grid-cols-2"><article className="rounded-2xl bg-white/6 p-5"><p className="text-sm text-white/55">Tracked actions, last 30 days</p><p className="mt-2 font-display text-4xl font-bold">{total}</p></article><article className="rounded-2xl bg-white/6 p-5"><p className="text-sm text-white/55">Most users on one feature</p><p className="mt-2 font-display text-4xl font-bold">{people}</p></article></div><p className="mt-6 text-sm text-white/55">Only people who opt in are included. Events never include passwords, emails, QR codes or message content.</p><div className="mt-4 overflow-x-auto rounded-2xl border border-white/10"><table className="w-full min-w-[560px] text-left text-sm"><thead className="border-b border-white/10 text-white/45"><tr><th className="p-4">Feature</th><th className="p-4">Where</th><th className="p-4">Uses</th><th className="p-4">People</th><th className="p-4">Last used</th></tr></thead><tbody>{items.length ? items.map((item) => <tr key={`${item.surface}-${item.event_name}`} className="border-b border-white/5"><td className="p-4 font-semibold">{item.event_name.replaceAll('_', ' ')}</td><td className="p-4 text-white/60">{item.surface.replaceAll('_', ' ')}</td><td className="p-4">{item.events}</td><td className="p-4">{item.people}</td><td className="p-4 text-white/60">{new Date(item.last_seen).toLocaleString()}</td></tr>) : <tr><td colSpan={5} className="p-5 text-white/55">No opted-in usage yet. It will appear here after people use the website or updated apps.</td></tr>}</tbody></table></div></section>
}

function Overview({ health, selected, onSelect, onRefresh, onOpenTab }: { health: Health[]; selected: Health | null; onSelect: (item: Health | null) => void; onRefresh: () => Promise<void>; onOpenTab: (tab: Tab) => void }) {
  return <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{health.map((item) => <button data-press-feedback key={item.label} type="button" onClick={() => onSelect(item)} className={'rounded-2xl border p-5 text-left transition-transform duration-150 ease-out active:scale-[0.99] ' + (item.ok ? 'border-fun-green/40 bg-[#1E2820]' : 'border-red-500/50 bg-[#351B1B]')}><div className="flex justify-between gap-3"><p className="font-bold">{item.label}</p>{item.ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[#5ACA64]" /> : <XCircle className="h-5 w-5 shrink-0 text-red-400" />}</div><p className="mt-3 break-words text-sm text-white/60">{item.detail}</p><p className="mt-4 text-xs font-bold text-white/45">View actions →</p></button>)}</div>
    {selected && <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{selected.label}</p><p className="mt-1 text-sm text-white/60">{selected.detail}</p></div><button data-press-feedback onClick={() => onSelect(null)} className="rounded-lg px-2 py-1 text-sm text-white/60">Close</button></div><div className="mt-4 flex flex-wrap gap-2"><button data-press-feedback onClick={() => void onRefresh()} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold">Run check again</button>{selected.targetTab && <button data-press-feedback onClick={() => onOpenTab(selected.targetTab!)} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold">Open related queue</button>}{selected.label === 'Storage' && <a href="https://supabase.com/dashboard/project/tgukdabfvvoywawmzbdo/storage/buckets" target="_blank" rel="noreferrer" className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold">Open Storage</a>}{selected.label === 'Platform health function' && <a href="https://supabase.com/dashboard/project/tgukdabfvvoywawmzbdo/functions/platform-health" target="_blank" rel="noreferrer" className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold">Open function</a>}</div></section>}</>
}

function VerificationQueue({ items, refresh }: { items: PendingVerification[]; refresh: () => Promise<void> }) {
  return <div className="grid gap-4">{items.length ? items.map((item) => <article key={item.id} className="rounded-2xl bg-white/6 p-4 sm:p-5"><p className="font-bold">{item.name}</p><p className="break-all text-sm text-white/55">{item.owner_email}</p><div className="mt-3 flex flex-wrap gap-2"><button data-press-feedback onClick={async () => { await reviewBusinessVerification(item.id, true); void refresh() }} className="rounded-xl bg-fun-green px-4 py-2 text-sm font-bold">Approve</button><button data-press-feedback onClick={async () => { const reason = prompt('Rejection reason') || ''; if (reason) { await reviewBusinessVerification(item.id, false, reason); void refresh() } }} className="rounded-xl border border-red-400/50 px-4 py-2 text-sm font-bold text-red-300">Reject</button></div></article>) : <p className="text-white/55">No listings waiting.</p>}</div>
}

function SupportQueue({ items, refresh }: { items: SupportRequest[]; refresh: () => Promise<void> }) {
  const open = items.filter((item) => item.status === 'open')
  return <div className="grid gap-4">{open.length ? open.map((item) => <article key={item.id} className="rounded-2xl bg-white/6 p-4 sm:p-5"><p className="font-bold">{item.subject}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm text-white/60">{item.body}</p><button data-press-feedback onClick={async () => { await resolveSupportRequest(item.id); void refresh() }} className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-bold">Resolve</button></article>) : <p className="text-white/55">No open support requests.</p>}</div>
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
      await supabase.functions.invoke('export-platform-backup', { body: { action: 'confirm_download', backup_id: data.backup.id } })
      setMessage(`Encrypted backup downloaded. It contains ${data.backup.record_count.toLocaleString()} records from ${data.backup.table_count} tables.`)
      setPassphrase('')
      setConfirmation('')
      await loadHistory()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The backup could not be created.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="max-w-3xl"><div className="rounded-2xl border border-white/10 bg-white/6 p-5 sm:p-7"><div className="flex gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary"><LockKeyhole className="h-5 w-5" /></span><div><h2 className="font-display text-2xl font-bold">Encrypted backup for this laptop</h2><p className="mt-2 text-sm leading-6 text-white/65">Create a recovery copy of the Loyalty Loop application data and save it on this device. The encryption password stays only with you—we cannot recover it.</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Encryption password<input value={passphrase} onChange={(event) => setPassphrase(event.target.value)} type="password" autoComplete="new-password" className="mt-2 h-11 w-full rounded-xl border border-white/15 bg-black/20 px-3 text-white outline-none focus:border-primary" placeholder="At least 12 characters" /></label><label className="text-sm font-semibold">Repeat password<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} type="password" autoComplete="new-password" className="mt-2 h-11 w-full rounded-xl border border-white/15 bg-black/20 px-3 text-white outline-none focus:border-primary" placeholder="Repeat it exactly" /></label></div><p className="mt-4 text-xs leading-5 text-white/50">Includes the recovery data needed for accounts, shops, loyalty cards, stamps, rewards, reviews and promotions. It deliberately excludes passwords, service secrets, uploaded file bytes, WhatsApp chats, push tokens and support messages. Keep the backup file and its password separately and securely.</p>{error && <p className="mt-4 text-sm text-red-300">{error}</p>}{message && <p className="mt-4 text-sm text-[#8de39a]">{message}</p>}<button data-press-feedback disabled={busy} onClick={() => void createBackup()} className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold disabled:opacity-60"><Download className="h-4 w-4" />{busy ? 'Preparing encrypted backup…' : 'Download encrypted backup'}</button></div><div className="mt-6"><h2 className="font-display text-xl font-bold">Backup history</h2><p className="mt-1 text-sm text-white/55">This shows exports prepared from the admin panel. “Saved to laptop” is confirmed after the download starts.</p><div className="mt-4 overflow-hidden rounded-2xl border border-white/10">{history.length ? history.map((backup) => <div key={backup.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-4 last:border-b-0"><div><p className="font-semibold">{new Date(backup.created_at).toLocaleString()}</p><p className="mt-1 text-sm text-white/55">{backup.record_count.toLocaleString()} records · {backup.table_count} tables · {formatBytes(backup.archive_bytes)}</p></div><span className={backup.status === 'download_confirmed' ? 'rounded-full bg-[#1E4A29] px-3 py-1 text-xs font-bold text-[#8de39a]' : 'rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/60'}>{backup.status === 'download_confirmed' ? 'Saved to laptop' : 'Prepared'}</span></div>) : <p className="p-5 text-sm text-white/55">No laptop backups yet.</p>}</div></div></section>
}
