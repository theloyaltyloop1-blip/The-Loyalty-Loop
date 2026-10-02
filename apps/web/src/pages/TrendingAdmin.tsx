import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, Check, Plus, Smartphone, Monitor, Sparkles, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

type Shop = { id: string; name: string; category: string | null; brand_color: string; trending: boolean; trending_position: number | null }

const MAX_PICKS = 12
const PHONE_SHOWS = 4

export function TrendingAdmin() {
  const { session, loading, rolesLoading, roles } = useAuth()
  const [shops, setShops] = useState<Shop[]>([])
  const [picks, setPicks] = useState<string[]>([])
  const [saved, setSaved] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setBusy(true)
    setError('')
    const { data, error: e } = await supabase
      .from('businesses')
      .select('id,name,category,brand_color,trending,trending_position')
      .eq('is_active', true)
      .eq('approval_status', 'approved')
      .order('name')
    if (e) {
      setError('Could not load shops. Refresh to try again.')
    } else {
      const rows = (data ?? []) as Shop[]
      const current = rows
        .filter((shop) => shop.trending)
        .sort((a, b) => (a.trending_position ?? Infinity) - (b.trending_position ?? Infinity))
        .map((shop) => shop.id)
      setShops(rows)
      setPicks(current)
      setSaved(current)
    }
    setBusy(false)
  }, [])

  const userId = session?.user.id
  const isAdmin = roles.includes('admin')
  useEffect(() => {
    if (userId && isAdmin) void load()
  }, [userId, isAdmin, load])

  if (loading || rolesLoading) return <p className="p-8">Loading…</p>
  if (!session) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/dashboard" replace />

  const byId = new Map(shops.map((shop) => [shop.id, shop]))
  const chosen = picks.map((id) => byId.get(id)).filter((shop): shop is Shop => Boolean(shop))
  const unchanged = picks.length === saved.length && picks.every((id, i) => id === saved[i])

  function toggle(id: string) {
    setNotice('')
    if (picks.includes(id)) {
      setPicks(picks.filter((pick) => pick !== id))
      return
    }
    if (picks.length >= MAX_PICKS) {
      setError(`You can choose up to ${MAX_PICKS} trending shops.`)
      return
    }
    setError('')
    setPicks([...picks, id])
  }

  function move(index: number, by: -1 | 1) {
    setNotice('')
    setPicks((current) => {
      const next = [...current]
      const target = index + by
      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function save() {
    setBusy(true)
    setError('')
    setNotice('')
    const { error: e } = await supabase.rpc('admin_set_trending', { p_business_ids: picks })
    if (e) {
      setError(e.message.includes('approved, active') ? 'A chosen shop is no longer approved and active. Refresh and try again.' : 'Could not save. Please try again.')
      setBusy(false)
      return
    }
    await load()
    setNotice(picks.length ? 'Saved. Shoppers will see your Trending list next time they open the app.' : 'Cleared. The apps will show the first shops again.')
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl p-5 pb-28 sm:p-10">
      <Link to="/access" className="text-sm underline">← Access panel</Link>
      <h1 className="mt-6 flex items-center gap-2 font-display text-3xl font-bold"><Sparkles className="h-7 w-7 text-primary" /> Trending shops</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Choose which shops appear under “Trending nearby”, and in what order. If you choose none, shoppers see the first shops in the list, as before.
      </p>

      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-emerald-800">{notice}</p>}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section aria-labelledby="trending-list" className="rounded-3xl bg-gradient-to-br from-primary/15 via-amber-100/60 to-emerald-100/60 p-5 sm:p-6">
          <h2 id="trending-list" className="font-display text-xl font-bold">Your Trending list ({chosen.length}/{MAX_PICKS})</h2>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-foreground/70">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1"><Monitor className="h-4 w-4" /> Website shows all {chosen.length}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1"><Smartphone className="h-4 w-4" /> Phone app shows the first {Math.min(PHONE_SHOWS, chosen.length) || PHONE_SHOWS}</span>
          </div>
          {!chosen.length && <p className="mt-5 rounded-2xl bg-white/70 p-4 text-foreground/70">No shops chosen yet. Add shops from the list.</p>}
          <ol className="mt-5 space-y-3">
            {chosen.map((shop, index) => (
              <li key={shop.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl font-bold text-white" style={{ background: shop.brand_color }}>{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{shop.name}</p>
                  <p className="text-xs text-foreground/60">{shop.category ?? 'Shop'}{index < PHONE_SHOWS ? ' · on phone and website' : ' · website only'}</p>
                </div>
                <button aria-label={`Move ${shop.name} up`} disabled={busy || index === 0} onClick={() => move(index, -1)} className="rounded-lg p-2 hover:bg-black/5 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                <button aria-label={`Move ${shop.name} down`} disabled={busy || index === chosen.length - 1} onClick={() => move(index, 1)} className="rounded-lg p-2 hover:bg-black/5 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                <button aria-label={`Remove ${shop.name}`} disabled={busy} onClick={() => toggle(shop.id)} className="rounded-lg p-2 text-red-700 hover:bg-red-50 disabled:opacity-30"><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="all-shops">
          <h2 id="all-shops" className="font-display text-xl font-bold">All approved shops</h2>
          {!shops.length && <p className="mt-3 text-muted-foreground">{busy ? 'Loading shops…' : 'No approved shops yet.'}</p>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {shops.map((shop) => {
              const position = picks.indexOf(shop.id)
              const on = position >= 0
              return (
                <button
                  key={shop.id}
                  aria-pressed={on}
                  disabled={busy}
                  onClick={() => toggle(shop.id)}
                  className={'overflow-hidden rounded-2xl border bg-card text-left transition-shadow hover:shadow-md disabled:opacity-60 ' + (on ? 'ring-2 ring-primary' : '')}
                >
                  <div className="h-14" style={{ background: `linear-gradient(135deg, ${shop.brand_color}, ${shop.brand_color}99)` }} />
                  <div className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{shop.name}</p>
                      <p className="text-xs text-foreground/60">{shop.category ?? 'Shop'}</p>
                    </div>
                    <span className={'inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ' + (on ? 'bg-primary text-primary-foreground' : 'bg-black/5 text-foreground/70')}>
                      {on ? <><Check className="h-3.5 w-3.5" /> #{position + 1}</> : <><Plus className="h-3.5 w-3.5" /> Add</>}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-3">
          {!unchanged && <span className="text-sm text-foreground/70">Unsaved changes</span>}
          <button disabled={busy || unchanged} onClick={() => setPicks(saved)} className="rounded-xl px-4 py-3 font-semibold underline disabled:opacity-40">Undo changes</button>
          <button disabled={busy || unchanged} onClick={() => void save()} className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground disabled:opacity-50">{busy ? 'Saving…' : 'Save Trending list'}</button>
        </div>
      </div>
    </main>
  )
}
