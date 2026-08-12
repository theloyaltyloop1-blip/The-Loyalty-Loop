export interface GeocodeResult {
  lat: number
  lng: number
  displayName: string
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Waits for the Google Maps JS script (loaded by a mounted `<ShopMap>` via
 * `useJsApiLoader`) to finish initializing, polling briefly rather than
 * failing immediately if a geocode is requested just before it's ready. */
async function waitForGoogleMaps(timeoutMs = 4000): Promise<boolean> {
  const start = Date.now()
  while (typeof google === 'undefined' || !google.maps?.Geocoder) {
    if (Date.now() - start > timeoutMs) return false
    await wait(150)
  }
  return true
}

/**
 * Geocodes via the Google Maps JavaScript API's Geocoder class (not the raw
 * REST endpoint — that one doesn't send CORS headers for browser calls).
 * Requires a `<ShopMap>` to be mounted somewhere on the page so the script
 * loads (see `shop-map.tsx`) — this waits briefly for that if needed.
 */
export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const trimmed = query.trim()
  if (!trimmed) return null
  const ready = await waitForGoogleMaps()
  if (!ready) return null
  const geocoder = new google.maps.Geocoder()
  try {
    const { results } = await geocoder.geocode({ address: trimmed })
    const first = results[0]
    if (!first) return null
    return {
      lat: first.geometry.location.lat(),
      lng: first.geometry.location.lng(),
      displayName: first.formatted_address,
    }
  } catch {
    return null
  }
}
