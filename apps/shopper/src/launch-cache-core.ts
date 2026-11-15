// Pure logic for the launch snapshot cache and the "was this session really
// rejected?" decision. No Expo imports, so `node --test` can run it directly.
//
// What the cache is for: paint the last good home-screen data straight away,
// then refresh behind it. Rules enforced here:
//  - every entry belongs to one user id; a read for another user returns null
//  - entries expire after 7 days
//  - clear() (sign-out) removes every entry AND bumps a generation counter, so
//    a request that was already in flight cannot re-create the cache afterwards
//  - stripSecrets() removes any key that looks like a token, secret, key,
//    password or IBAN before something is written
// Callers must still only pass display data. Never reward QR tokens, stamp
// codes, access tokens or card numbers.

export type KV = {
  get: (key: string) => string | null
  set: (key: string, value: string) => void
  remove: (key: string) => void
}

export type Snapshot<T> = { data: T; savedAt: number }

export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const PREFIX = 'launch-cache.v1.'
const INDEX_KEY = `${PREFIX}index`
const SECRET_KEY = /token|secret|key|password|iban/i

/** Deep copy without any property whose name looks secret. */
export function stripSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => stripSecrets(item)) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!SECRET_KEY.test(k)) out[k] = stripSecrets(v)
    }
    return out as T
  }
  return value
}

/** Is this auth error the server genuinely rejecting the session? Offline,
 *  timeouts, 5xx and unknown errors are NOT rejections: keep the user in. */
export function isSessionRejection(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { name?: string; status?: number; code?: string }
  if (e.name === 'AuthRetryableFetchError') return false
  if (e.status === 401 || e.status === 403) return true
  if (e.code && /refresh_token_not_found|refresh_token_already_used|session_not_found|session_expired|bad_jwt|user_not_found/.test(e.code)) return true
  return e.name === 'AuthSessionMissingError'
}

export function createLaunchCache(kv: KV, now: () => number = Date.now) {
  let generation = 0
  const entryKey = (scope: string, userId: string) => `${PREFIX}${scope}.${userId}`

  const readIndex = (): string[] => {
    try {
      const parsed = JSON.parse(kv.get(INDEX_KEY) || '[]')
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
    } catch {
      return []
    }
  }

  return {
    /** Take before starting a fetch; pass to write(). */
    ticket: () => generation,

    read<T>(scope: string, userId: string): Snapshot<T> | null {
      try {
        const raw = kv.get(entryKey(scope, userId))
        if (!raw) return null
        const parsed = JSON.parse(raw) as { userId?: string; savedAt?: number; data?: T }
        if (parsed.userId !== userId || typeof parsed.savedAt !== 'number') return null
        const age = now() - parsed.savedAt
        if (age > MAX_AGE_MS || age < -60_000 || parsed.data === undefined) return null
        return { data: parsed.data, savedAt: parsed.savedAt }
      } catch {
        return null
      }
    },

    /** Returns false if nothing was written (stale ticket or storage failure). */
    write(scope: string, userId: string, data: unknown, ticket: number): boolean {
      if (ticket !== generation) return false
      try {
        const key = entryKey(scope, userId)
        kv.set(key, JSON.stringify({ userId, savedAt: now(), data: stripSecrets(data) }))
        const index = readIndex()
        if (!index.includes(key)) kv.set(INDEX_KEY, JSON.stringify([...index, key]))
        return true
      } catch {
        return false
      }
    },

    /** Sign-out: delete everything and invalidate writes already in flight. */
    clear(): void {
      generation++
      for (const key of readIndex()) {
        try { kv.remove(key) } catch { /* best effort */ }
      }
      try { kv.remove(INDEX_KEY) } catch { /* best effort */ }
    },
  }
}
