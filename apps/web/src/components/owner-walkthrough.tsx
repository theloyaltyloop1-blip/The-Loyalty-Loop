import * as React from 'react'
import { Link } from 'react-router-dom'
import { Store, ScanLine, Users } from 'lucide-react'

const CARDS = [
  { icon: ScanLine, title: 'Scan', body: 'When a customer pays, open Scan, scan their code and tap once. That is the whole job.' },
  { icon: Users, title: 'Customers', body: 'See who keeps coming back and who has gone quiet, then send them a message in one go.' },
  { icon: Store, title: 'Shop', body: 'Your profile, rewards, reviews and help live here. Most owners rarely need more than this.' },
]

const keyFor = (businessId: string) => `walkthrough_seen_${businessId}`

function read(businessId: string): boolean {
  try { return localStorage.getItem(keyFor(businessId)) === 'true' } catch { return false }
}

/** Short first-run walkthrough, shown once per shop. The full guide is still
 * reachable from Shop > More. */
export function OwnerWalkthrough({ businessId }: { businessId: string }) {
  const [open, setOpen] = React.useState(() => !read(businessId))
  const [index, setIndex] = React.useState(0)

  React.useEffect(() => { setOpen(!read(businessId)); setIndex(0) }, [businessId])

  function close() {
    setOpen(false)
    try { localStorage.setItem(keyFor(businessId), 'true') } catch { /* private mode */ }
  }

  if (!open) return null
  const { icon: Icon, title, body } = CARDS[index]
  const last = index === CARDS.length - 1
  return (
    <div role="dialog" aria-modal="true" aria-label="Quick tour" className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-xl ring-1 ring-foreground/8">
        <p className="text-xs font-bold tracking-widest text-muted-foreground">{index + 1} OF {CARDS.length}</p>
        <div className="mt-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-peach text-peach-ink"><Icon className="h-5 w-5" aria-hidden="true" /></div>
        <h2 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground">{title}</h2>
        <p className="mt-2 text-muted-foreground">{body}</p>
        <button data-press-feedback onClick={() => (last ? close() : setIndex(index + 1))} className="mt-6 h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary-hover">
          {last ? 'Got it' : 'Next'}
        </button>
        <div className="mt-3 flex items-center justify-between text-sm font-semibold">
          {last ? <Link to="/owner/tutorial" onClick={close} className="text-muted-foreground underline">Full guide</Link> : <button onClick={close} className="text-muted-foreground">Skip</button>}
        </div>
      </div>
    </div>
  )
}
