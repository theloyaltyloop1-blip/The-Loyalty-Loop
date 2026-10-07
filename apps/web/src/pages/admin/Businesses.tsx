import * as React from 'react'
import { listBusinesses, setBusinessActive, setBusinessStatus, type AdminBusiness, type ApprovalStatus } from '@/lib/admin'
import { fetchPendingVerifications, getVerificationDocUrl, reviewBusinessVerification, type PendingVerification } from '@/lib/businesses'
import { Badge, DataTable, Pager, Status, btnDanger, btnGhost, btnPrimary, fmtDate, inputCls, useAction, useDebounced, useLoad } from './kit'

const tone = (s: string) => (s === 'approved' || s === 'verified' ? 'ok' : s === 'rejected' ? 'bad' : s === 'pending' ? 'warn' : 'muted') as 'ok' | 'bad' | 'warn' | 'muted'

export function Businesses() {
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState<ApprovalStatus | ''>('')
  const [page, setPage] = React.useState(0)
  const q = useDebounced(search)
  const list = useLoad(() => listBusinesses(q, status, page), [q, status, page])
  const verifs = useLoad(fetchPendingVerifications, [])
  const { act, banner } = useAction()
  const refresh = () => { list.reload(); verifs.reload() }

  const openDoc = (v: PendingVerification) => v.verification_document_path && act(async () => window.open(await getVerificationDocUrl(v.verification_document_path!), '_blank'), 'Opened document')

  return (
    <div>
      {banner}
      <h2 className="mb-3 font-display text-lg font-bold">Verification queue ({verifs.data?.length ?? 0})</h2>
      <DataTable<PendingVerification> rows={verifs.data ?? []} empty="No verifications waiting." columns={[
        { header: 'Business', cell: (v) => <><p className="font-semibold">{v.name}</p><p className="text-white/50">{v.owner_email}</p></> },
        { header: 'Submitted', cell: (v) => fmtDate(v.verification_submitted_at) },
        { header: 'Document', cell: (v) => v.verification_document_path ? <button className={btnGhost} onClick={() => openDoc(v)}>View</button> : '—' },
        { header: 'Decision', cell: (v) => (
          <div className="flex gap-2">
            <button className={btnPrimary} onClick={() => act(() => reviewBusinessVerification(v.id, true), 'Verified', refresh)}>Approve</button>
            <button className={btnDanger} onClick={() => { const r = prompt('Rejection reason'); if (r) act(() => reviewBusinessVerification(v.id, false, r), 'Rejected', refresh) }}>Reject</button>
          </div>) },
      ]} />

      <h2 className="mb-3 mt-8 font-display text-lg font-bold">All businesses</h2>
      <div className="mb-4 flex flex-wrap gap-2">
        <input className={`${inputCls} w-64`} placeholder="Search name or owner email" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} />
        <select className={inputCls} value={status} onChange={(e) => { setStatus(e.target.value as ApprovalStatus | ''); setPage(0) }}>
          <option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
        </select>
      </div>
      <Status loading={list.loading} error={list.error} />
      <DataTable<AdminBusiness> rows={list.data?.rows ?? []} columns={[
        { header: 'Business', cell: (b) => <><p className="font-semibold">{b.name}</p><p className="text-white/50">{b.owner_email ?? '—'} · {b.category ?? 'uncategorised'}</p></> },
        { header: 'Status', cell: (b) => <div className="flex flex-wrap gap-1"><Badge tone={tone(b.approval_status)}>{b.approval_status}</Badge><Badge tone={tone(b.verification_status)}>{b.verification_status}</Badge>{!b.is_active && <Badge tone="bad">inactive</Badge>}</div> },
        { header: 'Members', cell: (b) => b.members },
        { header: 'Listed', cell: (b) => fmtDate(b.created_at) },
        { header: 'Actions', cell: (b) => (
          <div className="flex flex-wrap gap-2">
            {b.approval_status !== 'approved' && <button className={btnPrimary} onClick={() => act(() => setBusinessStatus(b.id, 'approved'), 'Approved', refresh)}>Approve</button>}
            {b.approval_status !== 'rejected' && <button className={btnDanger} onClick={() => { const r = prompt('Rejection reason'); if (r) act(() => setBusinessStatus(b.id, 'rejected', r), 'Rejected', refresh) }}>Reject</button>}
            <button className={btnGhost} onClick={() => act(() => setBusinessActive(b.id, !b.is_active), b.is_active ? 'Deactivated' : 'Activated', refresh)}>{b.is_active ? 'Deactivate' : 'Activate'}</button>
          </div>) },
      ]} />
      <Pager page={page} total={list.data?.total ?? 0} onPage={setPage} />
    </div>
  )
}
