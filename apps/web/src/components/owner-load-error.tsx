import { useOwner } from '@/lib/owner-context'

/** Shown instead of onboarding redirects when the user's shops failed to load. */
export function OwnerLoadError() {
  const { refetch } = useOwner()
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4">
      <div role="alert" className="max-w-md rounded-3xl bg-card p-8 text-center ring-1 ring-foreground/8">
        <h1 className="font-display text-2xl font-semibold">We couldn’t load your shop</h1>
        <p className="mt-2 text-sm text-muted-foreground">Check your connection and try again.</p>
        <button data-press-feedback onClick={() => void refetch()} className="mt-5 min-h-11 rounded-full bg-primary px-5 font-semibold text-primary-foreground">Try again</button>
      </div>
    </div>
  )
}
