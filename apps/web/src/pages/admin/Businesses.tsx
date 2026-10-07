import * as React from 'react'
import { listBusinesses, setBusinessStatus, type AdminBusiness, type ApprovalStatus } from '@/lib/admin'
import { Badge, DataTable, Pager, Status, btnDanger, btnPrimary, fmtDate, inputCls, useAction, useClampPage, useDebounced, useLoad } from './kit'

const tone = (s: string) => (s === 'approved' || s === 'verified' ? 'ok' : s === 'rejected' ? 'bad' : s === 'pending' ? 'warn' : 'muted') as 'ok' | 'bad' | 'warn' | 'muted'

/** All businesses with approval moderation. The document-verification queue lives in the "Business listings" tab. */
export function Businesses() {
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState<ApprovalStatus | ''>('')
  const [page, setPage] = React.useState(0)
  const q = useDebounced(search)
  React.useEffect(() => { setPage(0) }, [q, status])
  const list = useLoad(() => listBusinesses(q, status, page), [q, status, page])
  useClampPage(list.data?.rows, list.data?.total, page, setPage)
  const { act, banner, pending } = useAction()

  return (
    <div>
      {banner}
      <p className="mb-4 text-sm text-slate-600">Rejecting a listing hides it from customers. Document verification requests are in the Business listings tab.</p>
      <div className="mb-4 flex flex-wrap gap-2">
        <input className={`${inputCls} w-64`} placeholder="Search name or owner email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as ApprovalStatus | '')}>
          <option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
        </select>
      </div>
      <Status loading={list.loading} error={list.error} />
      <DataTable<AdminBusiness> rows={list.data?.rows ?? []} columns={[
        { header: 'Business', cell: (b) => <><p className="font-semibold">{b.name}</p><p className="text-slate-600">{b.owner_email ?? '—'} · {b.category ?? 'uncategorised'}</p></> },
        { header: 'Status', cell: (b) => <div className="flex flex-wrap gap-1"><Badge tone={tone(b.approval_status)}>{b.approval_status}</Badge><Badge tone={tone(b.verification_status)}>{b.verification_status}</Badge>{!b.is_active && <Badge tone="muted">paused by owner</Badge>}</div> },
        { header: 'Members', cell: (b) => b.members },
        { header: 'Listed', cell: (b) => fmtDate(b.created_at) },
        { header: 'Actions', cell: (b) => (
          <div className="flex flex-wrap gap-2">
            {b.approval_status !== 'approved' && <button className={btnPrimary} disabled={pending} onClick={() => act(() => setBusinessStatus(b.id, 'approved'), 'Approved', list.reload)}>Approve</button>}
            {b.approval_status !== 'rejected' && <button className={btnDanger} disabled={pending} onClick={() => { const r = prompt('Rejection reason'); if (r) void act(() => setBusinessStatus(b.id, 'rejected', r), 'Rejected', list.reload) }}>Reject</button>}
          </div>) },
      ]} />
      <Pager page={page} total={list.data?.total ?? 0} onPage={setPage} />
    </div>
  )
}
