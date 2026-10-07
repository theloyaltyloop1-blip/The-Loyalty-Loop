import * as React from 'react'
import { listUsers, setUserRole, setUserSuspended, type AdminUser } from '@/lib/admin'
import type { AppRole } from '@/lib/auth-context'
import { Badge, DataTable, Pager, Status, btnDanger, btnGhost, downloadCsv, fmtDate, inputCls, useAction, useDebounced, useLoad } from './kit'

const ROLES: AppRole[] = ['consumer', 'business_owner', 'staff', 'brand_head', 'admin']

export function Users() {
  const [search, setSearch] = React.useState('')
  const [role, setRole] = React.useState<AppRole | ''>('')
  const [page, setPage] = React.useState(0)
  const q = useDebounced(search)
  const { data, error, loading, reload } = useLoad(() => listUsers(q, role, page), [q, role, page])
  const { act, banner } = useAction()
  const [grantRole, setGrantRole] = React.useState<AppRole>('business_owner')

  return (
    <div>
      {banner}
      <div className="mb-4 flex flex-wrap gap-2">
        <input className={`${inputCls} w-64`} placeholder="Search name or email" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} />
        <select className={inputCls} value={role} onChange={(e) => { setRole(e.target.value as AppRole | ''); setPage(0) }}>
          <option value="">All roles</option>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className={inputCls} value={grantRole} onChange={(e) => setGrantRole(e.target.value as AppRole)} title="Role used by the Grant button">
          {ROLES.map((r) => <option key={r} value={r}>grant: {r}</option>)}
        </select>
        <button className={btnGhost} onClick={() => data && downloadCsv('users', data.rows.map((u) => ({ email: u.email, name: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(), roles: u.roles.join('|'), joined: u.created_at, suspended: u.suspended })))}>Export page CSV</button>
      </div>
      <Status loading={loading} error={error} />
      <DataTable<AdminUser> rows={data?.rows ?? []} columns={[
        { header: 'User', cell: (u) => <><p className="font-semibold">{`${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || '—'}</p><p className="text-white/50">{u.email}</p></> },
        { header: 'Roles', cell: (u) => <div className="flex flex-wrap gap-1">{u.roles.map((r) => <Badge key={r} tone={r === 'admin' ? 'warn' : 'muted'}>{r}</Badge>)}{u.suspended && <Badge tone="bad">suspended</Badge>}</div> },
        { header: 'Joined', cell: (u) => fmtDate(u.created_at) },
        { header: 'Last sign-in', cell: (u) => fmtDate(u.last_sign_in_at) },
        { header: 'Actions', cell: (u) => (
          <div className="flex flex-wrap gap-2">
            <button className={btnGhost} onClick={() => act(() => setUserRole(u.email, grantRole, true), `Granted ${grantRole}`, reload)}>Grant</button>
            <button className={btnDanger} onClick={() => act(() => setUserRole(u.email, grantRole, false), `Revoked ${grantRole}`, reload)}>Revoke</button>
            {u.suspended
              ? <button className={btnGhost} onClick={() => act(() => setUserSuspended(u.id, false), 'User reinstated', reload)}>Reinstate</button>
              : <button className={btnDanger} onClick={() => { const reason = prompt('Suspension reason'); if (reason) act(() => setUserSuspended(u.id, true, reason), 'User suspended', reload) }}>Suspend</button>}
          </div>) },
      ]} />
      <Pager page={page} total={data?.total ?? 0} onPage={setPage} />
    </div>
  )
}
