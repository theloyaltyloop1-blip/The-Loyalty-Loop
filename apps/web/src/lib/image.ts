// Widths must match `images.sizes` in vercel.json, or Vercel rejects the request.
export const IMAGE_WIDTHS = [96, 160, 320, 640, 1080] as const
type ImageWidth = (typeof IMAGE_WIDTHS)[number]

const SUPABASE_PUBLIC = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//

/**
 * Shop logos, covers and gallery photos are uploaded at full camera size.
 * In deployed builds, route Supabase public URLs through Vercel's image
 * optimiser so it resizes and re-encodes (WebP/AVIF) on the server and
 * caches the result. Locally (no optimiser) and for any other URL, the
 * original is returned unchanged.
 */
export function resizedImage(url: string, width: ImageWidth, quality = 75): string {
  if (!import.meta.env.PROD || !SUPABASE_PUBLIC.test(url)) return url
  return `/_vercel/image?url=${encodeURIComponent(url)}&w=${width}&q=${quality}`
}
