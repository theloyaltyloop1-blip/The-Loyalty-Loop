import { supabase } from './supabase'

export type ActivityItem = { id: string; type: 'stamp' | 'redeem' | 'points_earn' | 'points_spend'; value: number; note: string | null; created_at: string; business: { name: string; brand_color: string } | null }
export type InboxItem = { id: string; title: string; body: string | null; link: string | null; kind: string; read_at: string | null; created_at: string; business: { name: string } | null }

export async function fetchActivity(userId: string) {
  const { data, error } = await supabase.from('transactions').select('id,type,value,note,created_at,business:businesses(name,brand_color)').eq('user_id', userId).order('created_at', { ascending: false }).limit(100)
  if (error) throw error
  return (data ?? []).map((row: any) => ({ ...row, business: Array.isArray(row.business) ? row.business[0] ?? null : row.business })) as ActivityItem[]
}
export async function fetchInbox(userId: string) {
  const { data, error } = await supabase.from('notifications').select('id,title,body,link,kind,read_at,created_at,business:businesses(name)').eq('user_id', userId).order('created_at', { ascending: false }).limit(100)
  if (error) throw error
  return (data ?? []).map((row: any) => ({ ...row, business: Array.isArray(row.business) ? row.business[0] ?? null : row.business })) as InboxItem[]
}
export async function markInboxRead(id: string) { const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id); if (error) throw error }
export async function markAllInboxRead(userId: string) { const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null); if (error) throw error }
export async function getReferralCode(userId: string) { const { data, error } = await supabase.from('referral_codes').select('code').eq('user_id', userId).single(); if (error) throw error; return data.code as string }
export async function applyReferralCode(code: string) { const { data, error } = await supabase.rpc('apply_referral_code', { _code: code }); if (error) throw error; return Boolean(data) }
export async function acceptLegal(userId: string) { const rows = ['terms', 'privacy'].map((document_key) => ({ user_id: userId, document_key, document_version: '2026-08-07' })); const { error } = await supabase.from('legal_acceptances').upsert(rows, { onConflict: 'user_id,document_key,document_version' }); if (error) throw error }
export async function requestAccountDeletion() { const { error } = await supabase.functions.invoke('delete-my-account'); if (error) throw error }
