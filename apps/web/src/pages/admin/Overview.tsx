import * as React from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ArrowRight, ChevronRight, ChevronDown, Check, Store, MessageSquareWarning, LifeBuoy, TriangleAlert, TrendingUp, TrendingDown, Activity, Database, Compass, HardDrive, ScrollText, PauseCircle, SlidersHorizontal, Smartphone, type LucideIcon } from 'lucide-react'
import type { DashboardStats } from '@/lib/admin'
import { BarList, ShareRing, summariseUsage, type AdminUsage } from '@/components/admin-dashboard'

const num = (v: number) => v.toLocaleString('en-GB')
const sentence = (v: string) => v.replaceAll('_', ' ')
const ICON = { size: 18, strokeWidth: 1.75, 'aria-hidden': true } as const

export type AdminTab = 'overview' | 'analytics' | 'controls' | 'verifications' | 'support' | 'moderation' | 'backups' | 'features' | 'trending' | 'shop-requests' | 'users' | 'businesses' | 'loyalty' | 'audit' | 'release-emails' | 'outreach'
export type OverviewHealth = { count?: number; label: string; detail: string; ok: boolean; targetTab?: AdminTab }
type QueueKey = 'verifications' | 'support' | 'moderation'
export type OverviewQueue = { key: QueueKey; label: string; count: number; unavailable: boolean; hint: string }
export type ActivityRow = { id: string; title: string; sub: string; at: string; pill: 'Pending' | 'Open' | 'Reported'; tab: QueueKey }

const queueLook: Record<QueueKey, { icon: LucideIcon; tone: string; tag: string }> = {
  verifications: { icon: Store, tone: 'var(--ag-sky)', tag: 'is-info' },
  support: { icon: LifeBuoy, tone: 'var(--ag-peach)', tag: 'is-warn' },
  moderation: { icon: MessageSquareWarning, tone: 'var(--ag-rose)', tag: 'is-bad' },
}
const tone = (value: string) => ({ '--tone': value }) as React.CSSProperties

/* ---------- 1. Act: what is waiting on a person ---------- */
export function NeedsYou({ queues, failing, onOpen, onOpenChecks }: { queues: OverviewQueue[]; failing: OverviewHealth[]; onOpen: (tab: AdminTab) => void; onOpenChecks: () => void }) {
  const waiting = queues.reduce((sum, q) => sum + (q.unavailable ? 0 : q.count), 0)
  return <>
    {failing.length > 0 && <div role="alert" className="ag-alert">
      <TriangleAlert {...ICON}/>
      <div><strong>{failing.length === 1 ? 'A system check is failing' : `${failing.length} system checks are failing`}</strong>
        <ul>{failing.map(f => <li key={f.label}><b>{sentence(f.label)}</b>: {f.detail}</li>)}</ul></div>
      <button type="button" className="ag-btn is-sm" onClick={onOpenChecks}>See checks</button>
    </div>}
    <div className="ag-row-title"><h2 id="ag-needs-h">Needs you</h2><span>{waiting === 0 ? 'Nothing waiting' : `${num(waiting)} waiting on a decision`}</span></div>
    {queues.map(q => {
      const look = queueLook[q.key]
      const zero = q.count === 0 && !q.unavailable
      return <button key={q.key} type="button" onClick={() => onOpen(q.key)} className={'ag-card ag-tile' + (zero ? ' is-zero' : '')}>
        <span className="ag-disc" style={tone(look.tone)}><look.icon size={20} strokeWidth={1.75} aria-hidden="true"/></span>
        <span className={'ag-tag ' + (q.unavailable ? 'is-bad' : zero ? 'is-ok' : look.tag)}>{q.unavailable ? 'Could not load' : zero ? 'Clear' : 'Waiting'}</span>
        <span className="ag-tile-count">{q.unavailable ? '?' : num(q.count)}</span>
        <span className="ag-tile-label">{q.label}</span>
        <span className="ag-tile-hint">{q.unavailable ? 'Refresh to try again' : zero ? 'Nothing waiting' : q.hint}</span>
        <span className="ag-tile-go" aria-hidden="true"><ArrowUpRight size={18} strokeWidth={1.75}/></span>
      </button>
    })}
  </>
}

/* ---------- 2. Monitor: is the platform growing ---------- */
function LineChart({ points }: { points: { day: string; value: number }[] }) {
  const W = 800, H = 208, TOP = 28, BASE = H - 2
  const max = Math.max(1, ...points.map(p => p.value))
  const step = points.length > 1 ? W / (points.length - 1) : 0
  const xy = points.map((p, i) => [i * step, BASE - (p.value / max) * (BASE - TOP)] as const)
  // A smooth curve through the points (Catmull-Rom converted to cubic Béziers).
  let line = xy.length ? `M${xy[0][0]} ${xy[0][1].toFixed(1)}` : ''
  for (let i = 0; i < xy.length - 1; i++) {
    const p0 = xy[Math.max(0, i - 1)], p1 = xy[i], p2 = xy[i + 1], p3 = xy[Math.min(xy.length - 1, i + 2)]
    line += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  const last = xy[xy.length - 1]
  const lastPoint = points[points.length - 1]
  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const ticks = points.filter((_, i) => points.length <= 7 || (points.length - 1 - i) % 2 === 0)
  return <div className="ag-line">
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Transactions per day over ${points.length} days, peak ${num(max)}`} preserveAspectRatio="none">
        <defs><linearGradient id="ag-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#C8F25C" stopOpacity=".26"/><stop offset="1" stopColor="#C8F25C" stopOpacity="0"/></linearGradient></defs>
        {[TOP, TOP + (BASE - TOP) / 2, BASE].map(y => <line key={y} x1="0" x2={W} y1={y} y2={y} stroke="rgb(255 255 255 / .08)" strokeDasharray="3 6" vectorEffect="non-scaling-stroke"/>)}
        {line && <path d={`${line} L${W} ${BASE} L0 ${BASE} Z`} fill="url(#ag-area)"/>}
        {line && <path d={line} fill="none" stroke="#C8F25C" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>}
      </svg>
      {last && <><span className="ag-line-dot" style={{ top: `${last[1] / H * 100}%` }} aria-hidden="true"/>
        <span className="ag-line-tip" style={{ top: `${last[1] / H * 100}%` }} aria-hidden="true">{fmt(lastPoint.day)}<b>{num(lastPoint.value)}</b></span></>}
    </div>
    <div className="ag-line-x" aria-hidden="true">{ticks.map(p => <span key={p.day}>{fmt(p.day)}</span>)}</div>
  </div>
}

export function Pulse({ stats, unavailable, counts }: { stats: DashboardStats | null; unavailable: boolean; counts: Record<string, number> }) {
  const [range, setRange] = React.useState<7 | 14>(14)
  const series = (stats?.series ?? []).map(s => ({ day: s.day, value: Number(s.transactions) }))
  const shown = series.slice(-range)
  const sum = shown.reduce((a, p) => a + p.value, 0)
  const half = Math.floor(shown.length / 2)
  const before = shown.slice(0, half).reduce((a, p) => a + p.value, 0)
  const recent = shown.slice(half).reduce((a, p) => a + p.value, 0)
  const pct = before > 0 ? Math.round((recent - before) / before * 100) : null
  const strip: { label: string; value: number | undefined; sub: string; up?: boolean }[] = [
    { label: 'Accounts', value: stats?.users, sub: stats ? `${num(stats.new_users_7d)} new this week` : 'Shoppers, owners and staff', up: !!stats && stats.new_users_7d > 0 },
    { label: 'Businesses', value: counts.businesses, sub: stats ? `${num(stats.businesses_pending)} pending approval` : 'All shops' },
    { label: 'Memberships', value: counts.memberships, sub: 'Shoppers joined to shops' },
    { label: 'Rewards', value: counts.rewards, sub: stats ? `${num(stats.rewards_redeemed)} redeemed` : 'All time' },
  ]
  return <section className="ag-card ag-sec ag-hero" aria-labelledby="ag-pulse-h">
    <div className="ag-sec-head">
      <div><h2 id="ag-pulse-h">Platform pulse</h2><p>{unavailable ? 'Platform totals could not be loaded' : 'Stamps, points and rewards recorded across every shop'}</p></div>
      <div className="ag-seg" role="group" aria-label="Chart range"><button type="button" aria-pressed={range === 7} onClick={() => setRange(7)}>7 days</button><button type="button" aria-pressed={range === 14} onClick={() => setRange(14)}>14 days</button></div>
    </div>
    <div className="ag-hero-top">
      <div>
        <span className="ag-kicker">Transactions, last {range} days</span>
        <div className="ag-big"><strong>{shown.length ? num(sum) : '–'}</strong>
          {pct !== null && <span className={'ag-tag ' + (pct >= 0 ? 'is-ok' : 'is-bad')}>{pct >= 0 ? <TrendingUp size={14} strokeWidth={2} aria-hidden="true"/> : <TrendingDown size={14} strokeWidth={2} aria-hidden="true"/>}{pct >= 0 ? '+' : '−'}{Math.abs(pct)}%</span>}</div>
        {pct !== null && <p className="ag-hero-note">Compared with the {half} days before</p>}
      </div>
      {shown.length ? <LineChart points={shown}/> : <div className="ag-chart-empty">{unavailable ? 'Chart unavailable' : 'No transactions yet'}</div>}
    </div>
    <dl className="ag-strip">{strip.map(s => <div key={s.label}><dt>{s.label}</dt><dd>{s.up && <TrendingUp size={18} strokeWidth={2} aria-hidden="true"/>}{s.value === undefined ? '–' : num(s.value)}</dd><small>{s.sub}</small></div>)}</dl>
  </section>
}

export function Latest({ rows, onOpen }: { rows: ActivityRow[]; onOpen: (tab: AdminTab) => void }) {
  return <section className="ag-card ag-sec ag-aside" aria-labelledby="ag-latest-h">
    <div className="ag-sec-head"><div><h2 id="ag-latest-h">Latest</h2><p>Newest items in your queues</p></div></div>
    {rows.length ? <ul className="ag-latest">{rows.map(r => { const look = queueLook[r.tab]; return <li key={r.id}><button type="button" onClick={() => onOpen(r.tab)}>
      <span className="ag-disc" style={tone(look.tone)}><look.icon size={16} strokeWidth={1.75} aria-hidden="true"/></span>
      <span><strong>{r.title}</strong><small>{r.sub} · {new Date(r.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</small></span>
      <span className={`ag-tag ${look.tag}`}>{r.pill}</span>
    </button></li> })}</ul>
      : <div className="ag-quiet"><span className="ag-disc"><Check size={20} strokeWidth={2} aria-hidden="true"/></span><div><strong>All caught up</strong><p>No listings, support requests or reported reviews are waiting</p></div></div>}
  </section>
}

/* ---------- 3. Understand: what people actually use ---------- */
export function UsageSnapshot({ items, unavailable, onOpenInsights }: { items: AdminUsage[]; unavailable: boolean; onOpenInsights: () => void }) {
  const { featureRows, surfaceRows, total } = summariseUsage(items)
  return <>
    <section className="ag-card ag-sec ag-feat" aria-labelledby="ag-usage-h">
      <div className="ag-sec-head"><div><h2 id="ag-usage-h">What people use</h2><p>Top features by tracked actions, last 30 days</p></div>
        <button type="button" className="ag-btn is-sm" onClick={onOpenInsights}>Insights <ArrowRight size={14} strokeWidth={2} aria-hidden="true"/></button></div>
      {unavailable ? <div className="ag-empty" role="status"><strong>Analytics unavailable</strong><span>Refresh to try again</span></div> : <BarList rows={featureRows.slice(0, 5)}/>}
    </section>
    <section className="ag-card ag-sec ag-apps" aria-labelledby="ag-apps-h">
      <div className="ag-sec-head"><div><h2 id="ag-apps-h">By app</h2><p>Where the activity happens</p></div></div>
      {unavailable ? <div className="ag-empty" role="status"><strong>Analytics unavailable</strong><span>Refresh to try again</span></div> : <ShareRing rows={surfaceRows} total={total}/>}
    </section>
  </>
}

/* ---------- 4. Maintain: rarely needed, folded away ---------- */
function Fold({ id, icon: Icon, title, summary, aside, open, onToggle, children }: { id: string; icon: LucideIcon; title: string; summary: string; aside?: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return <div className="ag-fold" id={id}>
    <button type="button" className="ag-fold-bar" aria-expanded={open} aria-controls={`${id}-body`} onClick={onToggle}>
      <span className="ag-disc"><Icon {...ICON}/></span>
      <span className="ag-fold-text"><strong>{title}</strong><small>{summary}</small></span>
      {aside}
      <ChevronDown size={18} strokeWidth={1.75} className="ag-chevron" aria-hidden="true"/>
    </button>
    {open && <div id={`${id}-body`} className="ag-fold-body">{children}</div>}
  </div>
}

type FoldKey = 'checks' | 'records' | 'shortcuts'

export function Housekeeping({ health, counts, checksOpen, onChecksOpen, onRefresh, onOpen }: { health: OverviewHealth[]; counts: Record<string, number>; checksOpen: boolean; onChecksOpen: (open: boolean) => void; onRefresh: () => Promise<void>; onOpen: (tab: AdminTab) => void }) {
  const [openKey, setOpenKey] = React.useState<FoldKey | null>(null)
  const [selected, setSelected] = React.useState<OverviewHealth | null>(null)
  const passing = health.filter(h => h.ok).length
  const allOk = passing === health.length
  const isOpen = (key: FoldKey) => key === 'checks' ? checksOpen : openKey === key
  // One fold open at a time keeps this section short.
  const toggle = (key: FoldKey) => {
    const next = !isOpen(key)
    onChecksOpen(key === 'checks' && next)
    setOpenKey(key !== 'checks' && next ? key : null)
  }
  const records = Object.entries(counts)
  const shortcuts: { tab: AdminTab; icon: LucideIcon; title: string; sub: string }[] = [
    { tab: 'backups', icon: HardDrive, title: 'Laptop backups', sub: 'Encrypted recovery copy' },
    { tab: 'audit', icon: ScrollText, title: 'Audit log', sub: 'Who changed what' },
    { tab: 'controls', icon: SlidersHorizontal, title: 'Platform controls', sub: 'Switches and tools' },
    { tab: 'features', icon: PauseCircle, title: 'Paused features', sub: 'Built, then switched off' },
  ]
  return <>
    <div className="ag-row-title"><h2 id="ag-house-h">Housekeeping</h2><span>Nothing here needs you unless a check fails</span></div>
    <section className="ag-card ag-base" aria-labelledby="ag-house-h">
      <Fold id="ag-checks" icon={Activity} title="System checks" summary={allOk ? 'Everything is reachable and configured' : 'Some checks need attention'} open={isOpen('checks')} onToggle={() => toggle('checks')}
        aside={<span className={'ag-tag ' + (allOk ? 'is-ok' : 'is-bad')}>{passing} of {health.length} passing</span>}>
        <div className="ag-checks">{health.map(item => <button key={item.label} type="button" aria-pressed={selected?.label === item.label} onClick={() => setSelected(item)} className={'ag-check' + (item.ok ? '' : ' is-bad')}><i role="img" aria-label={item.ok ? 'Passing' : 'Failing'}/><strong>{sentence(item.label)}</strong><small>{item.detail}</small></button>)}</div>
        {selected && <div className="ag-check-detail"><strong>{sentence(selected.label)}</strong><p>{selected.detail}</p>
          <div className="ag-row">
            <button type="button" data-press-feedback onClick={() => void onRefresh()} className="ag-btn is-sm is-primary">Run checks again</button>
            {selected.targetTab && <button type="button" data-press-feedback onClick={() => onOpen(selected.targetTab!)} className="ag-btn is-sm">Open related queue</button>}
            {selected.label === 'Storage' && <a href="https://supabase.com/dashboard/project/tgukdabfvvoywawmzbdo/storage/buckets" target="_blank" rel="noreferrer" className="ag-btn is-sm">Open Storage</a>}
            {selected.label === 'Platform health function' && <a href="https://supabase.com/dashboard/project/tgukdabfvvoywawmzbdo/functions/platform-health" target="_blank" rel="noreferrer" className="ag-btn is-sm">Open function</a>}
            <button type="button" data-press-feedback onClick={() => setSelected(null)} className="ag-btn is-sm">Close</button>
          </div></div>}
      </Fold>
      <Fold id="ag-records" icon={Database} title="Records by table" summary={`${records.length} tables reachable`} open={isOpen('records')} onToggle={() => toggle('records')}>
        <dl className="ag-records">{records.map(([name, value]) => <div key={name}><dt>{sentence(name)}</dt><dd>{num(value)}</dd></div>)}</dl>
      </Fold>
      <Fold id="ag-shortcuts" icon={Compass} title="Shortcuts" summary="Backups, audit log, controls and the other apps" open={isOpen('shortcuts')} onToggle={() => toggle('shortcuts')}>
        <div className="ag-links">
          {shortcuts.map(s => { const Icon = s.icon; return <button key={s.tab} type="button" onClick={() => onOpen(s.tab)}><Icon {...ICON}/><span><strong>{s.title}</strong><small>{s.sub}</small></span><ChevronRight size={16} strokeWidth={1.75} aria-hidden="true"/></button> })}
          <Link to="/dashboard"><Smartphone {...ICON}/><span><strong>Customer app</strong><small>Open as a shopper</small></span><ArrowUpRight size={16} strokeWidth={1.75} aria-hidden="true"/></Link>
          <Link to="/owner"><Store {...ICON}/><span><strong>Business app</strong><small>Open as an owner</small></span><ArrowUpRight size={16} strokeWidth={1.75} aria-hidden="true"/></Link>
        </div>
      </Fold>
    </section>
  </>
}
