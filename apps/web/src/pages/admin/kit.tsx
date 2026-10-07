import * as React from 'react'
import { PAGE_SIZE, toCsv } from '@/lib/admin'

export const inputCls = 'h-10 rounded-xl border border-white/15 bg-black/20 px-3 text-sm text-white placeholder:text-white/35'
export const btn = 'rounded-xl px-3 py-1.5 text-sm font-bold disabled:opacity-40'
export const btnPrimary = `${btn} bg-[#E8703B]`
export const btnGhost = `${btn} border border-white/15 text-white/80 hover:bg-white/10`
export const btnDanger = `${btn} border border-red-400/50 text-red-300 hover:bg-red-500/10`

export function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'muted'; children: React.ReactNode }) {
  const c = { ok: 'bg-[#3FA34D]/20 text-[#5ACA64]', warn: 'bg-amber-500/20 text-amber-300', bad: 'bg-red-500/20 text-red-300', muted: 'bg-white/10 text-white/60' }[tone]
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${c}`}>{children}</span>
}

export function fmtDate(v: string | null) { return v ? new Date(v).toLocaleString() : '—' }

export interface Column<T> { header: string; cell: (row: T) => React.ReactNode }

export function DataTable<T extends { id: string }>({ columns, rows, empty = 'Nothing here yet.' }: { columns: Column<T>[]; rows: T[]; empty?: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/5 text-xs uppercase tracking-wide text-white/45">
          <tr>{columns.map((c) => <th key={c.header} className="px-4 py-3 font-semibold">{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-white/45">{empty}</td></tr>
            : rows.map((r) => <tr key={r.id} className="border-t border-white/5">{columns.map((c) => <td key={c.header} className="px-4 py-3 align-top">{c.cell(r)}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  )
}

export function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-white/55">
      <span>{total} total</span>
      <div className="flex items-center gap-2">
        <button className={btnGhost} disabled={page === 0} onClick={() => onPage(page - 1)}>Prev</button>
        <span>Page {page + 1} / {pages}</span>
        <button className={btnGhost} disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  )
}

export function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url; a.download = `${name}.csv`; a.click()
  URL.revokeObjectURL(url)
}

/** Loads data via `fetcher` whenever `deps` change; ignores out-of-order responses. */
export function useLoad<T>(fetcher: () => Promise<T>, deps: React.DependencyList) {
  const [data, setData] = React.useState<T | null>(null)
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const latest = React.useRef(0)
  const run = React.useCallback(async () => {
    const id = ++latest.current
    setLoading(true); setError('')
    try {
      const result = await fetcher()
      if (id === latest.current) setData(result)
    } catch (e) {
      if (id === latest.current) setError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'Failed to load')
    } finally {
      if (id === latest.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  React.useEffect(() => { run() }, [run])
  return { data, error, loading, reload: run }
}

/** Runs a mutation with an in-flight guard; `pending` should disable action buttons. */
export function useAction() {
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null)
  const [pending, setPending] = React.useState(false)
  const act = async (work: () => Promise<unknown>, success: string, after?: () => void) => {
    if (pending) return
    setPending(true)
    try { await work(); setMessage({ ok: true, text: success }); after?.() } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'Action failed' })
    } finally { setPending(false) }
  }
  const banner = message && <p className={`mb-4 text-sm ${message.ok ? 'text-[#5ACA64]' : 'text-red-300'}`}>{message.text}</p>
  return { act, banner, pending }
}

/** If a mutation/filter leaves the current page empty, step back to the last valid page. */
export function useClampPage(rows: unknown[] | undefined, total: number | undefined, page: number, setPage: (p: number) => void) {
  React.useEffect(() => {
    if (rows && rows.length === 0 && page > 0) setPage(Math.max(0, Math.ceil((total ?? 0) / PAGE_SIZE) - 1))
  }, [rows, total, page, setPage])
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = React.useState(value)
  React.useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}

export function Status({ loading, error }: { loading: boolean; error: string }) {
  if (error) return <p className="mb-4 text-sm text-red-300">{error}</p>
  return loading ? <p className="mb-4 text-sm text-white/45">Loading…</p> : null
}
