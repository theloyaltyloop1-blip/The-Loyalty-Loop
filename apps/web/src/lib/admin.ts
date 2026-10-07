import { supabase } from './supabase'
import type { AppRole } from './auth-context'

export const PAGE_SIZE = 25

export interface Paged<T> { rows: T[]; total: number }

async function rpcPaged<T extends { total: number }>(fn: string, args: Record<string, unknown>): Promise<Paged<T>> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  const rows = (data ?? []) as T[]
  return { rows, total: rows[0]?.total ?? 0 }
}

async function rpcVoid(fn: string, args: Record<string, unknown>) {
  const { error } = await supabase.rpc(fn, args)
  if (error) throw error
}

export interface DashboardStats {
  users: number; new_users_7d: number; roles: Record<string, number>
  businesses: number; businesses_pending: number; verifications_pending: number
  memberships: number; transactions: number; rewards_issued: number; rewards_redeemed: number
  reviews: number; support_open: number; suspended_users: number
  series: { day: string; transactions: number }[]
}
export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc('admin_dashboard_stats')
  if (error) throw error
  return data as DashboardStats
}

export interface AdminUser {
  id: string; email: string; first_name: string | null; last_name: string | null
  created_at: string; last_sign_in_at: string | null; roles: AppRole[]; suspended: boolean; total: number
}
export const listUsers = (search: string, role: AppRole | '', page: number) =>
  rpcPaged<AdminUser>('admin_list_users', { _search: search || null, _role: role || null, _limit: PAGE_SIZE, _offset: page * PAGE_SIZE })
export const setUserRole = (email: string, role: AppRole, grant: boolean) => rpcVoid('admin_set_role', { _email: email, _role: role, _grant: grant })
export const setUserSuspended = (userId: string, suspended: boolean, reason?: string) =>
  rpcVoid('admin_set_user_suspended', { _user_id: userId, _suspended: suspended, _reason: reason ?? null })

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'
export interface AdminBusiness {
  id: string; name: string; slug: string; category: string | null; owner_id: string; owner_email: string | null
  approval_status: ApprovalStatus; verification_status: string; is_active: boolean; loyalty_type: string
  members: number; created_at: string; total: number
}
export const listBusinesses = (search: string, status: ApprovalStatus | '', page: number) =>
  rpcPaged<AdminBusiness>('admin_list_businesses', { _search: search || null, _status: status || null, _limit: PAGE_SIZE, _offset: page * PAGE_SIZE })
export const setBusinessStatus = (id: string, status: ApprovalStatus, reason?: string) =>
  rpcVoid('admin_set_business_status', { _business_id: id, _status: status, _reason: reason ?? null })

export interface AdminTransaction {
  id: string; type: string; value: number; note: string | null; created_at: string; voided_at: string | null
  business_id: string; business_name: string; user_id: string; user_email: string | null; total: number
}
export const listTransactions = (page: number) =>
  rpcPaged<AdminTransaction>('admin_list_transactions', { _business_id: null, _limit: PAGE_SIZE, _offset: page * PAGE_SIZE })

export interface AdminReward {
  id: string; title: string; short_code: string; created_at: string; expires_at: string | null; redeemed_at: string | null
  business_id: string; business_name: string; user_id: string; user_email: string | null; total: number
}
export const listRewards = (status: string, page: number) =>
  rpcPaged<AdminReward>('admin_list_rewards', { _status: status || null, _limit: PAGE_SIZE, _offset: page * PAGE_SIZE })

export interface AdminReview {
  id: string; rating: number; body: string | null; created_at: string
  business_id: string; business_name: string; user_id: string; user_email: string | null; total: number
}
export const listReviews = (maxRating: number | null, page: number) =>
  rpcPaged<AdminReview>('admin_list_reviews', { _max_rating: maxRating, _limit: PAGE_SIZE, _offset: page * PAGE_SIZE })
export const deleteReview = (id: string, reason?: string) => rpcVoid('admin_delete_review', { _review_id: id, _reason: reason ?? null })

export const respondSupport = (id: string, response: string, resolve: boolean) =>
  rpcVoid('admin_respond_support_request', { _id: id, _response: response, _resolve: resolve })

export interface AuditEntry { id: string; actor_id: string | null; action: string; target_type: string; target_id: string | null; detail: Record<string, unknown>; created_at: string }
export async function listAudit(page: number): Promise<Paged<AuditEntry>> {
  const { data, error, count } = await supabase.from('platform_audit_log').select('*', { count: 'exact' })
    .order('created_at', { ascending: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
  if (error) throw error
  return { rows: data as AuditEntry[], total: count ?? 0 }
}

/** CSV with formula-injection protection: cells starting with = + - @ tab or CR are prefixed with a quote. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const esc = (v: unknown) => {
    let t = String(v ?? '')
    if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`
    return `"${t.replace(/"/g, '""')}"`
  }
  return '\uFEFF' + [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}
