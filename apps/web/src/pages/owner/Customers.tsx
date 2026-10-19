import { handleTask } from '@/lib/async'
import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { Send } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useOwner } from '@/lib/owner-context'
import { OwnerLayout } from '@/components/owner-layout'
import { BarePageSkeleton } from '@/components/page-skeleton'
import { supabase } from '@/lib/supabase'
import { rewardWords } from '@/lib/shop-types'

type Member = {
  user_id: string
  first_name: string | null
  last_name: string | null
  stamp_count: number
  points_balance: number
  visit_count: number
  last_activity_at: string | null
  joined_at: string
}

type Audience = 'all' | 'inactive_30' | 'regulars'

const DAY = 86400000
const inputClass = 'w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary'

const nameOf = (m: Member) => [m.first_name, m.last_name].filter(Boolean).join(' ') || 'Customer'

function daysAgo(iso: string | null): string {
  if (!iso) return 'never'
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / DAY)
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`
}

export function OwnerCustomers() {
  const { session, loading: authLoading } = useAuth()
  const { business, loading: ownerLoading } = useOwner()
  const [members, setMembers] = React.useState<Member[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [audience, setAudience] = React.useState<Audience>('all')
  const [title, setTitle] = React.useState('')
  const [body, setBody] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  const composer = React.useRef<HTMLFormElement>(null)

  React.useEffect(() => {
    if (!business) return
    supabase
      .rpc('get_business_members', { _business_id: business.id })
      .then(({ data, error: e }) => {
        if (e) setError('Could not load your customers.')
        else setMembers((data ?? []) as Member[])
      })
  }, [business])

  if (authLoading || ownerLoading) return <BarePageSkeleton />
  if (!session) return <Navigate to="/login" replace />
  if (!business) return <Navigate to="/owner/onboarding" replace />

  const words = rewardWords(business.loyalty_type)
  const progress = (m: Member) => (business.loyalty_type === 'points' ? m.points_balance : business.loyalty_type === 'tiered' ? m.visit_count : m.stamp_count)
  const cutoff = Date.now() - 30 * DAY
  const lastSeen = (m: Member) => (m.last_activity_at ? new Date(m.last_activity_at).getTime() : 0)
  const list = members ?? []
  const loyal = [...list].filter((m) => lastSeen(m) >= cutoff).sort((a, b) => b.visit_count - a.visit_count).slice(0, 5)
  const slipping = list.filter((m) => lastSeen(m) < cutoff).sort((a, b) => lastSeen(b) - lastSeen(a))

  function messageSlipping() {
    setAudience('inactive_30')
    setSent(false)
    composer.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim() || !business) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase
      .from('business_promotions')
      .insert({ business_id: business.id, title: title.trim(), body: body.trim(), audience })
    setBusy(false)
    if (err) {
      setError('Could not send your message. Try again.')
      return
    }
    setTitle('')
    setBody('')
    setSent(true)
  }

  return (
    <OwnerLayout>
      <h1 className="text-3xl font-display font-bold tracking-tight text-foreground sm:text-4xl">Your customers</h1>
      <p className="text-muted-foreground mt-2 mb-7">Who comes back, who has gone quiet, and a quick way to say hello.</p>

      {error && <p role="alert" className="mb-4 text-sm font-semibold text-destructive">{error}</p>}
      {members === null && !error ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { label: 'Customers', value: list.length },
              { label: 'Back this month', value: list.length - slipping.length },
              { label: 'Gone quiet', value: slipping.length },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-card p-4 ring-1 ring-foreground/8">
                <p className="font-display text-3xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          <section className="mb-8">
            <h2 className="font-display text-xl font-semibold tracking-tight mb-3">Your most loyal</h2>
            {loyal.length === 0 ? (
              <p className="text-muted-foreground">Nobody yet. Scan a customer to get started.</p>
            ) : (
              <ul className="grid gap-2">
                {loyal.map((m) => (
                  <li key={m.user_id} className="flex items-center justify-between rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/8">
                    <span className="font-semibold text-foreground">{nameOf(m)}</span>
                    <span className="text-sm text-muted-foreground">
                      {m.visit_count} visits · {progress(m)} {words.units}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-xl font-semibold tracking-tight">Haven't been back in a while</h2>
              {slipping.length > 0 && (
                <button data-press-feedback onClick={messageSlipping} className="text-sm font-semibold text-primary">
                  Message them
                </button>
              )}
            </div>
            {slipping.length === 0 ? (
              <p className="text-muted-foreground">Everyone has visited in the last 30 days.</p>
            ) : (
              <ul className="grid gap-2">
                {slipping.slice(0, 8).map((m) => (
                  <li key={m.user_id} className="flex items-center justify-between rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/8">
                    <span className="font-semibold text-foreground">{nameOf(m)}</span>
                    <span className="text-sm text-muted-foreground">last seen {daysAgo(m.last_activity_at)}</span>
                  </li>
                ))}
                {slipping.length > 8 && <li className="text-sm text-muted-foreground px-1">and {slipping.length - 8} more</li>}
              </ul>
            )}
          </section>
        </>
      )}

      <form ref={composer} onSubmit={handleTask(send)} className="rounded-2xl bg-card p-6 ring-1 ring-foreground/8">
        <h2 className="font-display text-xl font-semibold tracking-tight mb-4">Send a message</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {([
            ['all', 'Everyone'],
            ['inactive_30', 'Gone quiet'],
            ['regulars', 'Regulars'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              data-press-feedback
              onClick={() => { setAudience(value); setSent(false) }}
              className={'rounded-full px-4 py-2 text-sm font-semibold ' + (audience === value ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground')}
            >
              {label}
            </button>
          ))}
        </div>
        <input className={inputClass + ' mb-3'} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="We miss you" />
        <textarea className={inputClass + ' min-h-24'} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder="Come in this week and we'll have something waiting for you." />
        {sent && <p className="mt-3 text-sm font-semibold text-olive">Message sent.</p>}
        <button data-press-feedback disabled={busy || !title.trim() || !body.trim()} className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary hover:bg-primary-hover transition-colors text-primary-foreground px-5 py-3 font-semibold disabled:opacity-60">
          <Send className="h-4 w-4" /> {busy ? 'Sending…' : 'Send message'}
        </button>
      </form>
    </OwnerLayout>
  )
}
