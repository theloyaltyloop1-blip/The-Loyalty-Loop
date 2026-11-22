// Win-back coupon QR format, shared by the email (send-winback-emails), the shopper app and the
// Business app. Keep the copies identical. The code itself is COMEBACK + 8 characters.
export const WINBACK_QR_PREFIX = 'loyaltyloop:winback:'

const CODE = /^COMEBACK[A-Z0-9]{8}$/

export function encodeWinbackQr(code: string): string {
  return `${WINBACK_QR_PREFIX}${code}`
}

/** Reads a scanned value. Returns the coupon code, or null if it is not a win-back QR. */
export function parseWinbackQr(value: string): string | null {
  const v = value.trim()
  if (!v.toLowerCase().startsWith(WINBACK_QR_PREFIX)) return null
  const code = v.slice(WINBACK_QR_PREFIX.length).replace(/\s+/g, '').toUpperCase()
  return CODE.test(code) ? code : null
}
