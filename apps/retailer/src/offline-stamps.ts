// Stamps saved on this phone while the shop has no signal, sent when the
// connection comes back. The rules (limits, order, retries, duplicates) are in
// offline-stamps-core.ts and its tests; this file only connects them to the
// phone's storage and to Supabase.
//
// Only stamps are saved. Spending a reward stays online-only, because two
// phones offline could otherwise both spend the same reward.
import { useEffect, useState } from 'react'
import Storage from 'expo-sqlite/kv-store'
import { supabase } from './supabase'
import { simulatedOutage } from './service-status'
import { createOfflineStampQueue, type AddResult, type DrainReport, type QueuedStamp, type SendResult } from './offline-stamps-core'

export { isNetworkFailure, MAX_AGE_MS, MAX_QUEUED } from './offline-stamps-core'
export type { DrainReport, QueuedStamp } from './offline-stamps-core'

// Synchronous key-value store (expo-sqlite), already used for the launch cache,
// so no native change is needed.
const queue = createOfflineStampQueue({
  get: (key) => Storage.getItemSync(key),
  set: (key, value) => Storage.setItemSync(key, value),
  remove: (key) => Storage.removeItemSync(key),
})

const listeners = new Set<() => void>()
const changed = () => {
  for (const listener of listeners) listener()
}

/** How long one stamp may take before we treat the signal as gone. */
export const STAMP_TIMEOUT_MS = 10_000

/** Insert one stamp. Never throws: a missing answer comes back as status 0. */
export async function insertStamp(
  item: Pick<QueuedStamp, 'ref' | 'userId' | 'businessId' | 'value' | 'paymentMethod'>,
  timeoutMs = STAMP_TIMEOUT_MS,
): Promise<SendResult> {
  // The hidden "Simulate outage" switch in Settings fakes no signal here too,
  // so the offline flow can be tried on a phone without turning Wi-Fi off.
  if (simulatedOutage()) return { status: 0, error: { message: 'Simulated outage' } }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const { status, error } = await supabase
      .from('transactions')
      .insert({
        user_id: item.userId,
        business_id: item.businessId,
        type: 'stamp',
        value: item.value,
        client_ref: item.ref,
        ...(item.paymentMethod ? { manual_payment_method: item.paymentMethod } : {}),
      })
      .abortSignal(controller.signal)
    return { status, error: error ? { code: error.code, message: error.message, details: error.details } : null }
  } catch (e) {
    return { status: 0, error: { message: e instanceof Error ? e.message : String(e) } }
  } finally {
    clearTimeout(timer)
  }
}

/** What happens once the server has accepted a stamp: the customer's thank-you,
 *  push and wallet pass. Only ever called after acceptance, so a shopper never
 *  hears about a stamp (or a reward) that was only saved on the phone. */
export function notifyStampAccepted(businessId: string, userId: string, value: number) {
  void supabase.functions.invoke('send-visit-thank-you', { body: { business_id: businessId, user_id: userId, amount: value } })
  void supabase.functions.invoke('send-user-push', { body: { business_id: businessId, user_id: userId } })
  void supabase.functions.invoke('update-wallet-pass', { body: { business_id: businessId, user_id: userId } })
}

export function saveStampOffline(staffId: string, item: Omit<QueuedStamp, 'savedAt'>): AddResult {
  const result = queue.add(staffId, item)
  changed()
  return result
}

/** Stamps waiting (a scan worth 2 stamps counts as 2). */
export function waitingStamps(staffId: string, businessId?: string): number {
  if (!staffId) return 0
  return queue.list(staffId, businessId).reduce((sum, item) => sum + item.value, 0)
}

/** Send what is waiting. `force` skips the backoff wait. */
export async function sendWaitingStamps(staffId: string, force = false): Promise<DrainReport> {
  const report = await queue.drain(staffId, (item) => insertStamp(item), force)
  for (const item of report.sent) notifyStampAccepted(item.businessId, item.userId, item.value)
  if (report.sent.length || report.rejected.length || report.expired.length) changed()
  return report
}

/** Live number of stamps waiting on this phone for this account (and shop). */
export function useWaitingStamps(staffId: string | null | undefined, businessId?: string | null): number {
  const read = () => (staffId ? waitingStamps(staffId, businessId ?? undefined) : 0)
  const [count, setCount] = useState(read)
  useEffect(() => {
    const update = () => setCount(read())
    update()
    listeners.add(update)
    return () => {
      listeners.delete(update)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId, businessId])
  return count
}
