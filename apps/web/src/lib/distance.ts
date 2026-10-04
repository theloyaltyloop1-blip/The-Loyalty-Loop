// Closest-first ordering for the "Find your next favourite" shops.
// Everything happens on the device: the user's position is never sent anywhere.
// Kept identical to apps/shopper/src/distance.ts (tested together).
export type Coords = { lat: number; lng: number }
type Located = { lat?: number | null; lng?: number | null }

const EARTH_RADIUS_MILES = 3958.8

// A shop with no pin, or one that failed geocoding and landed on 0,0, has no usable position.
function position(shop: Located): Coords | null {
  const { lat, lng } = shop
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  if (lat === 0 && lng === 0) return null
  return { lat, lng }
}

export function milesBetween(a: Coords, b: Coords): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function formatMiles(miles: number): string {
  if (miles < 0.1) return 'Under 0.1 mi'
  const tenth = Math.round(miles * 10) / 10
  return tenth < 10 ? `${tenth.toFixed(1)} mi` : `${Math.round(miles)} mi`
}

// Nearest first. Shops with no position keep their original order after the located ones.
export function nearestFirst<T extends Located>(shops: T[], from: Coords): { shop: T; miles: number | null }[] {
  const ranked = shops.map((shop, index) => {
    const at = position(shop)
    return { shop, index, miles: at ? milesBetween(from, at) : null }
  })
  ranked.sort((a, b) => {
    if (a.miles === null && b.miles === null) return a.index - b.index
    if (a.miles === null) return 1
    if (b.miles === null) return -1
    return a.miles - b.miles || a.index - b.index
  })
  return ranked.map(({ shop, miles }) => ({ shop, miles }))
}
