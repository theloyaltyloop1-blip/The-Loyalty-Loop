import { supabase } from './supabase'

export interface LoyaltyConfig {
  stamps_required?: number
  stamp_icon?: string
  signup_reward_title?: string
}

export interface DayHours {
  closed: boolean
  open: string
  close: string
}

export type OpeningHours = Partial<Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', DayHours>>

export interface Business {
  id: string
  owner_id: string
  name: string
  slug: string
  category: string | null
  description: string | null
  address: string | null
  postcode: string | null
  lat: number | null
  lng: number | null
  website: string | null
  phone: string | null
  instagram: string | null
  tiktok: string | null
  youtube: string | null
  brand_color: string
  logo_url: string | null
  cover_url: string | null
  opening_hours: OpeningHours | null
  loyalty_type: 'stamp_card' | 'points' | 'tiered'
  loyalty_config: LoyaltyConfig
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected'
  verification_document_path: string | null
  verification_document_label: string | null
  verification_submitted_at: string | null
  verification_rejection_reason: string | null
  is_active: boolean
  whatsapp_onboarding_enabled: boolean
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

/** Permanently removes a shop and its loyalty data. The database RPC verifies
 * that the current account owns the shop before doing any deletion. */
export async function deleteOwnedBusiness(businessId: string, confirmationName: string) {
  const { error } = await supabase.rpc('delete_owned_business', {
    _business_id: businessId,
    _confirmation_name: confirmationName.trim(),
  })
  if (error) throw error
}

/** Transfers a shop to an existing Loyalty Loop account. The database checks
 * that the caller owns the shop; owner IDs are never changed in the browser. */
export async function transferOwnedBusinessOwnership(businessId: string, newOwnerEmail: string) {
  const { error } = await supabase.rpc('transfer_owned_business_ownership', {
    _business_id: businessId,
    _new_owner_email: newOwnerEmail.trim(),
  })
  if (error) throw error
}

/** Admin-only: move a shop to an existing account and make that account a
 * business owner. The database function performs the permission check and
 * records the handoff in the platform audit log. */
export async function adminTransferBusinessOwnership(businessId: string, newOwnerEmail: string) {
  const { error } = await supabase.rpc('admin_transfer_business_ownership', {
    _business_id: businessId,
    _new_owner_email: newOwnerEmail.trim(),
  })
  if (error) throw error
}

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${base || 'shop'}-${Math.random().toString(36).slice(2, 6)}`
}

/** Owner onboarding — creates the shop and goes live immediately (no
 * approval wait). RLS requires has_role(auth.uid(), 'business_owner'),
 * granted automatically at signup for accounts created with owner intent. */
export async function createBusiness(
  ownerId: string,
  values: {
    name: string
    category: string
    description: string
    address: string
    postcode: string
    lat?: number | null
    lng?: number | null
    brand_color: string
    loyalty_type: Business['loyalty_type']
    stamps_required: number
  }
): Promise<Business> {
  const { data, error } = await supabase
    .from('businesses')
    .insert({
      owner_id: ownerId,
      name: values.name,
      slug: slugify(values.name),
      category: values.category,
      description: values.description || null,
      address: values.address || null,
      postcode: values.postcode || null,
      lat: values.lat ?? null,
      lng: values.lng ?? null,
      brand_color: values.brand_color,
      loyalty_type: values.loyalty_type,
      loyalty_config: { stamps_required: values.stamps_required },
    })
    .select()
    .single()
  if (error) throw error
  return data as Business
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const FILE_EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
}

/**
 * File names and browser-reported MIME types can be forged. Check the leading
 * bytes as a user-friendly first line of defence; the Storage bucket and its
 * RLS policy enforce the same allow-list on the server for direct uploads.
 */
async function assertSafeUpload(file: File, allowedTypes: readonly string[], maxBytes: number, label: string) {
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Please choose an approved ${label} file type.`)
  }
  if (!file.size) {
    throw new Error('The selected file is empty.')
  }
  if (file.size > maxBytes) {
    throw new Error(`${label} must be ${Math.floor(maxBytes / 1024 / 1024)}MB or smaller.`)
  }

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  const matches = (...bytes: number[]) => bytes.every((byte, index) => header[index] === byte)
  const ascii = (offset: number, value: string) => value.split('').every((char, index) => header[offset + index] === char.charCodeAt(0))
  const validSignature =
    (file.type === 'image/png' && matches(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) ||
    (file.type === 'image/jpeg' && matches(0xff, 0xd8, 0xff)) ||
    (file.type === 'image/webp' && ascii(0, 'RIFF') && ascii(8, 'WEBP')) ||
    (file.type === 'image/gif' && (ascii(0, 'GIF87a') || ascii(0, 'GIF89a'))) ||
    (file.type === 'application/pdf' && ascii(0, '%PDF-'))

  if (!validSignature) {
    throw new Error('This file does not match the selected file type. Please choose the original image or PDF file.')
  }
}

/** Uploads to the `logos`/`covers` public bucket at `{businessId}/{field}-{timestamp}.{ext}`,
 * then persists the resulting public URL onto the business row. Storage RLS
 * independently enforces that only the business owner can write into that
 * folder — this client-side check is just a fast, friendly failure. */
export async function uploadBusinessImage(
  businessId: string,
  field: 'logo_url' | 'cover_url',
  file: File
): Promise<Business> {
  await assertSafeUpload(file, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, 'image')

  const bucket = field === 'logo_url' ? 'logos' : 'covers'
  const ext = FILE_EXTENSION_BY_MIME[file.type]
  const path = `${businessId}/${field}-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })
  if (uploadError) throw uploadError

  const { data: publicUrl } = supabase.storage.from(bucket).getPublicUrl(path)
  return updateBusiness(businessId, { [field]: publicUrl.publicUrl } as Partial<Business>)
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
  // Validate against Auth rather than trusting an ID held by an old browser
  // session. A deleted/expired account can otherwise produce a misleading
  // foreign-key failure when joining a card.
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user || authData.user.id !== userId) {
    throw new Error('Your session has expired. Please sign in again, then try joining this card.')
  }
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

export interface WinbackLogEntry {
  id: string
  business_id: string
  user_id: string
  recipient_email: string
  days_inactive: number
  coupon_code: string
  subject: string
  status: string
  error: string | null
  sent_at: string
}

export async function fetchWinbackLog(businessId: string): Promise<WinbackLogEntry[]> {
  const { data, error } = await supabase
    .from('winback_email_log')
    .select('*')
    .eq('business_id', businessId)
    .order('sent_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data as WinbackLogEntry[]
}

export async function triggerWinbackEmails(businessId: string, daysInactiveThreshold: number) {
  const { data, error } = await supabase.functions.invoke('send-winback-emails', {
    body: { business_id: businessId, days_inactive_threshold: daysInactiveThreshold },
  })
  if (error) throw error
  return data as { sent: number; skipped: number; errors: number; message?: string }
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

export interface StampCodeMatch {
  id: string
  first_name: string | null
  last_name: string | null
}

/** Resolves a customer's short manual code to their id/name via the
 * lookup_user_by_stamp_code RPC — rate-limited and owner/admin-gated
 * server-side, never a direct client select against profiles (RLS on
 * profiles is self-only). */
export async function lookupUserByStampCode(code: string): Promise<StampCodeMatch | null> {
  const { data, error } = await supabase.rpc('lookup_user_by_stamp_code', { _code: code.replace(/\s+/g, '').toUpperCase() })
  if (error) throw error
  return (data as StampCodeMatch[])[0] ?? null
}

/** Awards progress (a stamp / a point / a visit, depending on the shop's
 * loyalty_type — the transactions row is the same either way, the trigger
 * branches on loyalty_type). Enforced server-side by
 * transactions_insert_owner_or_admin: only the business owner/admin, and
 * only if the target customer already has a membership row. */
export async function awardProgress(businessId: string, userId: string, value = 1) {
  const { error } = await supabase
    .from('transactions')
    .insert({ user_id: userId, business_id: businessId, type: 'stamp', value })
  if (error) throw error
}

/** Best-effort receipt email after a staff award. It never blocks awarding a stamp. */
export async function sendVisitThankYou(businessId: string, userId: string, amount: number) {
  await supabase.functions.invoke('send-visit-thank-you', { body: { business_id: businessId, user_id: userId, amount } })
}
export interface ScannedMemberDetails extends StampCodeMatch {
  email: string | null
  stamp_count: number
  points_balance: number
  visit_count: number
  joined_at: string
  last_activity_at: string | null
}
export async function fetchScannedMemberDetails(businessId: string, userId: string): Promise<ScannedMemberDetails | null> {
  const { data, error } = await supabase.rpc('get_scanned_member_details', { _business_id: businessId, _user_id: userId })
  if (error) throw error
  return (data as ScannedMemberDetails[])[0] ?? null
}

/** Best-effort native notification after an owner or staff member awards progress. */
export async function sendUserPush(businessId: string, userId: string) {
  await supabase.functions.invoke('send-user-push', { body: { business_id: businessId, user_id: userId } })
}

/** Pushes the customer's new stamp/points balance to their saved Google Wallet pass, if any. */
export async function updateWalletPass(businessId: string, userId: string) {
  await supabase.functions.invoke('update-wallet-pass', { body: { business_id: businessId, user_id: userId } })
}

export interface RewardLookup {
  id: string
  user_id: string
  title: string
  short_code: string
  redeemed_at: string | null
  expires_at: string | null
}

export interface CustomerReward {
  id: string
  user_id: string
  business_id: string
  title: string
  qr_token: string
  short_code: string
  expires_at: string | null
  redeemed_at: string | null
  created_at: string
  business: Pick<Business, 'name' | 'brand_color' | 'logo_url'> | null
}

export interface Announcement {
  id: string
  business_id: string
  title: string
  body: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  business: Pick<Business, 'name' | 'brand_color' | 'logo_url'> | null
}

export interface ReviewReply {
  id: string
  review_id: string
  business_id: string
  owner_id: string
  body: string
  created_at: string
  updated_at: string
}

export interface ShopReview {
  id: string
  user_id: string
  business_id: string
  rating: number
  body: string | null
  created_at: string
  updated_at: string
  reply: ReviewReply | null
}

export async function fetchShopReviews(businessId: string): Promise<ShopReview[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('id,user_id,business_id,rating,body,created_at,updated_at,reply:review_replies(id,review_id,business_id,owner_id,body,created_at,updated_at)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({ ...row, reply: Array.isArray(row.reply) ? row.reply[0] ?? null : row.reply })) as ShopReview[]
}

export async function upsertReview(businessId: string, userId: string, rating: number, body: string) {
  const { data, error } = await supabase
    .from('reviews')
    .upsert({ business_id: businessId, user_id: userId, rating, body: body.trim() || null }, { onConflict: 'user_id,business_id' })
    .select()
    .single()
  if (error) throw error
  return data as ShopReview
}

export async function deleteReview(id: string) {
  const { error } = await supabase.from('reviews').delete().eq('id', id)
  if (error) throw error
}

export async function replyToReview(review: ShopReview, ownerId: string, body: string) {
  const values = { review_id: review.id, business_id: review.business_id, owner_id: ownerId, body: body.trim() }
  const { data, error } = await supabase
    .from('review_replies')
    .upsert(values, { onConflict: 'review_id' })
    .select()
    .single()
  if (error) throw error
  return data as ReviewReply
}

export async function fetchMyRewards(userId: string): Promise<CustomerReward[]> {
  const { data, error } = await supabase
    .from('rewards')
    .select('id,user_id,business_id,title,qr_token,short_code,expires_at,redeemed_at,created_at,business:businesses(name,brand_color,logo_url)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    business: Array.isArray(row.business) ? row.business[0] ?? null : row.business,
  })) as CustomerReward[]
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('id,business_id,title,body,is_active,created_at,updated_at,business:businesses(name,brand_color,logo_url)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    business: Array.isArray(row.business) ? row.business[0] ?? null : row.business,
  })) as Announcement[]
}

export async function fetchOwnedAnnouncements(businessId: string): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('id,business_id,title,body,is_active,created_at,updated_at,business:businesses(name,brand_color,logo_url)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    business: Array.isArray(row.business) ? row.business[0] ?? null : row.business,
  })) as Announcement[]
}

export async function createAnnouncement(businessId: string, values: Pick<Announcement, 'title' | 'body' | 'is_active'>) {
  const { data, error } = await supabase.from('announcements').insert({ business_id: businessId, ...values }).select().single()
  if (error) throw error
  return data as Announcement
}

export async function updateAnnouncement(id: string, values: Partial<Pick<Announcement, 'title' | 'body' | 'is_active'>>) {
  const { data, error } = await supabase.from('announcements').update(values).eq('id', id).select().single()
  if (error) throw error
  return data as Announcement
}

export async function deleteAnnouncement(id: string) {
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (error) throw error
}

/** Looks up a reward by its own short manual code, scoped to the given
 * business — RLS additionally enforces the caller owns that business. */
export async function findRewardByCode(businessId: string, code: string): Promise<RewardLookup | null> {
  const { data, error } = await supabase
    .from('rewards')
    .select('id, user_id, title, short_code, redeemed_at, expires_at')
    .eq('business_id', businessId)
    .eq('short_code', code.replace(/\s+/g, '').toUpperCase())
    .maybeSingle()
  if (error) throw error
  return data as RewardLookup | null
}

export async function findRewardByToken(businessId: string, qrToken: string): Promise<RewardLookup | null> {
  const { data, error } = await supabase
    .from('rewards')
    .select('id, user_id, title, short_code, redeemed_at, expires_at')
    .eq('business_id', businessId)
    .eq('qr_token', qrToken)
    .maybeSingle()
  if (error) throw error
  return data as RewardLookup | null
}

/** Marks a reward redeemed. enforce_rewards_update_scope additionally
 * guarantees this can only move forward once (can't redeem twice, can't
 * un-redeem, can't redeem past expiry). */
export async function redeemReward(rewardId: string) {
  const { error } = await supabase.from('rewards').update({ redeemed_at: new Date().toISOString() }).eq('id', rewardId)
  if (error) throw error
}

const MAX_DOC_BYTES = 10 * 1024 * 1024
const ALLOWED_DOC_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']

/** Uploads a proof-of-business document to the private
 * owner_verification_docs bucket at `{auth.uid()}/{businessId}-{timestamp}.{ext}`
 * (folder-scoped — storage RLS only lets the uploader and admins read it),
 * then calls submit_business_verification to move the shop to 'pending'. */
export async function submitVerificationDocument(
  businessId: string,
  userId: string,
  file: File,
  label: string
): Promise<Business> {
  await assertSafeUpload(file, ALLOWED_DOC_TYPES, MAX_DOC_BYTES, 'verification document')

  const ext = FILE_EXTENSION_BY_MIME[file.type]
  const path = `${userId}/${businessId}-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage.from('owner_verification_docs').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })
  if (uploadError) throw uploadError

  const { data, error } = await supabase.rpc('submit_business_verification', {
    _business_id: businessId,
    _doc_path: path,
    _doc_label: label,
  })
  if (error) throw error
  return data as Business
}

export interface PendingVerification {
  id: string
  name: string
  slug: string
  category: string | null
  owner_id: string
  owner_email: string | null
  verification_document_path: string | null
  verification_document_label: string | null
  verification_submitted_at: string | null
}

/** Admin-only — enforced by the admin_pending_business_verifications RPC. */
export async function fetchPendingVerifications(): Promise<PendingVerification[]> {
  const { data, error } = await supabase.rpc('admin_pending_business_verifications')
  if (error) throw error
  return data as PendingVerification[]
}

/** Signed URL to the private document, valid briefly — admin/owner-only per
 * the owner_verification_docs storage RLS policy. */
export async function getVerificationDocUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('owner_verification_docs').createSignedUrl(path, 300)
  if (error) throw error
  return data.signedUrl
}

/** Admin-only — enforced by the admin_review_business_verification RPC. */
export async function reviewBusinessVerification(businessId: string, approve: boolean, reason?: string) {
  const { data, error } = await supabase.rpc('admin_review_business_verification', {
    _business_id: businessId,
    _approve: approve,
    _reason: reason ?? null,
  })
  if (error) throw error
  return data as Business
}

export interface SupportRequest {
  id: string
  business_id: string
  user_id: string
  subject: string
  body: string
  priority: 'low' | 'normal' | 'high'
  status: 'open' | 'resolved'
  admin_response: string | null
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
  business: Pick<Business, 'name'> | null
}

export async function createSupportRequest(businessId: string, userId: string, values: Pick<SupportRequest, 'subject' | 'body' | 'priority'>) {
  const { data, error } = await supabase.from('support_requests').insert({ business_id: businessId, user_id: userId, ...values }).select().single()
  if (error) throw error
  return data as SupportRequest
}

export async function fetchMySupportRequests(businessId: string): Promise<SupportRequest[]> {
  const { data, error } = await supabase.from('support_requests').select('*').eq('business_id', businessId).order('created_at', { ascending: false })
  if (error) throw error
  return data as SupportRequest[]
}

export async function fetchAdminSupportRequests(): Promise<SupportRequest[]> {
  const { data, error } = await supabase.from('support_requests').select('*,business:businesses(name)').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({ ...row, business: Array.isArray(row.business) ? row.business[0] ?? null : row.business })) as SupportRequest[]
}

export async function resolveSupportRequest(id: string, response = '') {
  const { data, error } = await supabase.from('support_requests').update({ status: 'resolved', admin_response: response.trim() || null, resolved_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) throw error
  return data as SupportRequest
}

// ---------------------------------------------------------------------
// Favourites

export async function fetchFavouriteIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('favourites').select('business_id').eq('user_id', userId)
  if (error) throw error
  return new Set((data ?? []).map((r) => r.business_id as string))
}

export async function fetchFavouriteBusinesses(userId: string): Promise<Business[]> {
  const { data, error } = await supabase
    .from('favourites')
    .select('business:businesses(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => (Array.isArray(row.business) ? row.business[0] : row.business)).filter(Boolean) as Business[]
}

export async function addFavourite(userId: string, businessId: string) {
  const { error } = await supabase.from('favourites').insert({ user_id: userId, business_id: businessId })
  if (error) throw error
}

export async function removeFavourite(userId: string, businessId: string) {
  const { error } = await supabase.from('favourites').delete().eq('user_id', userId).eq('business_id', businessId)
  if (error) throw error
}

// ---------------------------------------------------------------------
// Staff accounts

export interface StaffMember {
  id: string
  business_id: string
  user_id: string | null
  invited_email: string
  name: string
  status: 'invited' | 'active' | 'revoked'
  can_scan_stamps: boolean
  can_redeem_rewards: boolean
  can_respond_reviews: boolean
  created_at: string
  activated_at: string | null
}

export async function fetchStaffMembers(businessId: string): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from('staff_members')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as StaffMember[]
}

/** Owner-only — enforced server-side (create-staff-account edge function
 * re-checks owner_id = auth.uid() OR admin). Sets the initial password
 * directly; re-inviting a revoked email reuses the same auth account and
 * resets its password rather than erroring. */
export async function inviteStaffMember(
  businessId: string,
  values: {
    email: string
    name: string
    password: string
    can_scan_stamps: boolean
    can_redeem_rewards: boolean
    can_respond_reviews: boolean
  }
): Promise<StaffMember> {
  const { data, error } = await supabase.functions.invoke('create-staff-account', {
    body: {
      business_id: businessId,
      email: values.email,
      name: values.name,
      password: values.password,
      permissions: {
        can_scan_stamps: values.can_scan_stamps,
        can_redeem_rewards: values.can_redeem_rewards,
        can_respond_reviews: values.can_respond_reviews,
      },
    },
  })
  if (error) throw error
  const result = data as { staff?: StaffMember; error?: string }
  if (result.error) throw new Error(result.error)
  return result.staff as StaffMember
}

/** Revoking is a plain table update — staff_members RLS already grants the
 * owner full CRUD on their own shop's staff rows, no RPC needed. Their
 * permissions stop working immediately (every scan/redeem/reply check reads
 * status = 'active' live), and the invite can be reissued later. */
export async function setStaffStatus(id: string, status: 'active' | 'revoked') {
  const { data, error } = await supabase.from('staff_members').update({ status }).eq('id', id).select().single()
  if (error) throw error
  return data as StaffMember
}

export async function updateStaffPermissions(
  id: string,
  permissions: Partial<Pick<StaffMember, 'can_scan_stamps' | 'can_redeem_rewards' | 'can_respond_reviews'>>
) {
  const { data, error } = await supabase.from('staff_members').update(permissions).eq('id', id).select().single()
  if (error) throw error
  return data as StaffMember
}

export interface MyStaffMembership {
  business_id: string
  can_scan_stamps: boolean
  can_redeem_rewards: boolean
  can_respond_reviews: boolean
  business: Pick<Business, 'id' | 'name' | 'slug' | 'brand_color' | 'logo_url' | 'loyalty_type'>
}

/** The shops the current user is an active staff member of — self-select is
 * allowed by staff_members RLS regardless of who owns the shop. */
export async function fetchMyStaffBusinesses(userId: string): Promise<MyStaffMembership[]> {
  const { data, error } = await supabase
    .from('staff_members')
    .select('business_id,can_scan_stamps,can_redeem_rewards,can_respond_reviews,business:businesses(id,name,slug,brand_color,logo_url,loyalty_type)')
    .eq('user_id', userId)
    .eq('status', 'active')
  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    business: Array.isArray(row.business) ? row.business[0] : row.business,
  })) as MyStaffMembership[]
}

// ---------------------------------------------------------------------
// Gallery

export interface BusinessPhoto {
  id: string
  business_id: string
  url: string
  sort_order: number
}

export async function fetchBusinessPhotos(businessId: string): Promise<BusinessPhoto[]> {
  const { data, error } = await supabase
    .from('business_photos')
    .select('*')
    .eq('business_id', businessId)
    .order('sort_order')
  if (error) throw error
  return data as BusinessPhoto[]
}

export interface GalleryFeedItem {
  id: string
  url: string
  created_at: string
  business: Business
}

/** Newest-first cross-shop gallery feed for the Discover page — RLS on
 * business_photos already restricts this to active/approved shops. */
export async function fetchGalleryFeed(limit = 60): Promise<GalleryFeedItem[]> {
  const { data, error } = await supabase
    .from('business_photos')
    .select('id,url,created_at,business:businesses(*)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? [])
    .map((row) => ({ ...row, business: Array.isArray(row.business) ? row.business[0] : row.business }))
    .filter((row) => row.business) as GalleryFeedItem[]
}

const MAX_GALLERY_BYTES = 5 * 1024 * 1024
const ALLOWED_GALLERY_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

export async function uploadGalleryPhoto(businessId: string, file: File, sortOrder: number): Promise<BusinessPhoto> {
  await assertSafeUpload(file, ALLOWED_GALLERY_TYPES, MAX_GALLERY_BYTES, 'image')

  const ext = FILE_EXTENSION_BY_MIME[file.type]
  const path = `${businessId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage.from('gallery').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })
  if (uploadError) throw uploadError

  const { data: publicUrl } = supabase.storage.from('gallery').getPublicUrl(path)

  const { data, error } = await supabase
    .from('business_photos')
    .insert({ business_id: businessId, url: publicUrl.publicUrl, sort_order: sortOrder })
    .select()
    .single()
  if (error) throw error
  return data as BusinessPhoto
}

export async function deleteBusinessPhoto(id: string) {
  const { error } = await supabase.from('business_photos').delete().eq('id', id)
  if (error) throw error
}
