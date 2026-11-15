import * as React from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ChevronRight, ChevronDown, Check, Store, MessageSquareWarning, LifeBuoy, TriangleAlert, Activity, Database, Compass, HardDrive, ScrollText, PauseCircle, SlidersHorizontal, Smartphone, type LucideIcon } from 'lucide-react'
import type { DashboardStats } from '@/lib/admin'
import { BarList, SurfaceShare, summariseUsage, type AdminUsage } from '@/components/admin-dashboard'

const num = (v: number) => v.toLocaleString('en-GB')
const sentence = (v: string) => v.replaceAll('_', ' ')
const ICON = { size: 18, strokeWidth: 1.5, 'aria-hidden': true } as const

export type AdminTab = 'overview' | 'analytics' | 'controls' | 'verifications' | 'support' | 'moderation' | 'backups' | 'features' | 'trending' | 'shop-requests' | 'users' | 'businesses' | 'loyalty' | 'audit' | 'release-emails'
export type OverviewHealth = { count?: number; label: string; detail: string; ok: boolean; targetTab?: AdminTab }
type QueueKey = 'verifications' | 'support' | 'moderation'
export type OverviewQueue = { key: QueueKey; label: string; count: number; unavailable: boolean; hint: string }
export type ActivityRow = { id: string; title: string; sub: string; at: string; pill: 'Pending' | 'Open' | 'Reported'; tab: QueueKey }

/* ---------- 1. Act: what is waiting on a person ---------- */
const queueIcon: Record<QueueKey, LucideIcon> = { verifications: Store, support: LifeBuoy, moderation: MessageSquareWarning }
const statusTone = { Pending: 'is-info', Open: 'is-warn', Reported: 'is-bad' } as const

export function NeedsYou({ queues, failing, activity, onOpen, onOpenChecks }: { queues: OverviewQueue[]; failing: OverviewHealth[]; activity: ActivityRow[]; onOpen: (tab: AdminTab) => void; onOpenChecks: () => void }) {
  const waiting = queues.reduce((sum, q) => sum + (q.unavailable ? 0 : q.count), 0)
  return <section className="ag-glass ag-sec" aria-labelledby="ag-needs-h">
    <div className="ag-sec-head">
      <div><h2 id="ag-needs-h">Needs you</h2><p>Decisions only you can make</p></div>
      <span className="ag-meta">{waiting === 0 ? 'Nothing waiting' : `${num(waiting)} waiting`}{failing.length > 0 && <> · <b>{failing.length} {failing.length === 1 ? 'check' : 'checks'} failing</b></>}</span>
    </div>
    {failing.length > 0 && <div role="alert" className="ag-alert">
      <TriangleAlert {...ICON}/>
      <div><strong>{failing.length === 1 ? 'A system check is failing' : `${failing.length} system checks are failing`}</strong>
        <ul>{failing.map(f => <li key={f.label}><b>{sentence(f.label)}</b>: {f.detail}</li>)}</ul></div>
      <button type="button" className="ag-btn" onClick={onOpenChecks}>See checks</button>
    </div>}
    <div className="ag-act">
      <ul className="ag-ledger">{queues.map(q => {
        const Icon = queueIcon[q.key]
        return <li key={q.key}><button type="button" onClick={() => onOpen(q.key)} className={q.count === 0 && !q.unavailable ? 'is-zero' : undefined}>
          <Icon {...ICON}/>
          <span><strong>{q.label}</strong><small>{q.unavailable ? 'Could not load' : q.count === 0 ? 'Nothing waiting' : q.hint}</small></span>
          <em>{q.unavailable ? '?' : num(q.count)}</em>
          <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true"/>
        </button></li>
      })}</ul>
      <div className="ag-latest">
        <p>Latest</p>
        {activity.length ? <ul>{activity.map(r => <li key={r.id}><button type="button" onClick={() => onOpen(r.tab)}><span><strong>{r.title}</strong><small>{r.sub}</small></span><span className={`ag-status ${statusTone[r.pill]}`}>{r.pill}</span><time dateTime={r.at}>{new Date(r.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</time></button></li>)}</ul>
          : <div className="ag-quiet"><Check {...ICON}/><span>No listings, support requests or reported reviews are waiting</span></div>}
      </div>
    </div>
  </section>
}

/* ---------- 2. Monitor: is the platform growing ---------- */
function LineChart({ points }: { points: { day: string; value: number }[] }) {
  const W = 800, H = 280, TOP = 8, BASE = H - 1
  const peak = Math.max(1, ...points.map(p => p.value))
  // Round the axis up to a tidy number so the labels read cleanly.
  const unit = 10 ** Math.max(0, String(Math.ceil(peak)).length - 1)
  const max = Math.ceil(peak / (unit / 2)) * (unit / 2)
  const step = points.length > 1 ? W / (points.length - 1) : 0
  const xy = points.map((p, i) => [i * step, BASE - (p.value / max) * (BASE - TOP)] as const)
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = xy.length ? `${line} L${xy[xy.length - 1][0].toFixed(1)} ${BASE} L0 ${BASE} Z` : ''
  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return <div className="ag-line">
    <div className="ag-line-y" aria-hidden="true"><span>{num(max)}</span><span>{num(max / 2)}</span><span>0</span></div>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Transactions per day over ${points.length} days, peak ${num(peak)}`} preserveAspectRatio="none">
      {[TOP, TOP + (BASE - TOP) / 2, BASE].map(y => <line key={y} x1="0" x2={W} y1={y} y2={y} stroke="var(--ag-hair)" vectorEffect="non-scaling-stroke"/>)}
      {area && <path d={area} fill="var(--ag-accent)" fillOpacity=".07"/>}
      {line && <path d={line} fill="none" stroke="var(--ag-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>}
    </svg>
    <div className="ag-line-x" aria-hidden="true">{points.length > 0 && <><span>{fmt(points[0].day)}</span><span>{fmt(points[Math.floor(points.length / 2)].day)}</span><span>{fmt(points[points.length - 1].day)}</span></>}</div>
  </div>
}

export function Pulse({ stats, unavailable, counts }: { stats: DashboardStats | null; unavailable: boolean; counts: Record<string, number> }) {
  const [range, setRange] = React.useState<7 | 14>(14)
  const series = (stats?.series ?? []).map(s => ({ day: s.day, value: Number(s.transactions) }))
  const shown = series.slice(-range)
  const sum = shown.reduce((a, p) => a + p.value, 0)
  const half = Math.floor(shown.length / 2)
  const delta = shown.slice(half).reduce((a, p) => a + p.value, 0) - shown.slice(0, half).reduce((a, p) => a + p.value, 0)
  const figures: { label: string; value: number | undefined; sub: string }[] = [
    { label: 'Accounts', value: stats?.users, sub: stats ? `${num(stats.new_users_7d)} new this week` : 'Shoppers, owners and staff' },
    { label: 'Businesses', value: counts.businesses, sub: stats ? `${num(stats.businesses_pending)} pending approval` : 'All shops' },
    { label: 'Memberships', value: counts.memberships, sub: 'Shoppers joined to shops' },
    { label: 'Transactions', value: counts.transactions, sub: 'All time' },
    { label: 'Rewards', value: counts.rewards, sub: stats ? `${num(stats.rewards_redeemed)} redeemed` : 'All time' },
  ]
  return <section className="ag-glass ag-sec" aria-labelledby="ag-pulse-h">
    <div className="ag-sec-head"><div><h2 id="ag-pulse-h">Platform pulse</h2><p>{unavailable ? 'Platform totals could not be loaded' : 'Totals today and transactions over time'}</p></div></div>
    <dl className="ag-stats">{figures.map(f => <div key={f.label}><dt>{f.label}</dt><dd>{f.value === undefined ? '–' : num(f.value)}</dd><small>{f.sub}</small></div>)}</dl>
    <div className="ag-chart-head">
      <div><h3 className="ag-sub">Transactions, last {range} days</h3>
        <div className="ag-figure"><strong>{shown.length ? num(sum) : '–'}</strong>{half > 0 && <span className={delta >= 0 ? 'ag-up' : 'ag-down'}>{delta >= 0 ? '+' : '−'}{num(Math.abs(delta))} vs the {half} days before</span>}</div></div>
      <div className="ag-seg" role="group" aria-label="Chart range"><button type="button" aria-pressed={range === 7} onClick={() => setRange(7)}>7 days</button><button type="button" aria-pressed={range === 14} onClick={() => setRange(14)}>14 days</button></div>
    </div>
    {shown.length ? <LineChart points={shown}/> : <div className="ag-chart-empty">{unavailable ? 'Chart unavailable' : 'No transactions yet'}</div>}
  </section>
}

/* ---------- 3. Understand: what people actually use ---------- */
export function UsageSnapshot({ items, unavailable, onOpenInsights }: { items: AdminUsage[]; unavailable: boolean; onOpenInsights: () => void }) {
  const { featureRows, surfaceRows, total } = summariseUsage(items)
  return <section className="ag-glass ag-sec" aria-labelledby="ag-usage-h">
    <div className="ag-sec-head">
      <div><h2 id="ag-usage-h">What people use</h2><p>Opted-in activity, last 30 days</p></div>
      <button type="button" className="ag-btn" onClick={onOpenInsights}>Open Insights</button>
    </div>
    {unavailable ? <div className="ag-empty" role="status"><strong>Analytics unavailable</strong><span>Refresh to try again</span></div> : <div className="ag-usage">
      <div><h3 className="ag-h3">Top features</h3><BarList rows={featureRows.slice(0, 5)}/></div>
      <div><h3 className="ag-h3">By app</h3><SurfaceShare rows={surfaceRows} total={total}/></div>
    </div>}
  </section>
}

/* ---------- 4. Maintain: rarely needed, folded away ---------- */
function Fold({ id, icon: Icon, title, summary, aside, open, onToggle, children }: { id: string; icon: LucideIcon; title: string; summary: string; aside?: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return <div className="ag-fold" id={id}>
    <button type="button" className="ag-fold-bar" aria-expanded={open} aria-controls={`${id}-body`} onClick={onToggle}>
      <Icon {...ICON}/>
      <span className="ag-fold-text"><strong>{title}</strong><small>{summary}</small></span>
      {aside}
      <ChevronDown size={16} strokeWidth={1.5} className="ag-chevron" aria-hidden="true"/>
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
  return <section className="ag-glass ag-base" aria-labelledby="ag-house-h">
    <div className="ag-sec-head"><div><h2 id="ag-house-h">Housekeeping</h2><p>Nothing here needs you unless a check fails</p></div></div>
    <Fold id="ag-checks" icon={Activity} title="System checks" summary={allOk ? 'Everything is reachable and configured' : 'Some checks need attention'} open={isOpen('checks')} onToggle={() => toggle('checks')}
      aside={<><span className="ag-stamps" aria-hidden="true">{health.map(h => <i key={h.label} className={h.ok ? undefined : 'is-bad'}/>)}</span><span className="ag-meta">{passing} of {health.length} passing</span></>}>
      <div className="ag-checks">{health.map(item => <button key={item.label} type="button" aria-pressed={selected?.label === item.label} onClick={() => setSelected(item)} className={'ag-check' + (item.ok ? '' : ' is-bad')}><i role="img" aria-label={item.ok ? 'Passing' : 'Failing'}/><strong>{sentence(item.label)}</strong><small>{item.detail}</small></button>)}</div>
      {selected && <div className="ag-check-detail"><strong>{sentence(selected.label)}</strong><p>{selected.detail}</p>
        <div className="ag-row">
          <button type="button" data-press-feedback onClick={() => void onRefresh()} className="ag-btn is-primary">Run checks again</button>
          {selected.targetTab && <button type="button" data-press-feedback onClick={() => onOpen(selected.targetTab!)} className="ag-btn">Open related queue</button>}
          {selected.label === 'Storage' && <a href="https://supabase.com/dashboard/project/tgukdabfvvoywawmzbdo/storage/buckets" target="_blank" rel="noreferrer" className="ag-btn">Open Storage</a>}
          {selected.label === 'Platform health function' && <a href="https://supabase.com/dashboard/project/tgukdabfvvoywawmzbdo/functions/platform-health" target="_blank" rel="noreferrer" className="ag-btn">Open function</a>}
          <button type="button" data-press-feedback onClick={() => setSelected(null)} className="ag-btn">Close</button>
        </div></div>}
    </Fold>
    <Fold id="ag-records" icon={Database} title="Records by table" summary={`${records.length} tables reachable`} open={isOpen('records')} onToggle={() => toggle('records')}>
      <dl className="ag-records">{records.map(([name, value]) => <div key={name}><dt>{sentence(name)}</dt><dd>{num(value)}</dd></div>)}</dl>
    </Fold>
    <Fold id="ag-shortcuts" icon={Compass} title="Shortcuts" summary="Backups, audit log, controls and the other apps" open={isOpen('shortcuts')} onToggle={() => toggle('shortcuts')}>
      <div className="ag-links">
        {shortcuts.map(s => { const Icon = s.icon; return <button key={s.tab} type="button" onClick={() => onOpen(s.tab)}><Icon {...ICON}/><span><strong>{s.title}</strong><small>{s.sub}</small></span><ChevronRight size={16} strokeWidth={1.5} aria-hidden="true"/></button> })}
        <Link to="/dashboard"><Smartphone {...ICON}/><span><strong>Customer app</strong><small>Open as a shopper</small></span><ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true"/></Link>
        <Link to="/owner"><Store {...ICON}/><span><strong>Business app</strong><small>Open as an owner</small></span><ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true"/></Link>
      </div>
    </Fold>
  </section>
}
