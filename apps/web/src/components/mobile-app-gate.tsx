import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { APPS } from '@/lib/store-links'
import { LoopMark } from '@/components/loop-mark'

// On a phone the website steps aside for the app: a full-screen "Continue in our
// app!" sheet, then a hop to the store after a short pause. Android goes to Google
// Play, iPhone/iPad to the App Store. Business pages send owners to the Business app.
//
// Left alone: desktops, search-engine crawlers (Googlebot's mobile UA says Android,
// and redirecting it would wreck indexing), and the pages a phone must be able to
// finish on the web — email sign-in and password-reset links, the WhatsApp sign-up
// and card pages (people arrive from WhatsApp on their phone), and the admin panel.
// "Continue on the website" (or ?web=1) dismisses it for the rest of the visit.

const DISMISS_KEY = 'loyalty-loop-stay-on-web'
const REDIRECTED_KEY = 'loyalty-loop-store-redirected'
const REDIRECT_DELAY_MS = 1600
const WEB_ONLY_PATHS = ['/auth/', '/reset-password', '/forgot-password', '/access', '/whatsapp']
const BUSINESS_PATHS = ['/owner', '/join', '/signup/owner']

const BUSINESS_KEY = 'loyalty-loop-came-for-business'

type Platform = 'android' | 'ios'

function isBusinessPath(pathname: string) {
  return BUSINESS_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function detectPlatform(): Platform | null {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent
  if (/bot|crawl|spider|slurp|lighthouse|headless|preview/i.test(ua)) return null
  if (/android/i.test(ua)) return 'android'
  // iPadOS 13+ reports itself as a Mac, so also check for a touch screen.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  return null
}

function readSession(key: string) {
  try { return window.sessionStorage.getItem(key) } catch { return null }
}
function writeSession(key: string, value: string) {
  try { window.sessionStorage.setItem(key, value) } catch { /* private mode: fine */ }
}

export function MobileAppGate() {
  const { pathname, search } = useLocation()
  const [platform] = useState(detectPlatform)
  const [dismissedByUser, setDismissed] = useState(() => readSession(DISMISS_KEY) === '1')
  const webParam = new URLSearchParams(search).get('web') === '1'
  const dismissed = dismissedByUser || webParam

  // ?web=1 keeps the website for the rest of the visit, not just this page.
  useEffect(() => {
    if (webParam) writeSession(DISMISS_KEY, '1')
  }, [webParam])

  // Signed-out visits to /owner bounce straight to /login, so remember that the
  // visit began on a business page and keep pointing them at the Business app.
  const [cameForBusiness] = useState(() => isBusinessPath(window.location.pathname) || readSession(BUSINESS_KEY) === '1')
  const onBusinessPage = isBusinessPath(pathname)
  useEffect(() => {
    if (onBusinessPage || cameForBusiness) writeSession(BUSINESS_KEY, '1')
  }, [onBusinessPage, cameForBusiness])

  const webOnly = WEB_ONLY_PATHS.some((p) => pathname.startsWith(p))
  const show = !!platform && !dismissed && !webOnly
  const app = onBusinessPage || cameForBusiness ? APPS.business : APPS.shopper
  const storeUrl = platform === 'ios' ? app.ios : app.play
  const storeName = platform === 'ios' ? 'App Store' : 'Google Play'

  useEffect(() => {
    if (!show) return
    document.documentElement.style.overflow = 'hidden'
    // Go to the store once per visit. If they come back with the back button,
    // leave the sheet up with its button rather than bouncing them out again.
    let timer: number | undefined
    if (readSession(REDIRECTED_KEY) !== '1') {
      timer = window.setTimeout(() => {
        writeSession(REDIRECTED_KEY, '1')
        window.location.href = storeUrl
      }, REDIRECT_DELAY_MS)
    }
    return () => {
      window.clearTimeout(timer)
      document.documentElement.style.overflow = ''
    }
  }, [show, storeUrl])

  if (!show) return null

  const stayOnWeb = () => {
    writeSession(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-app-gate-title"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-center text-foreground"
    >
      <div className="flex w-full max-w-sm flex-col items-center motion-safe:animate-[mobile-gate-in_420ms_cubic-bezier(0.23,1,0.32,1)_both]">
        <div className="grid size-20 place-items-center rounded-[1.4rem] bg-card shadow-[var(--shadow-sticker-lifted)] ring-1 ring-foreground/10">
          <LoopMark className="size-12 object-contain" />
        </div>
        <h1 id="mobile-app-gate-title" className="mt-7 font-display text-3xl font-bold tracking-tight">
          Continue in our app!
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          {app.name} works best on your phone as an app. Taking you to {storeName}…
        </p>
        <a
          href={storeUrl}
          onClick={() => writeSession(REDIRECTED_KEY, '1')}
          className="mt-8 flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground transition-[transform,background-color] duration-200 ease-out hover:bg-primary-hover active:scale-[0.97]"
        >
          Open {storeName}
        </a>
        <button
          type="button"
          onClick={stayOnWeb}
          className="mt-4 min-h-11 px-4 text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          Continue on the website
        </button>
      </div>
      <style>{'@keyframes mobile-gate-in{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}'}</style>
    </div>
  )
}
