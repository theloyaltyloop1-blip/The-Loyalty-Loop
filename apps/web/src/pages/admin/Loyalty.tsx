import * as React from 'react'
import { deleteReview, listRewards, listReviews, listTransactions, type AdminReview, type AdminReward, type AdminTransaction } from '@/lib/admin'
import { Badge, DataTable, Pager, Status, btnDanger, fmtDate, inputCls, useAction, useClampPage, useLoad } from './kit'

type Sub = 'transactions' | 'rewards' | 'reviews'

function Transactions() {
  const [page, setPage] = React.useState(0)
  const { data, error, loading } = useLoad(() => listTransactions(page), [page])
  useClampPage(data?.rows, data?.total, page, setPage)
  return <>
    <Status loading={loading} error={error} />
    <DataTable<AdminTransaction> rows={data?.rows ?? []} columns={[
      { header: 'When', cell: (t) => fmtDate(t.created_at) },
      { header: 'Type', cell: (t) => <div className="flex gap-1"><Badge tone={t.type === 'redeem' ? 'warn' : 'ok'}>{t.type}</Badge>{t.voided_at && <Badge tone="bad">voided</Badge>}</div> },
      { header: 'Value', cell: (t) => t.value },
      { header: 'Business', cell: (t) => t.business_name },
      { header: 'Customer', cell: (t) => t.user_email ?? t.user_id },
      { header: 'Note', cell: (t) => t.note ?? '—' },
    ]} />
    <Pager page={page} total={data?.total ?? 0} onPage={setPage} />
  </>
}

function Rewards() {
  const [page, setPage] = React.useState(0)
  const [status, setStatus] = React.useState('')
  const { data, error, loading } = useLoad(() => listRewards(status, page), [status, page])
  useClampPage(data?.rows, data?.total, page, setPage)
  return <>
    <select className={`${inputCls} mb-4`} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }}>
      <option value="">All</option><option value="active">Active</option><option value="redeemed">Redeemed</option><option value="expired">Expired</option>
    </select>
    <Status loading={loading} error={error} />
    <DataTable<AdminReward> rows={data?.rows ?? []} columns={[
      { header: 'Reward', cell: (r) => <><p className="font-semibold">{r.title}</p><p className="text-muted-foreground">{r.short_code}</p></> },
      { header: 'Business', cell: (r) => r.business_name },
      { header: 'Customer', cell: (r) => r.user_email ?? r.user_id },
      { header: 'Issued', cell: (r) => fmtDate(r.created_at) },
      { header: 'State', cell: (r) => r.redeemed_at ? <Badge tone="ok">redeemed {fmtDate(r.redeemed_at)}</Badge> : r.expires_at && new Date(r.expires_at) < new Date() ? <Badge tone="bad">expired</Badge> : <Badge tone="warn">active</Badge> },
    ]} />
    <Pager page={page} total={data?.total ?? 0} onPage={setPage} />
  </>
}

function Reviews() {
  const [page, setPage] = React.useState(0)
  const [low, setLow] = React.useState(false)
  const { data, error, loading, reload } = useLoad(() => listReviews(low ? 2 : null, page), [low, page])
  useClampPage(data?.rows, data?.total, page, setPage)
  const { act, banner, pending } = useAction()
  return <>
    {banner}
    <label className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={low} onChange={(e) => { setLow(e.target.checked); setPage(0) }} /> Only 1–2 star reviews</label>
    <Status loading={loading} error={error} />
    <DataTable<AdminReview> rows={data?.rows ?? []} columns={[
      { header: 'Rating', cell: (r) => '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating) },
      { header: 'Review', cell: (r) => <p className="max-w-md">{r.body ?? '—'}</p> },
      { header: 'Business', cell: (r) => r.business_name },
      { header: 'Author', cell: (r) => r.user_email ?? r.user_id },
      { header: 'Posted', cell: (r) => fmtDate(r.created_at) },
      { header: '', cell: (r) => <button className={btnDanger} disabled={pending} onClick={() => { const reason = prompt('Reason for removal'); if (reason) void act(() => deleteReview(r.id, reason), 'Review removed', reload) }}>Remove</button> },
    ]} />
    <Pager page={page} total={data?.total ?? 0} onPage={setPage} />
  </>
}

export function Loyalty() {
  const [sub, setSub] = React.useState<Sub>('transactions')
  return (
    <div>
      <div className="admin-segment mb-5 w-fit" role="group" aria-label="Loyalty data view">
        {(['transactions', 'rewards', 'reviews'] as Sub[]).map((s) => <button key={s} aria-pressed={sub === s} onClick={() => setSub(s)} className="capitalize">{s}</button>)}
      </div>
      {sub === 'transactions' ? <Transactions /> : sub === 'rewards' ? <Rewards /> : <Reviews />}
    </div>
  )
}
