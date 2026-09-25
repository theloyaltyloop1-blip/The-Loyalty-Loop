import * as React from 'react'
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api'
import type { Business } from '@/lib/businesses'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
const PIN_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL as string | undefined}/functions/v1/map-pin`

/** Balham, London — used as a sane default map center before an owner has
 * entered/confirmed a real address. */
export const DEFAULT_MAP_CENTER = { lat: 51.4514, lng: -0.1447 }

function initialsOf(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '').join('') || '?'
}

/** Uses the same server-rendered Loyalty Loop pin artwork as the shopper apps. */
function businessPinIcon(business: Business) {
  const params = [`color=${encodeURIComponent(business.brand_color || '#E8703B')}`, `initials=${encodeURIComponent(initialsOf(business.name))}`, 'scale=2']
  if (business.logo_url) params.push(`logo=${encodeURIComponent(business.logo_url)}`)
  return { url: `${PIN_ENDPOINT}?${params.join('&')}`, scaledSize: new google.maps.Size(60, 66), anchor: new google.maps.Point(30, 60) }
}

/** Shared loader — every ShopMap instance on a page uses the same script-load
 * state (via the same `id`), so the Maps JS API is only ever injected once. */
function useGoogleMapsLoader() {
  return useJsApiLoader({
    id: 'loyalty-loop-google-maps',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY ?? '',
  })
}

/**
 * A Google Map showing a single pin. In editable mode the pin can be dragged
 * or the map clicked to reposition it (used when an owner is setting or
 * confirming their shop's location); otherwise it's a static preview.
 */
export function ShopMap({
  lat,
  lng,
  color = '#E8703B',
  editable = false,
  onChange,
  height = 220,
  zoom = 15,
}: {
  lat: number
  lng: number
  color?: string
  editable?: boolean
  onChange?: (lat: number, lng: number) => void
  height?: number
  zoom?: number
}) {
  const { isLoaded, loadError } = useGoogleMapsLoader()

  const icon = React.useMemo(() => {
    if (!isLoaded) return undefined
    return {
      url:
        'data:image/svg+xml;charset=UTF-8,' +
        encodeURIComponent(
          `<svg width="30" height="40" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20c0-6.6-5.4-12-12-12z" fill="${color}" stroke="white" stroke-width="1.5"/>
            <circle cx="12" cy="12" r="4.5" fill="white"/>
          </svg>`
        ),
      scaledSize: new google.maps.Size(30, 40),
      anchor: new google.maps.Point(15, 40),
    }
  }, [isLoaded, color])

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div
        style={{ height }}
        className="rounded-2xl border border-black/10 bg-black/5 flex items-center justify-center text-sm text-foreground/40"
      >
        Map unavailable — no Google Maps API key configured.
      </div>
    )
  }
  if (loadError) {
    return (
      <div
        style={{ height }}
        className="rounded-2xl border border-black/10 bg-black/5 flex items-center justify-center text-sm text-foreground/40"
      >
        Could not load the map.
      </div>
    )
  }
  if (!isLoaded) {
    return <div style={{ height }} className="rounded-2xl border border-black/10 bg-black/5 animate-pulse" />
  }

  return (
    <div style={{ height, borderRadius: 16, overflow: 'hidden' }} className="border border-black/10">
      <GoogleMap
        mapContainerStyle={{ height: '100%', width: '100%' }}
        center={{ lat, lng }}
        zoom={zoom}
        options={{
          disableDefaultUI: !editable,
          zoomControl: editable,
          gestureHandling: editable ? 'greedy' : 'cooperative',
          clickableIcons: false,
        }}
        onClick={editable && onChange ? (e) => e.latLng && onChange(e.latLng.lat(), e.latLng.lng()) : undefined}
      >
        <Marker
          position={{ lat, lng }}
          icon={icon}
          draggable={editable}
          onDragEnd={
            editable && onChange
              ? (e) => {
                  if (e.latLng) onChange(e.latLng.lat(), e.latLng.lng())
                }
              : undefined
          }
        />
      </GoogleMap>
    </div>
  )
}

/** A browseable map of every shop with a confirmed location. */
export function BusinessesMap({ businesses, onSelect, height = 560 }: { businesses: Business[]; onSelect: (business: Business) => void; height?: number }) {
  const { isLoaded, loadError } = useGoogleMapsLoader()
  const locatedBusinesses = businesses.filter((business) => business.lat != null && business.lng != null)
  if (!GOOGLE_MAPS_API_KEY) return <MapUnavailable height={height} message="Map unavailable — no Google Maps API key configured." />
  if (loadError) return <MapUnavailable height={height} message="Could not load the map." />
  if (!isLoaded) return <div style={{ height }} className="rounded-2xl bg-black/5 animate-pulse" />
  return <div style={{ height, borderRadius: 16, overflow: 'hidden' }} className="border border-black/10"><GoogleMap mapContainerStyle={{ height: '100%', width: '100%' }} center={DEFAULT_MAP_CENTER} zoom={13} options={{ clickableIcons: false, gestureHandling: 'greedy', streetViewControl: false, mapTypeControl: false }} onLoad={(map) => { if (!locatedBusinesses.length) return; if (locatedBusinesses.length === 1) { map.setCenter({ lat: locatedBusinesses[0].lat!, lng: locatedBusinesses[0].lng! }); map.setZoom(15); return }; const bounds = new google.maps.LatLngBounds(); locatedBusinesses.forEach((business) => bounds.extend({ lat: business.lat!, lng: business.lng! })); map.fitBounds(bounds, 56) }}>{locatedBusinesses.map((business) => <Marker key={business.id} position={{ lat: business.lat!, lng: business.lng! }} icon={businessPinIcon(business)} title={business.name} onClick={() => onSelect(business)} />)}</GoogleMap></div>
}

function MapUnavailable({ height, message }: { height: number; message: string }) {
  return <div style={{ height }} className="rounded-2xl border border-black/10 bg-black/5 flex items-center justify-center px-6 text-center text-sm text-foreground/40">{message}</div>
}
