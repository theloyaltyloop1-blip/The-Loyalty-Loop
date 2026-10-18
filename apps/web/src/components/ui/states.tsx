import * as React from 'react'
import { AlertTriangle } from 'lucide-react'

export type LoadStatus = 'loading' | 'error' | 'ready'

/** Runs `load` when `enabled`, tracking loading/error/ready so pages never render blank or fail silently. */
export function useLoad<T>(load: () => Promise<T>, enabled: boolean, deps: React.DependencyList) {
  const [data, setData] = React.useState<T | null>(null)
  const [status, setStatus] = React.useState<LoadStatus>('loading')
  const [nonce, setNonce] = React.useState(0)
  React.useEffect(() => {
    if (!enabled) return
    let live = true
    setStatus('loading')
    load().then((d) => { if (live) { setData(d); setStatus('ready') } }).catch(() => { if (live) setStatus('error') })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, nonce, ...deps])
  return { data, setData, status, retry: () => setNonce((n) => n + 1) }
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite" aria-label="Loading" className="rounded-2xl bg-[#FBF6EC] shadow-[0_1px_3px_rgba(0,0,0,.08)] divide-y divide-black/5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-5 flex gap-4 animate-pulse">
          <div className="h-10 w-10 rounded-xl bg-black/10" />
          <div className="flex-1 space-y-2"><div className="h-4 w-1/2 rounded bg-black/10" /><div className="h-3 w-1/3 rounded bg-black/5" /></div>
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  )
}

export function ErrorState({ message = 'We couldn’t load this right now.', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl bg-[#FBF6EC] p-10 text-center shadow-[0_1px_3px_rgba(0,0,0,.08)]">
      <AlertTriangle className="h-9 w-9 mx-auto text-[#C9622E] mb-3" />
      <h2 className="font-display text-xl font-bold text-[#1a1a1a]">Something went wrong</h2>
      <p className="mt-2 text-sm text-[#1a1a1a]/55">{message} Check your connection and try again.</p>
      {onRetry && <button onClick={onRetry} className="mt-5 min-h-11 rounded-full bg-[#E8703B] px-6 font-bold text-white">Try again</button>}
    </div>
  )
}
