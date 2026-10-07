import { useState } from 'react'
import { Store, Users, Receipt, Gift, BarChart3 } from 'lucide-react'

export type AdminUsage = { event_name: string; surface: string; events: number; people: number; last_seen: string }
const number = (value: number) => value.toLocaleString()
const label = (value: string) => value.replaceAll('_', ' ')
const palette = ['#2563eb', '#0891b2', '#7c3aed', '#d97706', '#059669']

export function AdminMetrics({ counts }: { counts: Record<string, number> }) {
  return <div className="admin-metrics">{[
    { key: 'businesses', title: 'Businesses', icon: Store, note: 'All business records' },
    { key: 'memberships', title: 'Loyalty memberships', icon: Users, note: 'Shop memberships, not unique people' },
    { key: 'transactions', title: 'Transactions', icon: Receipt, note: 'All recorded transaction types' },
    { key: 'rewards', title: 'Rewards', icon: Gift, note: 'All reward records' },
  ].map(({ key, title, icon: Icon, note }) => <article className="admin-metric" key={key}><div><span>{title}</span><Icon size={18}/></div><strong>{counts[key] === undefined ? 'Unavailable' : number(counts[key])}</strong><p>{note}</p></article>)}</div>
}

function BarChart({ title, subtitle, rows }: { title: string; subtitle: string; rows: { name: string; value: number }[] }) {
  const maximum = Math.max(1, ...rows.map(row => row.value))
  return <section className="admin-chart-card"><h2>{title}</h2><p>{subtitle}</p>{rows.length ? <div className="admin-bars">{rows.map((row, i) => <div className="admin-bar-row" key={row.name}><div><span>{label(row.name)}</span><strong>{number(row.value)}</strong></div><div className="admin-bar-track"><div style={{ width: `${row.value / maximum * 100}%`, backgroundColor: palette[i % palette.length] }}/></div></div>)}</div> : <div className="admin-chart-empty"><BarChart3 size={28}/><strong>No activity yet</strong><span>Opted-in activity will appear here.</span></div>}</section>
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
  return <section className="admin-analytics"><div className="admin-section-heading"><div><h2>How people use the platform</h2><p>Last 30 days · opted-in analytics only</p></div><div className="admin-segment" aria-label="Feature chart measure"><button aria-pressed={measure === 'events'} onClick={() => setMeasure('events')}>Actions</button><button aria-pressed={measure === 'people'} onClick={() => setMeasure('people')}>People per feature</button></div></div>
    {unavailable ? <div className="admin-chart-card" role="status"><h2>Analytics unavailable</h2><p>Refresh data to retry. Charts will return when the analytics request succeeds.</p></div> : <><div className="admin-chart-grid"><BarChart title="Most used features" subtitle={measure === 'events' ? 'Top six features by tracked actions' : 'Unique people within each feature and surface'} rows={featureRows}/><BarChart title="Activity by app" subtitle={`${number(total)} tracked actions across all surfaces`} rows={surfaceRows}/></div><p className="admin-chart-note">Counts reflect recorded actions, not revenue. People can appear in more than one feature. No daily trend is inferred from these totals.</p></>}
  </section>
}
