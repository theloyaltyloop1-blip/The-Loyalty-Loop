export interface GeocodeResult {
  lat: number
  lng: number
  displayName: string
}

/**
 * Geocodes via the Google Maps JavaScript API's Geocoder class (not the raw
 * REST endpoint — that one doesn't send CORS headers for browser calls).
 * Requires the Maps JS script to already be loaded (see `useGoogleMapsLoader`
 * in shop-map.tsx) and the Geocoding API enabled on the API key.
 */
export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const trimmed = query.trim()
  if (!trimmed || typeof google === 'undefined' || !google.maps) return null
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
