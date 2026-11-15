import { useState } from 'react'

export type AdminUsage = { event_name: string; surface: string; events: number; people: number; last_seen: string }
type Row = { name: string; where?: string; value: number }

const number = (value: number) => value.toLocaleString('en-GB')
/** "stamp_scanned" reads as "Stamp scanned". */
const label = (value: string) => { const text = value.replaceAll('_', ' '); return text.charAt(0).toUpperCase() + text.slice(1) }
// One accent leads; the other series sit in neutral steps.
const shareTones = ['var(--ag-accent)', 'color-mix(in srgb, var(--ag-text) 46%, transparent)', 'color-mix(in srgb, var(--ag-text) 22%, transparent)', 'color-mix(in srgb, var(--ag-text) 12%, transparent)']

function Empty() {
  return <div className="ag-empty"><strong>No activity yet</strong><span>Opted-in activity will appear here</span></div>
}

/** Ranked list with thin bars. The leader takes the accent. */
export function BarList({ rows }: { rows: Row[] }) {
  const maximum = Math.max(1, ...rows.map(row => row.value))
  if (!rows.length) return <Empty/>
  return <ol className="ag-bars">{rows.map(row => <li key={row.name + (row.where ?? '')}><span>{label(row.name)}{row.where && <small> · {label(row.where)}</small>}</span><strong>{number(row.value)}</strong><i aria-hidden="true"><b style={{ width: `${row.value / maximum * 100}%` }}/></i></li>)}</ol>
}

/** A share of a whole: one stacked bar and its key. */
export function SurfaceShare({ rows, total }: { rows: Row[]; total: number }) {
  if (total <= 0) return <Empty/>
  return <>
    <p className="ag-total">{number(total)}<small>tracked actions</small></p>
    <div className="ag-share" role="img" aria-label={rows.map(row => `${label(row.name)} ${Math.round(row.value / total * 100)}%`).join(', ')}>{rows.map((row, index) => <i key={row.name} style={{ flexGrow: row.value, background: shareTones[Math.min(index, shareTones.length - 1)] }}/>)}</div>
    <ul className="ag-key">{rows.map((row, index) => <li key={row.name}><i style={{ background: shareTones[Math.min(index, shareTones.length - 1)] }} aria-hidden="true"/><span>{label(row.name)}</span><strong>{number(row.value)}</strong><small>{Math.round(row.value / total * 100)}%</small></li>)}</ul>
  </>
}

/** Shapes the raw analytics rows once so the overview and Insights agree. */
export function summariseUsage(items: AdminUsage[], measure: 'events' | 'people' = 'events') {
  const surfaces = new Map<string, number>()
  // People are unique per feature and surface only. Never sum them across features.
  for (const item of items) surfaces.set(item.surface, (surfaces.get(item.surface) ?? 0) + Number(item.events))
  return {
    featureRows: items.map(item => ({ name: item.event_name, where: item.surface, value: Number(item[measure]) })).sort((a, b) => b.value - a.value),
    surfaceRows: [...surfaces].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    total: items.reduce((sum, item) => sum + Number(item.events), 0),
  }
}

export function AdminCharts({ items, unavailable = false }: { items: AdminUsage[]; unavailable?: boolean }) {
  const [measure, setMeasure] = useState<'events' | 'people'>('events')
  const { featureRows, surfaceRows, total } = summariseUsage(items, measure)
  if (unavailable) return <section className="ag-glass ag-sec" role="status"><h2 className="ag-h3">Analytics unavailable</h2><p className="ag-sub">Refresh to try again</p></section>
  return <div className="ag-usage is-cards">
    <section className="ag-glass ag-sec">
      <div className="ag-sec-head"><div><h2>Most used features</h2><p>{measure === 'events' ? 'Tracked actions, last 30 days' : 'People per feature, last 30 days'}</p></div>
        <div className="ag-seg" role="group" aria-label="Measure"><button type="button" aria-pressed={measure === 'events'} onClick={() => setMeasure('events')}>Actions</button><button type="button" aria-pressed={measure === 'people'} onClick={() => setMeasure('people')}>People</button></div></div>
      <BarList rows={featureRows.slice(0, 8)}/>
    </section>
    <section className="ag-glass ag-sec">
      <div className="ag-sec-head"><div><h2>By app</h2><p>Share of tracked actions, last 30 days</p></div></div>
      <SurfaceShare rows={surfaceRows} total={total}/>
    </section>
  </div>
}
