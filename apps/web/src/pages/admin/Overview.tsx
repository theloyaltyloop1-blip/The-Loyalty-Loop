import * as React from 'react'
import { ArrowUpRight, ArrowUp, ArrowDown, CheckCircle2, XCircle, Store, MessageSquareWarning, LifeBuoy, PartyPopper, ChevronDown, TriangleAlert } from 'lucide-react'
import type { DashboardStats } from '@/lib/admin'

const num = (v: number) => v.toLocaleString()

export type OverviewHealth = { count?: number; label: string; detail: string; ok: boolean }
export type OverviewQueue = { key: 'verifications' | 'support' | 'moderation'; label: string; count: number; unavailable: boolean; hint: string }
export type ActivityRow = { id: string; title: string; sub: string; at: string; pill: 'Pending' | 'Open' | 'Reported'; tab: 'verifications' | 'support' | 'moderation' }

/* ---------- 1. Needs you today ---------- */
const tileIcon = { verifications: Store, support: LifeBuoy, moderation: MessageSquareWarning }

export function NeedsYou({ queues, failing, onOpen, onOpenChecks, retryNeeded }: { queues: OverviewQueue[]; failing: OverviewHealth[]; onOpen: (key: OverviewQueue['key']) => void; onOpenChecks: () => void; retryNeeded: boolean }) {
  const waiting = queues.reduce((s, q) => s + (q.unavailable ? 0 : q.count), 0)
  const clear = waiting === 0 && failing.length === 0 && !queues.some(q => q.unavailable)
  return <section className="ad-needs" aria-labelledby="ad-needs-h">
    <div className="ad-needs-head">
      <h2 id="ad-needs-h">Needs you today</h2>
      <span className={'ad-pill ' + (clear ? 'is-ok' : 'is-warn')}>{clear ? 'All clear' : `${waiting} waiting${failing.length ? ` · ${failing.length} check${failing.length > 1 ? 's' : ''} failing` : ''}`}</span>
    </div>
    {failing.length > 0 && <div role="alert" className="ad-failing">
      <TriangleAlert size={18} aria-hidden="true"/>
      <div><strong>{failing.length === 1 ? 'A system check is failing' : `${failing.length} system checks are failing`}</strong>
        <ul>{failing.map(f => <li key={f.label}><b>{f.label.replaceAll('_', ' ')}</b>: {f.detail}</li>)}</ul></div>
      <button type="button" onClick={onOpenChecks}>See checks</button>
    </div>}
    {clear ? <div className="ad-caught-up"><span aria-hidden="true"><PartyPopper size={26}/></span><div><strong>You’re all caught up</strong><p>No listings, support requests or reported reviews are waiting.</p></div></div>
      : <div className="ad-tiles">{queues.map(q => {
        const Icon = tileIcon[q.key]
        return <button key={q.key} type="button" onClick={() => onOpen(q.key)} className={`ad-tile ad-tile-${q.key}${q.count === 0 && !q.unavailable ? ' is-zero' : ''}`}>
          <span className="ad-tile-icon" aria-hidden="true"><Icon size={20}/></span>
          <span className="ad-tile-count">{q.unavailable ? '?' : num(q.count)}</span>
          <span className="ad-tile-label">{q.label}</span>
          <span className="ad-tile-hint">{q.unavailable ? 'Could not load' : q.count === 0 ? 'Nothing waiting' : q.hint}</span>
          <ArrowUpRight className="ad-tile-go" size={18} aria-hidden="true"/>
        </button>
      })}</div>}
    {retryNeeded && !clear && null}
  </section>
}

/* ---------- 2. Hero ---------- */
function LineChart({ points }: { points: { day: string; value: number }[] }) {
  const W = 640, H = 200, P = 8
  const max = Math.max(1, ...points.map(p => p.value))
  const step = points.length > 1 ? (W - P * 2) / (points.length - 1) : 0
  const xy = points.map((p, i) => [P + i * step, H - 22 - (p.value / max) * (H - 50)] as const)
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = xy.length ? `${line} L${xy[xy.length - 1][0].toFixed(1)} ${H - 22} L${xy[0][0].toFixed(1)} ${H - 22} Z` : ''
  const last = xy[xy.length - 1]
  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return <div className="ad-line">
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Transactions per day, ${points.length} days, peak ${num(max)}`} preserveAspectRatio="none">
      <defs><linearGradient id="ad-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--ad-hero-line)" stopOpacity=".38"/><stop offset="1" stopColor="var(--ad-hero-line)" stopOpacity="0"/></linearGradient></defs>
      {[0, 1, 2].map(i => <line key={i} x1="0" x2={W} y1={H - 22 - i * ((H - 50) / 2)} y2={H - 22 - i * ((H - 50) / 2)} stroke="var(--ad-hero-grid)" strokeDasharray="4 6"/>)}
      {area && <path d={area} fill="url(#ad-area)"/>}
      {line && <path d={line} fill="none" stroke="var(--ad-hero-line)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>}
      {last && <circle cx={last[0]} cy={last[1]} r="5" fill="var(--ad-hero-line)" stroke="var(--ad-hero-bg)" strokeWidth="3"/>}
    </svg>
    <div className="ad-line-axis" aria-hidden="true">{points.length > 0 && <><span>{fmt(points[0].day)}</span><span>{fmt(points[Math.floor(points.length / 2)].day)}</span><span>{fmt(points[points.length - 1].day)}</span></>}</div>
  </div>
}

export function Hero({ stats, unavailable, counts }: { stats: DashboardStats | null; unavailable: boolean; counts: Record<string, number>; }) {
  const [range, setRange] = React.useState<7 | 14>(14)
  const series = (stats?.series ?? []).map(s => ({ day: s.day, value: Number(s.transactions) }))
  const shown = series.slice(-range)
  const sum = shown.reduce((a, p) => a + p.value, 0)
  const half = Math.floor(shown.length / 2)
  const recent = shown.slice(half).reduce((a, p) => a + p.value, 0)
  const before = shown.slice(0, half).reduce((a, p) => a + p.value, 0)
  const delta = recent - before
  const strip: { label: string; value: number | undefined; sub: string; dir: 'up' | 'down' | 'flat'; tab?: string }[] = [
    { label: 'Businesses', value: counts.businesses, sub: stats ? `${num(stats.businesses_pending)} pending approval` : 'All records', dir: 'flat' },
    { label: 'Memberships', value: counts.memberships, sub: 'Shop memberships', dir: 'flat' },
    { label: 'Transactions', value: counts.transactions, sub: stats ? `${num(sum)} in ${range} days` : 'All records', dir: sum > 0 ? 'up' : 'flat' },
    { label: 'Rewards', value: counts.rewards, sub: stats ? `${num(stats.rewards_redeemed)} redeemed` : 'All records', dir: 'flat' },
  ]
  return <section className="ad-hero" aria-label="Platform summary">
    <div className="ad-hero-top">
      <div className="ad-hero-copy">
        <div className="ad-hero-title"><span>Accounts on the platform</span>
          <div className="ad-seg ad-seg-hero" role="group" aria-label="Chart range"><button type="button" aria-pressed={range === 7} onClick={() => setRange(7)}>Week</button><button type="button" aria-pressed={range === 14} onClick={() => setRange(14)}>Fortnight</button></div></div>
        <div className="ad-hero-number">
          <strong>{stats ? num(stats.users) : '—'}</strong>
          {stats && <span className="ad-pill is-hero"><ArrowUp size={14} aria-hidden="true"/>{num(stats.new_users_7d)} new this week</span>}
        </div>
        <p>{unavailable ? 'Platform totals could not be loaded. Refresh to retry.' : 'Shoppers, owners and staff with an account. The chart shows transactions per day.'}</p>
      </div>
      <div className="ad-hero-chart">
        <div className="ad-hero-chart-head"><span>Transactions per day</span>{shown.length > 1 && <span className={'ad-trend ' + (delta >= 0 ? 'is-up' : 'is-down')}>{delta >= 0 ? <ArrowUp size={13} aria-hidden="true"/> : <ArrowDown size={13} aria-hidden="true"/>}{delta >= 0 ? '+' : ''}{num(delta)} vs earlier days</span>}</div>
        {shown.length ? <LineChart points={shown}/> : <div className="ad-hero-empty">{unavailable ? 'Chart unavailable' : 'No transactions yet'}</div>}
      </div>
    </div>
    <dl className="ad-strip">{strip.map(s => <div key={s.label}><dt>{s.label}</dt><dd><span>{s.value === undefined ? '—' : num(s.value)}</span>{s.dir === 'up' ? <ArrowUp size={18} className="is-up" aria-hidden="true"/> : <ArrowUpRight size={18} className="is-flat" aria-hidden="true"/>}</dd><small>{s.sub}</small></div>)}</dl>
  </section>
}

/* ---------- 3. Recent activity ---------- */
export function RecentActivity({ rows, onOpen }: { rows: ActivityRow[]; onOpen: (tab: ActivityRow['tab']) => void }) {
  return <section className="ad-card ad-recent">
    <div className="ad-card-head"><div><h3>Recent activity</h3><p>Newest items waiting on you</p></div></div>
    {rows.length ? <ul>{rows.map(r => <li key={r.id}><button type="button" onClick={() => onOpen(r.tab)}><span className="ad-recent-main"><strong>{r.title}</strong><small>{r.sub}</small></span><span className={`ad-pill is-${r.pill.toLowerCase()}`}>{r.pill}</span><time dateTime={r.at}>{new Date(r.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</time></button></li>)}</ul>
      : <div className="ad-empty"><CheckCircle2 size={26}/><strong>Nothing new</strong><span>Queue items will list here as they arrive.</span></div>}
  </section>
}

/* ---------- 4. System checks (collapsed) ---------- */
export function SystemChecks({ health, open, onToggle, selected, onSelect, onRefresh, onOpenTab }: { health: (OverviewHealth & { targetTab?: string })[]; open: boolean; onToggle: () => void; selected: OverviewHealth | null; onSelect: (h: OverviewHealth | null) => void; onRefresh: () => Promise<void>; onOpenTab: (tab: any) => void }) {
  const passing = health.filter(h => h.ok).length
  const allOk = passing === health.length
  const sel = selected as (OverviewHealth & { targetTab?: string }) | null
  return <section className="ad-card ad-checks" id="ad-system-checks">
    <button type="button" className="ad-checks-bar" aria-expanded={open} aria-controls="ad-checks-body" onClick={onToggle}>
      <span className={'ad-checks-icon ' + (allOk ? 'is-ok' : 'is-bad')} aria-hidden="true">{allOk ? <CheckCircle2 size={22}/> : <XCircle size={22}/>}</span>
      <span className="ad-checks-text"><strong>System checks</strong><small>{allOk ? 'Everything is reachable and configured' : 'Some checks need attention'}</small></span>
      <span className={'ad-pill ' + (allOk ? 'is-ok' : 'is-warn')}>{passing} / {health.length} passing</span>
      <ChevronDown size={18} className="ad-chevron" aria-hidden="true"/>
    </button>
    {open && <div id="ad-checks-body">
      <div className="ad-health-grid">{health.map(item => <button key={item.label} type="button" onClick={() => onSelect(item)} className={'ad-health ' + (item.ok ? '' : 'has-error')}><span>{item.label.replaceAll('_', ' ')}</span>{item.ok ? <CheckCircle2 size={16} aria-label="Passing"/> : <XCircle size={16} aria-label="Failing"/>}<p>{item.detail}</p></button>)}</div>
      {sel && <div className="ad-check-detail"><div><p className="font-bold">{sel.label}</p><p className="text-sm text-muted-foreground">{sel.detail}</p></div>
        <div className="ad-check-actions">
          <button data-press-feedback onClick={() => void onRefresh()} className="ad-btn is-primary">Run check again</button>
          {sel.targetTab && <button data-press-feedback onClick={() => onOpenTab(sel.targetTab)} className="ad-btn">Open related queue</button>}
          {sel.label === 'Storage' && <a href="https://supabase.com/dashboard/project/tgukdabfvvoywawmzbdo/storage/buckets" target="_blank" rel="noreferrer" className="ad-btn">Open Storage</a>}
          {sel.label === 'Platform health function' && <a href="https://supabase.com/dashboard/project/tgukdabfvvoywawmzbdo/functions/platform-health" target="_blank" rel="noreferrer" className="ad-btn">Open function</a>}
          <button data-press-feedback onClick={() => onSelect(null)} className="ad-btn">Close</button>
        </div></div>}
    </div>}
  </section>
}
