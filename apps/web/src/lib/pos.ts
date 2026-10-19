import { supabase } from './supabase'

export interface PosConnectionStatus {
  connected: boolean
  status?: 'active' | 'needs_reconnect'
  lastSyncedAt?: string | null
  lastError?: string | null
}

export interface PosReviewCandidate {
  scanId: string
  customerId: string
  name: string
  scannedAt: string
}

export interface PosReviewSale {
  saleId: string
  amountPence: number
  occurredAt: string
  candidates: PosReviewCandidate[]
}

const CONNECT_ERRORS: Record<string, string> = {
  shop_not_spend_based: 'Switch your shop to spend-based rewards before connecting your till.',
  sumup_not_configured: 'SumUp is not set up on our side yet. Please try again later.',
  forbidden: 'Only the shop owner can connect a till.',
}

async function callConnect(action: 'start' | 'disconnect', businessId: string): Promise<{ url?: string }> {
  const { data, error } = await supabase.functions.invoke('sumup-connect', {
    body: { action, business_id: businessId },
  })
  if (error) {
    // The function answers with { error: code } on a refusal.
    let code = ''
    try { code = (await (error as { context?: Response }).context?.json())?.error ?? '' } catch { /* not JSON */ }
    throw new Error(CONNECT_ERRORS[code] ?? 'Could not reach SumUp. Please try again.')
  }
  return (data ?? {}) as { url?: string }
}

export async function fetchPosConnection(businessId: string): Promise<PosConnectionStatus> {
  const { data, error } = await supabase.rpc('pos_connection_status', { _business_id: businessId })
  if (error) throw error
  return data as PosConnectionStatus
}

/** Returns the SumUp page the owner must visit to approve access. */
export async function startSumUpConnect(businessId: string): Promise<string> {
  const { url } = await callConnect('start', businessId)
  if (!url) throw new Error('Could not reach SumUp. Please try again.')
  return url
}

export async function disconnectSumUp(businessId: string): Promise<void> {
  await callConnect('disconnect', businessId)
}

/** Whether sales for this shop arrive from the till (so no amount is typed). */
export async function isPosConnected(businessId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('pos_is_connected', { _business_id: businessId })
  if (error) throw error
  return data === true
}

export interface PosScanResult {
  status: 'recorded' | 'refreshed' | 'busy' | 'not_connected' | 'duplicate'
  scanId?: string
  /** Set when status is 'busy': the customer who is still waiting to pay. */
  customerId?: string
  name?: string
}

/** Only one customer can wait to pay at a time; a second scan comes back 'busy'. */
export async function recordPosScan(businessId: string, customerId: string): Promise<PosScanResult> {
  const { data, error } = await supabase.rpc('record_pos_scan', { _business_id: businessId, _customer_id: customerId })
  if (error) throw error
  return data as PosScanResult
}

/** Asks the server to look for the shop's newest till sales right now. */
export async function checkTillNow(businessId: string): Promise<void> {
  await supabase.functions.invoke('sumup-check', { body: { business_id: businessId } })
}

export interface PosScanStatus {
  status: 'pending' | 'matched' | 'expired'
  amountPence: number | null
}

export async function fetchPosScanStatus(scanId: string): Promise<PosScanStatus> {
  const { data, error } = await supabase.rpc('pos_scan_status', { _scan_id: scanId })
  if (error) throw error
  return data as PosScanStatus
}

export async function cancelPosScan(businessId: string, customerId: string): Promise<void> {
  const { error } = await supabase.rpc('pos_cancel_scan', { _business_id: businessId, _customer_id: customerId })
  if (error) throw error
}

export async function fetchPosReview(businessId: string): Promise<PosReviewSale[]> {
  const { data, error } = await supabase.rpc('pos_pending_review', { _business_id: businessId })
  if (error) throw error
  return (data ?? []) as PosReviewSale[]
}

/** A null scanId dismisses the sale ("nobody I know paid for this"). */
export async function resolvePosSale(saleId: string, scanId: string | null): Promise<void> {
  const { error } = await supabase.rpc('pos_resolve_sale', { _sale_id: saleId, _scan_id: scanId })
  if (error) throw error
}

export interface PosRecentSale {
  saleId: string
  amountPence: number
  occurredAt: string
  name: string
}

export async function fetchPosRecent(businessId: string): Promise<PosRecentSale[]> {
  const { data, error } = await supabase.rpc('pos_recent_matched', { _business_id: businessId })
  if (error) throw error
  return (data ?? []) as PosRecentSale[]
}

/** Owner only: voids a credit that went to the wrong customer. */
export async function undoPosSale(saleId: string): Promise<void> {
  const { error } = await supabase.rpc('pos_undo_sale', { _sale_id: saleId })
  if (error) throw error
}
