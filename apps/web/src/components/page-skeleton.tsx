import { DashboardLayout } from '@/components/dashboard-layout'

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`rounded-xl bg-foreground/[0.08] motion-safe:animate-pulse ${className}`} />
}

export function PageSkeleton({ variant = 'cards' }: { variant?: 'cards' | 'detail' | 'feed' | 'owner' }) {
  const cards = variant === 'feed' ? 1 : variant === 'detail' ? 2 : 4
  return (
    <DashboardLayout>
      <div role="status" aria-live="polite" aria-label="Loading page" className="space-y-6">
        <span className="sr-only">Loading page</span>
        <div className="space-y-3"><SkeletonBlock className="h-3 w-24" /><SkeletonBlock className="h-9 w-52" /><SkeletonBlock className="h-4 w-80 max-w-full" /></div>
        {variant === 'feed' ? <SkeletonBlock className="h-[60vh] w-full rounded-3xl" /> : (
          <div className={variant === 'detail' ? 'space-y-5' : 'grid gap-5 sm:grid-cols-2'}>
            {Array.from({ length: cards }).map((_, index) => <div key={index} className="rounded-2xl bg-card p-5 shadow-sm"><SkeletonBlock className="h-28 w-full" /><SkeletonBlock className="mt-5 h-5 w-2/3" /><SkeletonBlock className="mt-3 h-4 w-full" /><SkeletonBlock className="mt-2 h-4 w-4/5" /></div>)}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export function BarePageSkeleton() {
  return <div role="status" aria-live="polite" aria-label="Loading page" className="min-h-screen bg-background p-6 md:p-10"><span className="sr-only">Loading page</span><div className="mx-auto max-w-6xl space-y-6"><SkeletonBlock className="h-4 w-28" /><SkeletonBlock className="h-10 w-64 max-w-full" /><div className="grid gap-5 sm:grid-cols-2"><SkeletonBlock className="h-64" /><SkeletonBlock className="h-64" /></div></div></div>
}
