import * as React from 'react'
import { useAuth, type AppRole } from '@/lib/auth-context'
import { listUsers, setUserRole, setUserSuspended, type AdminUser } from '@/lib/admin'
import { Badge, DataTable, Pager, Status, btnDanger, btnGhost, downloadCsv, fmtDate, inputCls, useAction, useClampPage, useDebounced, useLoad } from './kit'

const ROLES: AppRole[] = ['consumer', 'business_owner', 'staff', 'brand_head', 'admin']

export function Users() {
  const { session } = useAuth()
  const [search, setSearch] = React.useState('')
  const [role, setRole] = React.useState<AppRole | ''>('')
  const [page, setPage] = React.useState(0)
  const q = useDebounced(search)
  React.useEffect(() => { setPage(0) }, [q, role])
  const { data, error, loading, reload } = useLoad(() => listUsers(q, role, page), [q, role, page])
  useClampPage(data?.rows, data?.total, page, setPage)
  const { act, banner, pending } = useAction()
  const [grantRole, setGrantRole] = React.useState<AppRole>('business_owner')

  const changeRole = (u: AdminUser, grant: boolean) => {
    if (!confirm(`${grant ? 'Grant' : 'Revoke'} "${grantRole}" ${grant ? 'to' : 'from'} ${u.email}?`)) return
    void act(() => setUserRole(u.email, grantRole, grant), `${grant ? 'Granted' : 'Revoked'} ${grantRole}`, reload)
  }

  return (
    <div>
      {banner}
      <div className="mb-4 flex flex-wrap gap-2">
        <input className={`${inputCls} w-64`} placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as AppRole | '')}>
          <option value="">All roles</option>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className={inputCls} value={grantRole} onChange={(e) => setGrantRole(e.target.value as AppRole)} title="Role used by the Grant and Revoke buttons">
          {ROLES.map((r) => <option key={r} value={r}>role to change: {r}</option>)}
        </select>
        <button className={btnGhost} onClick={() => data && downloadCsv('users', data.rows.map((u) => ({ email: u.email, name: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(), roles: u.roles.join('|'), joined: u.created_at, suspended: u.suspended })))}>Export page CSV</button>
      </div>
      <Status loading={loading} error={error} />
      <DataTable<AdminUser> rows={data?.rows ?? []} columns={[
        { header: 'User', cell: (u) => <><p className="font-semibold">{`${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || '—'}</p><p className="text-white/50">{u.email}</p></> },
        { header: 'Roles', cell: (u) => <div className="flex flex-wrap gap-1">{u.roles.map((r) => <Badge key={r} tone={r === 'admin' ? 'warn' : 'muted'}>{r}</Badge>)}{u.suspended && <Badge tone="bad">suspended</Badge>}</div> },
        { header: 'Joined', cell: (u) => fmtDate(u.created_at) },
        { header: 'Last sign-in', cell: (u) => fmtDate(u.last_sign_in_at) },
        { header: 'Actions', cell: (u) => {
          const self = u.id === session?.user.id
          return (
            <div className="flex flex-wrap gap-2">
              <button className={btnGhost} disabled={pending} onClick={() => changeRole(u, true)}>Grant</button>
              <button className={btnDanger} disabled={pending || (self && grantRole === 'admin')} title={self && grantRole === 'admin' ? 'You cannot revoke your own admin role here' : undefined} onClick={() => changeRole(u, false)}>Revoke</button>
              {u.suspended
                ? <button className={btnGhost} disabled={pending} onClick={() => act(() => setUserSuspended(u.id, false), 'User reinstated', reload)}>Reinstate</button>
                : <button className={btnDanger} disabled={pending || self} onClick={() => { const reason = prompt('Suspension reason (the user will be signed out and blocked)'); if (reason) void act(() => setUserSuspended(u.id, true, reason), 'User suspended', reload) }}>Suspend</button>}
            </div>)
        } },
      ]} />
      <Pager page={page} total={data?.total ?? 0} onPage={setPage} />
    </div>
  )
}
