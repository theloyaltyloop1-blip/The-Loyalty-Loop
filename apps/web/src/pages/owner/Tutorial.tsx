import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { PROGRAMMES, programmeIdFor } from '@loyalty-loop/loyalty'
import { OwnerLayout } from '@/components/owner-layout'
import { Explainer } from '@/components/explainers'
import { restartOwnerTour } from '@/components/owner-walkthrough'
import { useOwner } from '@/lib/owner-context'

/** "How it works": three short animations instead of a wall of text. The route
 * and component name are unchanged so existing links keep working. */
export function OwnerTutorial() {
  const { business } = useOwner()
  const programme = business ? programmeIdFor(business) : 'stamps'
  const items = [
    { kind: 'join' as const, title: '1. A customer joins' },
    { kind: 'scan' as const, title: '2. You scan at the till' },
    { kind: programme, title: `3. ${PROGRAMMES[programme].name}` },
  ]
  return (
    <OwnerLayout>
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">How it works</h1>
      <p className="mt-2 text-muted-foreground">Three steps. That is the whole job.</p>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-3">
        {items.map(({ kind, title }) => (
          <section key={kind} className="min-w-0 rounded-3xl bg-card p-4 ring-1 ring-foreground/8">
            <h2 className="mb-3 font-display text-lg font-semibold tracking-tight text-foreground">{title}</h2>
            <Explainer kind={kind} />
          </section>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        {business && (
          <button
            type="button"
            data-press-feedback
            onClick={() => restartOwnerTour(business.id)}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />Take the tour
          </button>
        )}
        <Link to="/owner/tools" className="inline-flex h-12 items-center gap-2 rounded-full px-5 font-semibold text-foreground ring-1 ring-foreground/15 hover:bg-foreground/5">
          Open your QR poster<ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </OwnerLayout>
  )
}
