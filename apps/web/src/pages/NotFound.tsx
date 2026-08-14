import { Link } from 'react-router-dom'
import { LoopMark } from '@/components/loop-mark'
import { Button } from '@/components/ui/button'
import { usePageMeta } from '@/lib/use-page-meta'

export function NotFound() {
  usePageMeta({
    title: 'Page not found | The Loyalty Loop',
    description: 'The page you’re looking for doesn’t exist.',
    path: '/404',
  })
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 text-center bg-background">
      <LoopMark className="h-14 w-14" />
      <div>
        <h1 className="font-display text-3xl font-extrabold text-foreground">Page not found</h1>
        <p className="mt-2 text-foreground/60 max-w-sm">
          That page doesn’t exist or may have moved. Let’s get you back on track.
        </p>
      </div>
      <Link to="/">
        <Button>Back to home</Button>
      </Link>
    </div>
  )
}
