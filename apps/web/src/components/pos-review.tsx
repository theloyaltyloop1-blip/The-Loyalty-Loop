import * as React from 'react'
import { toast } from 'sonner'
import { handleTask } from '@/lib/async'
import { formatPounds } from '@/lib/businesses'
import { fetchPosRecent, fetchPosReview, resolvePosSale, undoPosSale, type PosRecentSale, type PosReviewSale } from '@/lib/pos'

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/** Sales the till reported that we could not safely attach to one customer. */
export function PosReview({ businessId, isOwner, onResolved }: { businessId: string; isOwner: boolean; onResolved?: () => void }) {
  const [sales, setSales] = React.useState<PosReviewSale[]>([])
  const [recent, setRecent] = React.useState<PosRecentSale[]>([])
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    try {
      const [review, matched] = await Promise.all([fetchPosReview(businessId), fetchPosRecent(businessId)])
      setSales(review)
      setRecent(matched)
    } catch {
      // A failed refresh keeps what is already on screen; the next poll retries.
    }
  }, [businessId])

  React.useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 30000)
    return () => window.clearInterval(timer)
  }, [load])

  async function resolve(saleId: string, scanId: string | null) {
    setBusyId(saleId)
    try {
      await resolvePosSale(saleId, scanId)
      toast.success(scanId ? 'Sale added to the customer.' : 'Sale dismissed.')
      onResolved?.()
    } catch {
      toast.error('Could not save that. Please try again.')
    } finally {
      setBusyId(null)
      await load()
    }
  }

  async function undo(sale: PosRecentSale) {
    if (!window.confirm(`Take ${formatPounds(sale.amountPence)} back from ${sale.name}? Use this if the sale went to the wrong customer.`)) return
    setBusyId(sale.saleId)
    try {
      await undoPosSale(sale.saleId)
      toast.success('Taken back. You can add the amount to the right customer by hand.')
    } catch {
      toast.error('Could not undo that. Please try again.')
    } finally {
      setBusyId(null)
      await load()
    }
  }

  if (sales.length === 0 && !(isOwner && recent.length > 0)) return null

  return (
    <>
    {sales.length > 0 && <section className="rounded-2xl bg-peach p-4 text-peach-ink" aria-label="Sales that need a customer">
      <p className="font-semibold text-foreground">Which sale was this?</p>
      <p className="mb-3 text-sm text-muted-foreground">
        These card sales happened while more than one customer was scanned, so we need you to choose.
      </p>
      <ul className="flex flex-col gap-3">
        {sales.map((sale) => (
          <li key={sale.saleId} className="rounded-xl bg-card p-3">
            <p className="font-semibold text-foreground">{formatPounds(sale.amountPence)} <span className="font-normal text-muted-foreground">at {time(sale.occurredAt)}</span></p>
            <div className="mt-2 flex flex-wrap gap-2">
              {sale.candidates.map((c) => (
                <button key={c.scanId} data-press-feedback disabled={busyId === sale.saleId}
                  onClick={handleTask(() => resolve(sale.saleId, c.scanId))}
                  className="h-10 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50">
                  {c.name} <span className="font-normal opacity-80">· scanned {time(c.scannedAt)}</span>
                </button>
              ))}
              <button data-press-feedback disabled={busyId === sale.saleId}
                onClick={handleTask(() => resolve(sale.saleId, null))}
                className="h-10 rounded-full bg-secondary px-4 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50">
                Nobody I scanned
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>}
    {isOwner && recent.length > 0 && (
      <details className="rounded-2xl bg-secondary p-4">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">Recent till sales added to customers</summary>
        <ul className="mt-3 flex flex-col gap-2">
          {recent.map((sale) => (
            <li key={sale.saleId} className="flex items-center justify-between gap-3 text-sm">
              <span><span className="font-semibold text-foreground">{formatPounds(sale.amountPence)}</span> to {sale.name} <span className="text-muted-foreground">at {time(sale.occurredAt)}</span></span>
              <button data-press-feedback disabled={busyId === sale.saleId} onClick={handleTask(() => undo(sale))}
                className="h-9 shrink-0 rounded-full bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:bg-card/80 disabled:opacity-50">Undo</button>
            </li>
          ))}
        </ul>
      </details>
    )}
    </>
  )
}
