import { supabase } from './supabase'

export interface LoyaltyConfig {
  stamps_required?: number
  stamp_icon?: string
  signup_reward_title?: string
}

export interface Business {
  id: string
  owner_id: string
  name: string
  slug: string
  category: string | null
  description: string | null
  address: string | null
  postcode: string | null
  website: string | null
  phone: string | null
  instagram: string | null
  brand_color: string
  logo_url: string | null
  cover_url: string | null
  loyalty_type: 'stamp_card' | 'points' | 'tiered'
  loyalty_config: LoyaltyConfig
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected'
}

export interface RewardCatalogItem {
  id: string
  business_id: string
  title: string
  description: string | null
  stamp_threshold: number
  sort_order: number
}

export interface Membership {
  id: string
  user_id: string
  business_id: string
  stamp_count: number
  points_balance: number
  promos_opted_out: boolean
}

export async function fetchBusinesses(): Promise<Business[]> {
  const { data, error } = await supabase.from('businesses').select('*').order('created_at')
  if (error) throw error
  return data as Business[]
}

export async function fetchBusinessBySlug(slug: string): Promise<Business | null> {
  const { data, error } = await supabase.from('businesses').select('*').eq('slug', slug).maybeSingle()
  if (error) throw error
  return data as Business | null
}

export async function fetchOwnedBusinesses(ownerId: string): Promise<Business[]> {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at')
  if (error) throw error
  return data as Business[]
}

export async function updateBusiness(id: string, patch: Partial<Business>): Promise<Business> {
  const { data, error } = await supabase.from('businesses').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data as Business
}

export async function fetchMyMemberships(userId: string): Promise<Membership[]> {
  const { data, error } = await supabase.from('memberships').select('*').eq('user_id', userId)
  if (error) throw error
  return data as Membership[]
}

export async function fetchMembership(userId: string, businessId: string): Promise<Membership | null> {
  const { data, error } = await supabase
    .from('memberships')
    .select('*')
    .eq('user_id', userId)
    .eq('business_id', businessId)
    .maybeSingle()
  if (error) throw error
  return data as Membership | null
}

export async function joinBusiness(userId: string, businessId: string): Promise<Membership> {
  const { data, error } = await supabase
    .from('memberships')
    .upsert({ user_id: userId, business_id: businessId }, { onConflict: 'user_id,business_id' })
    .select()
    .single()
  if (error) throw error
  return data as Membership
}

export async function fetchRewardCatalog(businessId: string): Promise<RewardCatalogItem[]> {
  const { data, error } = await supabase
    .from('reward_catalog')
    .select('*')
    .eq('business_id', businessId)
    .order('sort_order')
  if (error) throw error
  return data as RewardCatalogItem[]
}

export async function addRewardCatalogItem(
  businessId: string,
  item: { title: string; description: string | null; stamp_threshold: number; sort_order: number }
): Promise<RewardCatalogItem> {
  const { data, error } = await supabase
    .from('reward_catalog')
    .insert({ business_id: businessId, ...item })
    .select()
    .single()
  if (error) throw error
  return data as RewardCatalogItem
}

export async function deleteRewardCatalogItem(id: string) {
  const { error } = await supabase.from('reward_catalog').delete().eq('id', id)
  if (error) throw error
}

/** Owner/admin only — enforced by the transactions_insert_owner_or_admin RLS
 * policy, not by this function. Real staff/customer scanning UI lands
 * separately; this is what lets us prove handle_stamp_transaction() works
 * end-to-end before that UI exists. */
export async function simulateStamp(userId: string, businessId: string) {
  const { error } = await supabase
    .from('transactions')
    .insert({ user_id: userId, business_id: businessId, type: 'stamp', value: 1 })
  if (error) throw error
}
