// Pure logic for the Ask Whirl chat sheet. IDENTICAL in apps/shopper/src and
// apps/retailer/src (ask-whirl-core.test.mjs checks the two copies match), so
// it has no imports and no React.

export type AskMode = 'shopper' | 'business'
export type ChatMessage = { role: 'user' | 'assistant'; content: string }

/** What the sheet is doing right now. Drives the text and Whirl's pose. */
export type AskState = 'idle' | 'thinking' | 'answered' | 'refused' | 'error' | 'offline' | 'minute' | 'day' | 'resting'

/** Pose names the design asks for. `oops` is not drawn yet: see resolvePose. */
export type AskPose = 'wave' | 'think' | 'thumbs' | 'sleepy' | 'oops'
export type DrawnPose = 'wave' | 'stamp' | 'celebrate' | 'sleepy' | 'think' | 'thumbs' | 'oops' | 'point' | 'peek'

export const MAX_HISTORY = 10
export const MAX_INPUT_CHARS = 500
export const NOTICE_KEY = 'ask_whirl_notice_v1'

export const NOTICE_TEXT =
  'Whirl uses AI. Your question (and, for shoppers, your cards and rewards at shops you have joined; for shops, your totals) is sent to our AI provider, Groq in the US, to write the answer. We do not keep the chat, and we never send your name, email or phone number. Please do not type anything private. Whirl can get things wrong: check with the shop.'

export const STARTERS: Record<AskMode, string[]> = {
  shopper: ['Where can I earn stamps near me?', 'How close am I to a reward?', 'How do stamps work?'],
  business: ['How do I get more repeat visits?', 'How do I print my QR poster?', 'What do my numbers mean?'],
}

export const COPY: Record<Exclude<AskState, 'idle' | 'thinking' | 'answered'>, { text: string; retry: boolean }> = {
  refused: { text: 'I can only help with The Loyalty Loop, so that one is outside my patch. Try asking about stamps, rewards or finding a shop.', retry: false },
  error: { text: 'I got tangled up. Try again?', retry: true },
  offline: { text: 'I need the internet to think. Back when you are.', retry: true },
  minute: { text: 'Give me a moment, then ask again.', retry: false },
  day: { text: "I'm all talked out for today. Back tomorrow.", retry: false },
  resting: { text: 'Whirl is resting at the moment. Please try again later.', retry: false },
}

/** Which pose to show. Thumbs-up only for an answer; the apps keep it for a moment, then wave. */
export function poseFor(state: AskState, hasMessages: boolean): AskPose {
  switch (state) {
    case 'thinking': return 'think'
    case 'answered': return 'thumbs'
    case 'error':
    case 'refused': return 'oops'
    case 'offline':
    case 'minute':
    case 'day':
    case 'resting': return 'sleepy'
    default: return hasMessages ? 'wave' : 'wave'
  }
}

/** Poses the Whirl kit draws. A pose missing from `available` falls back to the closest one. */
export function resolvePose(pose: AskPose, available: readonly string[] = ['wave', 'stamp', 'celebrate', 'sleepy', 'think', 'thumbs', 'oops', 'point', 'peek']): DrawnPose {
  if (available.includes(pose)) return pose as DrawnPose
  return pose === 'oops' ? 'sleepy' : 'wave'
}

/**
 * Turn a failed call into a state. `status` is the HTTP status when the server
 * answered, null when the request never got there (no network).
 */
export function classifyFailure(status: number | null, body: unknown): Exclude<AskState, 'idle' | 'thinking' | 'answered' | 'refused'> {
  if (status === null) return 'offline'
  const b = (body && typeof body === 'object' ? body : {}) as { scope?: unknown; error?: unknown; reason?: unknown }
  if (status === 429) {
    if (b.scope === 'day' || b.scope === 'global') return 'day'
    if (typeof b.error === 'string' && /daily|resting|tomorrow/i.test(b.error)) return 'day'
    return 'minute'
  }
  if (status === 503) return 'resting'
  return 'error'
}

/** The last turns, user and assistant only, trimmed, ready to send. Nothing else is ever sent. */
export function toRequestMessages(history: ChatMessage[], next: string): ChatMessage[] {
  const text = next.trim().slice(0, MAX_INPUT_CHARS)
  return [...history, { role: 'user' as const, content: text }]
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content.trim().length > 0)
    .slice(-MAX_HISTORY)
}

/** Coarse location for the shopper function: rounded to 2 dp (about 1 km). */
export function coarseNear(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 }
}
