import * as React from 'react'
import { listAudit, type AuditEntry } from '@/lib/admin'
import { Badge, DataTable, Pager, Status, btnGhost, downloadCsv, fmtDate, useClampPage, useLoad } from './kit'

export function Audit() {
  const [page, setPage] = React.useState(0)
  const { data, error, loading } = useLoad(() => listAudit(page), [page])
  useClampPage(data?.rows, data?.total, page, setPage)
  return (
    <div>
      <button className={`${btnGhost} mb-4`} onClick={() => data && downloadCsv('audit-log', data.rows.map((a) => ({ when: a.created_at, actor: a.actor_id, action: a.action, target: `${a.target_type}:${a.target_id}`, detail: JSON.stringify(a.detail) })))}>Export page CSV</button>
      <Status loading={loading} error={error} />
      <DataTable<AuditEntry> rows={data?.rows ?? []} columns={[
        { header: 'When', cell: (a) => fmtDate(a.created_at) },
        { header: 'Action', cell: (a) => <Badge tone="muted">{a.action}</Badge> },
        { header: 'Target', cell: (a) => `${a.target_type}${a.target_id ? ` · ${a.target_id.slice(0, 8)}` : ''}` },
        { header: 'Actor', cell: (a) => a.actor_id?.slice(0, 8) ?? 'system' },
        { header: 'Detail', cell: (a) => <code className="text-xs text-white/55">{JSON.stringify(a.detail)}</code> },
      ]} />
      <Pager page={page} total={data?.total ?? 0} onPage={setPage} />
    </div>
  )
}
