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
            {Array.from({ length: cards }).map((_, index) => <div key={index} className="rounded-2xl bg-card p-5 ring-1 ring-foreground/8"><SkeletonBlock className="h-28 w-full" /><SkeletonBlock className="mt-5 h-5 w-2/3" /><SkeletonBlock className="mt-3 h-4 w-full" /><SkeletonBlock className="mt-2 h-4 w-4/5" /></div>)}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export function BarePageSkeleton() {
  return <div role="status" aria-live="polite" aria-label="Loading page" className="min-h-dvh bg-background p-6 md:p-10"><span className="sr-only">Loading page</span><div className="mx-auto max-w-6xl space-y-6"><SkeletonBlock className="h-4 w-28" /><SkeletonBlock className="h-10 w-64 max-w-full" /><div className="grid gap-5 sm:grid-cols-2"><SkeletonBlock className="h-64" /><SkeletonBlock className="h-64" /></div></div></div>
}

/** Same shell as AuthLayout, so the login/sign-up pages don't jump from a
 * generic skeleton into a different layout once their code arrives. */
export function AuthPageSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading page" className="min-h-dvh bg-background p-3 sm:p-4 md:grid md:grid-cols-[minmax(320px,0.9fr)_1.1fr] md:gap-4">
      <span className="sr-only">Loading page</span>
      <div aria-hidden="true" className="hidden rounded-[28px] bg-olive md:block" />
      <div aria-hidden="true" className="flex min-h-[calc(100dvh-1.5rem)] flex-col rounded-[28px] bg-card px-6 py-8 sm:px-10 md:min-h-0 md:px-14 md:py-12">
        <div className="h-8" />
        <div className="mx-auto my-auto w-full max-w-md space-y-4 py-10">
          <SkeletonBlock className="mb-8 h-9 w-48 md:h-10" />
          <SkeletonBlock className="h-12 w-full rounded-full" />
          <SkeletonBlock className="h-12 w-full rounded-full" />
          <SkeletonBlock className="h-12 w-full" />
          <SkeletonBlock className="h-12 w-full" />
        </div>
      </div>
    </div>
  )
}
