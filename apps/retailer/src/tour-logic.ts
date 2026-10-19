/**
 * Pure parts of the guided tour (no React), so they can be unit-tested with
 * `node --test`: the script of stops, their copy, the SecureStore keys and
 * which stop to show next.
 */
/** Mirrors `ProgrammeId` in @loyalty-loop/loyalty (not imported so node --test can load this file). */
export type ProgrammeId = 'stamps' | 'spend' | 'tiers' | 'points'

export type TourScreen = 'home' | 'scan' | 'settings'

export type TourStopId = 'home-scan-tab' | 'scan-input' | 'scan-result' | 'shop-programme' | 'shop-poster'

export interface TourStop {
  id: TourStopId
  screen: TourScreen
  /** The id a `<TourTarget>` registers under. */
  target: string
}

/** Order matters: stops on one screen are shown in this order. */
export const TOUR_STOPS: readonly TourStop[] = [
  { id: 'home-scan-tab', screen: 'home', target: 'tab-scan' },
  { id: 'scan-input', screen: 'scan', target: 'scan-input' },
  { id: 'scan-result', screen: 'scan', target: 'scan-result' },
  { id: 'shop-programme', screen: 'settings', target: 'tour-programme-tile' },
  { id: 'shop-poster', screen: 'settings', target: 'tour-poster-tile' },
]

const SCAN_RESULT_COPY: Record<ProgrammeId, string> = {
  stamps: 'Tap once to add a stamp.',
  spend: 'Enter what they spent.',
  tiers: 'Their level and perks show here.',
  points: 'Their points balance shows here.',
}

/** `programme` comes from `programmeIdFor(business)` in @loyalty-loop/loyalty. */
export function tourCopy(stop: TourStopId, programme: ProgrammeId = 'stamps'): string {
  switch (stop) {
    case 'home-scan-tab':
      return 'Open Scan when a customer pays.'
    case 'scan-input':
      return 'Scan their QR, or type their code.'
    case 'scan-result':
      return SCAN_RESULT_COPY[programme] ?? SCAN_RESULT_COPY.stamps
    case 'shop-programme':
      return 'These are the rewards your customers work towards.'
    case 'shop-poster':
      return 'Print this so customers can join.'
  }
}

/** SecureStore keys only allow letters, digits, ".", "-" and "_". */
export function tourSeenKey(businessId: string, stop: TourStopId): string {
  return `tour_seen_${businessId.replace(/[^A-Za-z0-9]/g, '')}_${stop.replace(/-/g, '_')}`
}

/**
 * The stop to show now: the first unseen stop for this screen whose target is
 * registered and has not already failed to measure. Unregistered targets are
 * skipped silently.
 */
export function nextStop(args: {
  screen: TourScreen | null
  seen: ReadonlySet<TourStopId>
  registered: ReadonlySet<string>
  skipped?: ReadonlySet<TourStopId>
  stops?: readonly TourStop[]
}): TourStop | null {
  const { screen, seen, registered, skipped, stops = TOUR_STOPS } = args
  if (!screen) return null
  return (
    stops.find(
      (stop) =>
        stop.screen === screen && !seen.has(stop.id) && !skipped?.has(stop.id) && registered.has(stop.target),
    ) ?? null
  )
}

/** Stops on this screen still unseen (for the "1 of 2" counter). */
export function remainingOnScreen(
  screen: TourScreen,
  seen: ReadonlySet<TourStopId>,
  stops: readonly TourStop[] = TOUR_STOPS,
): TourStop[] {
  return stops.filter((stop) => stop.screen === screen && !seen.has(stop.id))
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** True when a measured target is on screen and big enough to point at. */
export function rectIsUsable(rect: Rect, viewport: { width: number; height: number }): boolean {
  if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)) return false
  if (rect.width < 4 || rect.height < 4) return false
  return rect.x + rect.width > 0 && rect.y + rect.height > 0 && rect.x < viewport.width && rect.y < viewport.height
}

/** Callout goes below the spotlight when it sits in the top half, otherwise above. */
export function calloutPlacement(rect: Rect, viewportHeight: number): 'above' | 'below' {
  return rect.y + rect.height / 2 < viewportHeight / 2 ? 'below' : 'above'
}
