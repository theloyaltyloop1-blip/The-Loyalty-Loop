import * as React from 'react'
import { toast } from 'sonner'
import { handleTask } from '@/lib/async'
import { disconnectSumUp, fetchPosConnection, startSumUpConnect, type PosConnectionStatus } from '@/lib/pos'

const RETURN_MESSAGES: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: 'SumUp connected. New card sales will now be added to customers you scan.' },
  denied: { ok: false, text: 'SumUp access was not approved, so nothing was connected.' },
  expired: { ok: false, text: 'That connection link expired. Please start again.' },
  error: { ok: false, text: 'Could not finish connecting SumUp. Please try again.' },
}

/** Owner setting: link the shop's SumUp till so purchase amounts arrive on their own. */
export function SumUpCard({ businessId }: { businessId: string }) {
  const [status, setStatus] = React.useState<PosConnectionStatus | null>(null)
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    try {
      setStatus(await fetchPosConnection(businessId))
      setLoadFailed(false)
    } catch {
      setLoadFailed(true)
    }
  }, [businessId])

  React.useEffect(() => { void load() }, [load])

  // The callback sends the owner back here with ?sumup=<result>.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const result = params.get('sumup')
    if (!result) return
    const message = RETURN_MESSAGES[result]
    if (message) (message.ok ? toast.success : toast.error)(message.text)
    params.delete('sumup')
    const rest = params.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`)
  }, [])

  async function connect() {
    setBusy(true)
    try {
      window.location.assign(await startSumUpConnect(businessId))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not reach SumUp. Please try again.')
      setBusy(false)
    }
  }

  async function disconnect() {
    if (!window.confirm('Disconnect SumUp? Sales will stop being added automatically. You can enter amounts by hand instead.')) return
    setBusy(true)
    try {
      await disconnectSumUp(businessId)
      await load()
      toast.success('SumUp disconnected.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not disconnect. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const needsReconnect = status?.connected && status.status === 'needs_reconnect'

  return (
    <section className="rounded-3xl bg-card p-6 sm:p-7">
      <h3 className="font-display text-lg font-semibold tracking-tight text-foreground mb-1">Connect your SumUp till</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Scan the customer as usual, take payment on your SumUp reader as usual, and the amount is added
        for them automatically. Nothing is typed twice. We only read the amount and time of each sale.
      </p>

      {loadFailed && <p role="alert" className="text-sm text-destructive mb-3">Could not check your SumUp connection. <button className="font-semibold underline" onClick={handleTask(load)}>Try again</button></p>}

      {status?.connected && !needsReconnect && (
        <div className="mb-4 rounded-2xl bg-sage px-4 py-3 text-sage-ink text-sm">
          <p className="font-semibold">SumUp is connected</p>
          <p>{status.lastSyncedAt ? `Last checked ${new Date(status.lastSyncedAt).toLocaleString()}` : 'Waiting for the first check…'}</p>
          {status.lastError && <p className="mt-1">{status.lastError}. We'll retry automatically.</p>}
        </div>
      )}
      {needsReconnect && (
        <div className="mb-4 rounded-2xl bg-peach px-4 py-3 text-peach-ink text-sm">
          <p className="font-semibold">SumUp needs to be reconnected</p>
          <p>Access was removed or expired. Until you reconnect, amounts must be entered by hand.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(!status?.connected || needsReconnect) && (
          <button data-press-feedback onClick={handleTask(connect)} disabled={busy || !status}
            className="h-11 rounded-full bg-primary px-5 font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50">
            {busy ? 'Opening SumUp…' : needsReconnect ? 'Reconnect SumUp' : 'Connect SumUp'}
          </button>
        )}
        {status?.connected && (
          <button data-press-feedback onClick={handleTask(disconnect)} disabled={busy}
            className="h-11 rounded-full bg-secondary px-5 font-semibold text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50">
            Disconnect
          </button>
        )}
      </div>
    </section>
  )
}
