// Pure logic for stamps saved on the phone while the shop has no signal.
// No Expo or Supabase imports, so `node --test` can run it directly
// (offline-stamps.test.mjs). The Expo/Supabase wiring is in offline-stamps.ts.
//
// Rules enforced here:
//  - only a network failure (no answer at all, timeout, 401 while the session
//    refreshes, 408/429/5xx) queues or retries a stamp; any other answer from
//    the server is a real refusal and is reported, never retried
//  - every stamp carries a client reference made on the phone. The database
//    has a unique index on transactions.client_ref, so sending the same stamp
//    twice (a retry after a timeout that actually got through) gives one stamp,
//    and the duplicate answer (Postgres 23505 on client_ref) counts as sent
//  - at most MAX_QUEUED stamps wait per signed-in account, and a stamp older
//    than MAX_AGE_MS is dropped instead of sent, so a phone left offline for
//    days cannot build up stamps without limit
//  - stamps are sent oldest first; the first network failure stops the round
//    (order kept) and the next timed round waits with backoff
//  - each account has its own queue; it survives the app closing and signing out

export type KV = {
  get: (key: string) => string | null
  set: (key: string, value: string) => void
  remove: (key: string) => void
}

export type QueuedStamp = {
  /** Client reference, also written to transactions.client_ref. */
  ref: string
  /** The customer being stamped. */
  userId: string
  businessId: string
  value: number
  paymentMethod: 'cash' | 'unlinked_card' | null
  /** First name if it was known when scanned, for the owner's report only. */
  name: string | null
  savedAt: number
}

export type SendResult = {
  /** HTTP status; 0 means no answer (offline, DNS, timeout, aborted). */
  status: number
  error: { code?: string | null; message?: string | null; details?: string | null } | null
}

export type Outcome = 'sent' | 'retry' | 'rejected'

export const MAX_QUEUED = 200
export const MAX_AGE_MS = 48 * 60 * 60 * 1000
export const BACKOFF_BASE_MS = 5_000
export const BACKOFF_MAX_MS = 5 * 60 * 1000

const PREFIX = 'offline-stamps.v1.'

/** What a server answer means for a stamp that was sent. */
export function classify(result: SendResult): Outcome {
  const { status, error } = result
  if (!error) return status === 0 ? 'retry' : 'sent'
  const text = `${error.message ?? ''} ${error.details ?? ''}`
  if (error.code === '23505' && text.includes('client_ref')) return 'sent'
  if (isNetworkFailure(status)) return 'retry'
  return 'rejected'
}

/** True when the request never got a real answer from our servers. */
export function isNetworkFailure(status: number): boolean {
  return status === 0 || status === 401 || status === 408 || status === 429 || status >= 500
}

export function backoffMs(attempts: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1))
}

type State = { items: QueuedStamp[]; attempts: number; nextAttemptAt: number }
const EMPTY: State = { items: [], attempts: 0, nextAttemptAt: 0 }

function validItem(x: unknown): x is QueuedStamp {
  if (!x || typeof x !== 'object') return false
  const i = x as Record<string, unknown>
  return (
    typeof i.ref === 'string' && i.ref.length > 0 &&
    typeof i.userId === 'string' && i.userId.length > 0 &&
    typeof i.businessId === 'string' && i.businessId.length > 0 &&
    typeof i.value === 'number' && Number.isInteger(i.value) && i.value >= 1 &&
    typeof i.savedAt === 'number' &&
    (i.paymentMethod === null || i.paymentMethod === 'cash' || i.paymentMethod === 'unlinked_card') &&
    (i.name === null || typeof i.name === 'string')
  )
}

export type AddResult = { ok: true; count: number } | { ok: false; reason: 'full' | 'invalid' }

export type DrainReport = {
  sent: QueuedStamp[]
  rejected: { item: QueuedStamp; error: SendResult['error'] }[]
  expired: QueuedStamp[]
  /** True when the round stopped on a network failure; stamps are still waiting. */
  stillOffline: boolean
  /** True when nothing was tried because the backoff time had not come yet. */
  skipped: boolean
}

export function createOfflineStampQueue(kv: KV, now: () => number = Date.now) {
  const key = (staffId: string) => `${PREFIX}${staffId}`
  const draining = new Set<string>()

  const read = (staffId: string): State => {
    try {
      const raw = kv.get(key(staffId))
      if (!raw) return { ...EMPTY, items: [] }
      const parsed = JSON.parse(raw) as Partial<State>
      const items = Array.isArray(parsed.items) ? parsed.items.filter(validItem) : []
      return {
        items: items.sort((a, b) => a.savedAt - b.savedAt),
        attempts: typeof parsed.attempts === 'number' ? parsed.attempts : 0,
        nextAttemptAt: typeof parsed.nextAttemptAt === 'number' ? parsed.nextAttemptAt : 0,
      }
    } catch {
      return { ...EMPTY, items: [] }
    }
  }

  const write = (staffId: string, state: State) => {
    try {
      if (!state.items.length) kv.remove(key(staffId))
      else kv.set(key(staffId), JSON.stringify(state))
    } catch {
      // Storage unavailable: nothing more we can do on the phone.
    }
  }

  /** Too old, or dated in the future by more than a minute (clock changed). */
  const isExpired = (item: QueuedStamp) => {
    const age = now() - item.savedAt
    return age > MAX_AGE_MS || age < -60_000
  }

  const list = (staffId: string, businessId?: string): QueuedStamp[] => {
    const items = read(staffId).items
    return businessId ? items.filter((i) => i.businessId === businessId) : items
  }

  return {
    list,

    count(staffId: string, businessId?: string): number {
      return list(staffId, businessId).length
    },

    add(staffId: string, item: Omit<QueuedStamp, 'savedAt'> & { savedAt?: number }): AddResult {
      const full = { ...item, savedAt: item.savedAt ?? now() }
      if (!staffId || !validItem(full)) return { ok: false, reason: 'invalid' }
      const state = read(staffId)
      // The same stamp saved twice (double tap) stays one stamp.
      if (state.items.some((i) => i.ref === full.ref)) return { ok: true, count: state.items.length }
      const live = state.items.filter((i) => !isExpired(i))
      if (live.length >= MAX_QUEUED) return { ok: false, reason: 'full' }
      // A new stamp is a fresh reason to try soon: don't make it wait out an old backoff.
      write(staffId, { items: [...state.items, full], attempts: 0, nextAttemptAt: 0 })
      return { ok: true, count: state.items.length + 1 }
    },

    /** When the next timed round may run (0 = now). */
    nextAttemptAt(staffId: string): number {
      return read(staffId).nextAttemptAt
    },

    /**
     * Send waiting stamps oldest first. `force` ignores the backoff (app came
     * to the front, connection came back, owner tapped "Send now").
     */
    async drain(staffId: string, send: (item: QueuedStamp) => Promise<SendResult>, force = false): Promise<DrainReport> {
      const report: DrainReport = { sent: [], rejected: [], expired: [], stillOffline: false, skipped: false }
      if (!staffId || draining.has(staffId)) return { ...report, skipped: true }
      const first = read(staffId)
      if (!first.items.length) return report
      if (!force && first.nextAttemptAt > now()) return { ...report, skipped: true }
      draining.add(staffId)
      try {
        while (true) {
          // Re-read each time: a stamp may have been added while one was sending.
          const state = read(staffId)
          const item = state.items[0]
          if (!item) break
          if (isExpired(item)) {
            report.expired.push(item)
            write(staffId, { ...state, items: state.items.filter((i) => i.ref !== item.ref) })
            continue
          }
          let result: SendResult
          try {
            result = await send(item)
          } catch (e) {
            result = { status: 0, error: { message: e instanceof Error ? e.message : String(e) } }
          }
          const outcome = classify(result)
          const latest = read(staffId)
          if (outcome === 'retry') {
            const attempts = latest.attempts + 1
            write(staffId, { ...latest, attempts, nextAttemptAt: now() + backoffMs(attempts) })
            report.stillOffline = true
            break
          }
          const rest = latest.items.filter((i) => i.ref !== item.ref)
          write(staffId, { items: rest, attempts: 0, nextAttemptAt: 0 })
          if (outcome === 'sent') report.sent.push(item)
          else report.rejected.push({ item, error: result.error })
        }
      } finally {
        draining.delete(staffId)
      }
      return report
    },
  }
}

export type OfflineStampQueue = ReturnType<typeof createOfflineStampQueue>
