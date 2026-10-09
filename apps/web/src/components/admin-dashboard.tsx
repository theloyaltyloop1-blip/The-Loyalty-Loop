import { useState } from 'react'
import { Store, Users, Receipt, Gift, BarChart3, ArrowUpRight, Check, CircleHelp } from 'lucide-react'

export type AdminUsage = { event_name: string; surface: string; events: number; people: number; last_seen: string }
const number = (value: number) => value.toLocaleString()
const label = (value: string) => value.replaceAll('_', ' ')
const palette = ['var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)', 'var(--color-chart-4)', 'var(--color-chart-5)']

export function AdminMetrics({ counts }: { counts: Record<string, number> }) {
  return <div className="admin-metrics">{[
    { key: 'businesses', title: 'Businesses', icon: Store, note: 'All business records' },
    { key: 'memberships', title: 'Loyalty memberships', icon: Users, note: 'Shop memberships, not unique people' },
    { key: 'transactions', title: 'Transactions', icon: Receipt, note: 'All recorded transaction types' },
    { key: 'rewards', title: 'Rewards', icon: Gift, note: 'All reward records' },
  ].map(({ key, title, icon: Icon, note }) => <article className="admin-metric" key={key}><span className="admin-metric-icon"><Icon size={21}/></span><div className="admin-metric-content"><span>{title}</span><strong>{counts[key] === undefined ? 'Unavailable' : number(counts[key])}</strong><p>{note}</p></div></article>)}</div>
}

function BarChart({ title, subtitle, rows }: { title: string; subtitle: string; rows: { name: string; value: number }[] }) {
  const maximum = Math.max(1, ...rows.map(row => row.value))
  return <section className="admin-chart-card admin-feature-chart"><div className="admin-chart-heading"><div><h3>{title}</h3><p>{subtitle}</p></div><span className="admin-period">30 days</span></div>{rows.length ? <div className="admin-column-chart"><div className="admin-column-plot" aria-hidden="true">{rows.map((row, i) => <div className="admin-column" key={row.name}><span>{number(row.value)}</span><div className="admin-column-fill" style={{ height: `${row.value / maximum * 100}%`, backgroundColor: i % 2 === 0 ? palette[0] : palette[1] }}/><b>{i + 1}</b></div>)}</div><ol className="admin-chart-key">{rows.map((row, i) => <li key={row.name}><span className="admin-key-number">{i + 1}</span><span>{label(row.name)}</span><strong>{number(row.value)}</strong></li>)}</ol></div> : <div className="admin-chart-empty"><BarChart3 size={28}/><strong>No activity yet</strong><span>Opted-in activity will appear here.</span></div>}</section>
}

function SurfaceChart({ rows, total }: { rows: { name: string; value: number }[]; total: number }) {
  const circumference = 2 * Math.PI * 72
  let offset = 0
  return <section className="admin-chart-card admin-surface-chart"><div className="admin-chart-heading"><div><h3>Activity by app</h3><p>Share of recorded actions</p></div><span className="admin-period">30 days</span></div>{total > 0 ? <><div className="admin-donut"><svg viewBox="0 0 200 200" role="img" aria-label={`${number(total)} tracked actions, broken down by app`}><circle cx="100" cy="100" r="72" fill="none" stroke="var(--color-border)" strokeWidth="22"/>{rows.map((row, index) => {
    const length = row.value / total * circumference
    const start = offset
    offset += length
    return <circle key={row.name} cx="100" cy="100" r="72" fill="none" stroke={palette[index % palette.length]} strokeWidth="22" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-start} transform="rotate(-90 100 100)"><title>{label(row.name)}: {number(row.value)} actions</title></circle>
  })}</svg><div><strong>{number(total)}</strong><span>tracked actions</span></div></div><ul className="admin-surface-key">{rows.map((row, index) => <li key={row.name}><span className="admin-key-dot" style={{ background: palette[index % palette.length] }} aria-hidden="true"/><span>{label(row.name)}</span><strong>{number(row.value)}</strong><small>{Math.round(row.value / total * 100)}%</small></li>)}</ul></> : <div className="admin-chart-empty"><BarChart3 size={28}/><strong>No activity yet</strong><span>Opted-in activity will appear here.</span></div>}</section>
}

export function AdminQueueSummary({ message, queues }: { message: string; queues: { key: string; label: string; count: number; unavailable: boolean; onOpen: () => void }[] }) {
  return <section className="admin-work"><div className="admin-work-intro"><span className="admin-work-icon" aria-hidden="true"><Check size={22}/></span><h2>Review queues</h2><p>{message}</p><small>Open a queue to review its records.</small></div><div className="admin-work-links">{queues.map(queue => <button key={queue.key} onClick={queue.onOpen}><span className="admin-queue-count">{queue.unavailable ? <CircleHelp size={22} aria-label="Unavailable"/> : number(queue.count)}</span><span>{queue.label}<small>{queue.unavailable ? 'Could not load' : queue.count === 1 ? '1 item to review' : `${number(queue.count)} items to review`}</small></span><ArrowUpRight size={18}/></button>)}</div></section>
}

export function AdminCharts({ items, unavailable = false }: { items: AdminUsage[]; unavailable?: boolean }) {
  const [measure, setMeasure] = useState<'events' | 'people'>('events')
  const features = new Map<string, number>()
  const surfaces = new Map<string, number>()
  for (const item of items) {
    // People are unique per feature/surface only. Never sum them across features.
    const name = `${item.event_name} · ${item.surface}`
    features.set(name, Number(item[measure]))
    surfaces.set(item.surface, (surfaces.get(item.surface) ?? 0) + Number(item.events))
  }
  const featureRows = [...features].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6)
  const surfaceRows = [...surfaces].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  const total = items.reduce((sum, item) => sum + Number(item.events), 0)
  return <section className="admin-analytics"><div className="admin-section-heading"><div><h2>Platform activity</h2><p>Your last 30 days, at a glance.</p></div><div className="admin-segment" aria-label="Feature chart measure"><button aria-pressed={measure === 'events'} onClick={() => setMeasure('events')}>Actions</button><button aria-pressed={measure === 'people'} onClick={() => setMeasure('people')}>People per feature</button></div></div>
    {unavailable ? <div className="admin-chart-card" role="status"><h3>Analytics unavailable</h3><p>Refresh data to retry. Charts will return when the analytics request succeeds.</p></div> : <><div className="admin-chart-grid"><BarChart title="Most used features" subtitle={measure === 'events' ? 'Top six features by tracked actions' : 'Unique people within each feature and surface'} rows={featureRows}/><SurfaceChart rows={surfaceRows} total={total}/></div><p className="admin-chart-note">Opted-in analytics only. Counts are recorded actions, not revenue. People may appear in more than one feature.</p></>}
  </section>
}
