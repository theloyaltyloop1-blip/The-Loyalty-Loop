/**
 * The guided-tour script for the web owner pages. Pure (no React/DOM) so it can
 * be unit-tested with `node --test`. Mirrors apps/retailer/src/tour-logic.ts:
 * the same stops and words, found on the page by CSS selector instead of by a
 * registered ref. A stop whose element is not on the page is skipped silently.
 */

export type TourStopId = 'home-scan-tab' | 'scan-input' | 'shop-poster'

export interface TourStop {
  id: TourStopId
  /** True when the stop belongs on this route. */
  onRoute: (pathname: string) => boolean
  /** CSS selectors, first visible match wins. */
  selectors: string[]
  copy: string
}

export const TOUR_STOPS: readonly TourStop[] = [
  {
    id: 'home-scan-tab',
    onRoute: (p) => p === '/owner' || p === '/owner/analytics',
    selectors: ['a[href="/owner/scan"]'],
    copy: 'Open Scan when a customer pays.',
  },
  {
    id: 'scan-input',
    onRoute: (p) => p === '/owner/scan',
    selectors: ['input[aria-label="Customer\'s manual code"]'],
    copy: 'Scan their QR, or type their code.',
  },
  {
    id: 'shop-poster',
    onRoute: (p) => p === '/owner/settings' || p === '/owner/tools',
    selectors: ['nav[aria-label="Section"] a[href="/owner/tools"]'],
    copy: 'Print your QR poster here so customers can join.',
  },
]

export function tourSeenKey(businessId: string, stop: TourStopId): string {
  return `tour_seen_${businessId}_${stop}`
}

/** First unseen stop for this route whose element exists (`found` says which ids resolved). */
export function nextStop(args: {
  pathname: string
  seen: ReadonlySet<TourStopId>
  found: ReadonlySet<TourStopId>
  stops?: readonly TourStop[]
}): TourStop | null {
  const { pathname, seen, found, stops = TOUR_STOPS } = args
  return stops.find((s) => s.onRoute(pathname) && !seen.has(s.id) && found.has(s.id)) ?? null
}

export function remainingOnRoute(pathname: string, seen: ReadonlySet<TourStopId>, found: ReadonlySet<TourStopId>): number {
  return TOUR_STOPS.filter((s) => s.onRoute(pathname) && !seen.has(s.id) && found.has(s.id)).length
}
