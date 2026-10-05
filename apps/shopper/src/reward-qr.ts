// Reward QR format shared by the website, shopper app and retailer app.
// Keep the three copies identical (apps/api/test/reward-qr.test.mjs asserts it).
export const REWARD_QR_PREFIX = 'loyaltyloop:reward:'

const TOKEN = /^[0-9a-f]{32}$/i

/** What a reward QR code encodes. */
export function encodeRewardQr(token: string): string {
  return `${REWARD_QR_PREFIX}${token}`
}

/**
 * Reads a scanned/typed value. Accepts exactly one 32-hex token, either raw
 * (legacy website QR codes) or after a single `loyaltyloop:reward:` prefix.
 * Anything else (double prefixes, customer payloads, other lengths) is null.
 */
export function parseRewardQr(value: string): string | null {
  const v = value.trim()
  const token = v.startsWith(REWARD_QR_PREFIX) ? v.slice(REWARD_QR_PREFIX.length) : v
  return TOKEN.test(token) ? token.toLowerCase() : null
}
