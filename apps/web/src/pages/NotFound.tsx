import { WhirlOrIcon } from '@/components/whirl-kit'
import { Link } from 'react-router-dom'
import { LoopMark } from '@/components/loop-mark'
import { Button } from '@/components/ui/button'
import { usePageMeta } from '@/lib/use-page-meta'
import { CityScene } from '@/components/city-scene'
import { useLivingMotion } from '@/lib/living-motion'
import { useRef } from 'react'
import '@/living.css'

export function NotFound() {
  usePageMeta({
    title: 'Page not found | The Loyalty Loop',
    description: 'The page you’re looking for doesn’t exist.',
    path: '/404',
    robots: 'noindex,nofollow,noarchive',
  })
  const page = useRef<HTMLDivElement>(null)
  useLivingMotion(page, true)
  return (
    <div className="lp lp-auth" ref={page}>
      <CityScene root={page} seed={5} skyline="low" mini />
      <main className="lp-auth-main grid min-h-dvh place-items-center px-4 py-10">
      <div className="lp-glass w-full min-w-0 max-w-lg rounded-3xl [overflow-wrap:anywhere] px-6 py-12 text-center text-foreground sm:px-12" style={{ background: 'rgba(255, 253, 248, .85)' }}>
        <WhirlOrIcon pose="oops" effect="oops" size={120} className="mx-auto" fallback={<span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-card"><LoopMark className="h-11 w-11" /></span>} />
        <h1 className="mt-6 font-display text-3xl font-bold tracking-tight sm:text-4xl">Page not found</h1>
        <p className="mx-auto mt-3 max-w-sm text-foreground/80">
          That page doesn’t exist or may have moved. Let’s get you back on track.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg"><Link to="/">Back to home</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/help">Visit the help centre</Link></Button>
        </div>
      </div>
      </main>
    </div>
  )
}
