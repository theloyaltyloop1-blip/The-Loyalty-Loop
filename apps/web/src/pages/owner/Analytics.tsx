import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { Users, Stamp, Gift, Ticket, TrendingUp, TrendingDown, Minus, Sparkles, Send, MessageCircle, Search, ExternalLink } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { OwnerLayout } from '@/components/owner-layout'
import { BarePageSkeleton } from '@/components/page-skeleton'
import { useOwner } from '@/lib/owner-context'
import {
  fetchPeriodStats,
  fetchTotalsStats,
  fetchAnalyticsAiSummary,
  sendCoachMessage,
  fetchDeepBusinessReport,
  fetchLatestWebResearch,
  pctChange,
  type Period,
  type PeriodStats,
  type TotalsStats,
  type CoachMessage,
  type DeepBusinessReport,
} from '@/lib/analytics'

const PERIODS: Period[] = [7, 30, 90]

function useCountUp(value: number) {
  const [display, setDisplay] = React.useState(0)
  const previous = React.useRef(0)

  React.useEffect(() => {
    const from = previous.current
    previous.current = value
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value)
      return
    }
    const duration = 250
    const startedAt = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      setDisplay(Math.round(from + (value - from) * progress))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return display
}

function Delta({ current, prev }: { current: number; prev: number }) {
  const pct = pctChange(current, prev)
  if (pct === null) {
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-fun-green">
        <TrendingUp className="h-3.5 w-3.5" /> new
      </span>
    )
  }
  if (pct === 0) {
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-foreground/40">
        <Minus className="h-3.5 w-3.5" /> flat
      </span>
    )
  }
  const up = pct > 0
  return (
    <span className={'flex items-center gap-1 text-xs font-bold ' + (up ? 'text-fun-green' : 'text-red-500')}>
      {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {up ? '+' : ''}
      {pct}%
    </span>
  )
}

function StatTile({
  icon: Icon,
  label,
  value,
  prev,
  color,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  label: string
  value: number
  prev: number
  color: string
}) {
  const displayedValue = useCountUp(value)
  return (
    <div className="rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '22' }}>
          <Icon className="h-4.5 w-4.5" style={{ color }} />
        </span>
        <Delta current={value} prev={prev} />
      </div>
      <p className="text-3xl font-display font-extrabold text-foreground" aria-label={`${value} ${label}`}>{displayedValue}</p>
      <p className="text-sm text-foreground/50 mt-0.5">{label}</p>
    </div>
  )
}

function AiSummaryCard({ businessId, period, stats, totals }: { businessId: string; period: Period; stats: PeriodStats; totals: TotalsStats }) {
  const [summary, setSummary] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const generate = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const s = await fetchAnalyticsAiSummary(businessId, period, stats, totals)
      setSummary(s)
    } catch {
      setError('AI summary unavailable right now — the coach may still be getting set up.')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, period, stats, totals])

  React.useEffect(() => {
    generate()
  }, [generate])

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#FFF3E4] to-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6 border border-accent/20">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <p className="font-display font-bold text-foreground">What changed in the last {period} days</p>
      </div>
      {loading ? (
        <p className="text-sm text-foreground/40">Thinking…</p>
      ) : error ? (
        <p className="text-sm text-foreground/50">{error}</p>
      ) : (
        <p className="text-sm text-foreground/80 leading-relaxed">{summary}</p>
      )}
      <button data-press-feedback onClick={generate} disabled={loading} className="mt-3 text-xs font-bold text-primary-hover disabled:opacity-40">
        Regenerate
      </button>
    </div>
  )
}

function DeepBusinessReportCard({
  businessId,
  report,
  onReport,
}: {
  businessId: string
  report: DeepBusinessReport | null
  onReport: (r: DeepBusinessReport) => void
}) {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleResearch() {
    setLoading(true)
    setError(null)
    try {
      const r = await fetchDeepBusinessReport(businessId)
      onReport(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Web research is unavailable right now — it may still be getting set up.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          <p className="font-display font-bold text-foreground">Deep business report</p>
        </div>
        <button data-press-feedback
          onClick={handleResearch}
          disabled={loading}
          className="flex items-center gap-2 rounded-full bg-foreground text-white text-sm font-bold px-4 h-9 disabled:opacity-50"
        >
          {loading ? 'Researching…' : report ? 'Refresh research' : 'Research my shop online'}
        </button>
      </div>
      <p className="text-sm text-foreground/50 mb-4">
        Scans Google reviews and your shop's web presence, then writes up what customers are saying and where
        to improve.
      </p>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {report && (
        <>
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line mb-4">{report.report}</p>
          {report.sources.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {report.sources.map((s) => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs font-semibold text-primary-hover bg-white border border-black/10 rounded-full px-3 py-1.5 hover:border-primary/50"
                >
                  {s.title.length > 40 ? s.title.slice(0, 40) + '…' : s.title} <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function BusinessCoach({ businessId, stats }: { businessId: string; stats: unknown }) {
  const [messages, setMessages] = React.useState<CoachMessage[]>([])
  const [input, setInput] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    const next: CoachMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setSending(true)
    setError(null)
    try {
      const reply = await sendCoachMessage(businessId, next, stats)
      setMessages([...next, { role: 'assistant', content: reply }])
    } catch {
      setError('The coach is unavailable right now — it may still be getting set up.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="h-4 w-4 text-primary" />
        <p className="font-display font-bold text-foreground">Business coach</p>
      </div>

      <div ref={scrollRef} className="flex flex-col gap-3 max-h-80 overflow-y-auto mb-4 pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-foreground/40">
            Ask anything — "How do I get more repeat visits?", "Is my reward threshold too high?"...
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              'rounded-xl px-4 py-2.5 text-sm max-w-[90%] ' +
              (m.role === 'user'
                ? 'bg-primary text-white self-end'
                : 'bg-white text-foreground self-start border border-black/5')
            }
          >
            {m.content}
          </div>
        ))}
        {sending && <div className="rounded-xl px-4 py-2.5 text-sm bg-white text-foreground/40 self-start">Thinking…</div>}
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      <div className="flex items-center gap-2">
        <input
          className="h-11 flex-1 rounded-full border border-black/10 bg-white px-4 text-sm outline-none focus:border-primary"
          placeholder="Ask the coach…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button data-press-feedback
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="h-11 w-11 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-40 shrink-0"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export function OwnerAnalytics() {
  const { session, loading, rolesLoading, roles } = useAuth()
  const { business, businesses, staffBusinesses, loading: ownerLoading } = useOwner()
  const [view, setView] = React.useState<'simplified' | 'detailed'>('simplified')
  const [period, setPeriod] = React.useState<Period>(30)
  const [stats, setStats] = React.useState<PeriodStats | null>(null)
  const [totals, setTotals] = React.useState<TotalsStats | null>(null)
  const [statsLoading, setStatsLoading] = React.useState(true)
  const [webResearch, setWebResearch] = React.useState<DeepBusinessReport | null>(null)

  React.useEffect(() => {
    if (!business) return
    setStatsLoading(true)
    Promise.all([fetchPeriodStats(business.id, period), fetchTotalsStats(business.id)])
      .then(([p, t]) => {
        setStats(p)
        setTotals(t)
      })
      .finally(() => setStatsLoading(false))
  }, [business?.id, period])

  React.useEffect(() => {
    if (!business) return
    setWebResearch(null)
    fetchLatestWebResearch(business.id).then(setWebResearch)
  }, [business?.id])

  if (loading || rolesLoading || ownerLoading) return <BarePageSkeleton />
  if (!session) return <Navigate to="/login" replace />
  if (roles.includes('business_owner') && businesses.length === 0 && staffBusinesses.length === 0) {
    return <Navigate to="/owner/onboarding" replace />
  }

  return (
    <OwnerLayout>
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-foreground/40 mb-1">Analytics</p>
          <h1 className="text-3xl font-display font-extrabold text-foreground">Know your customers</h1>
        </div>
        {business && (
          <div className="flex items-center gap-1 bg-card rounded-full p-1 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            {PERIODS.map((p) => (
              <button data-press-feedback
                key={p}
                onClick={() => setPeriod(p)}
                className={
                  'px-4 h-9 rounded-full text-sm font-bold transition-colors duration-150 ease-out ' +
                  (period === p ? 'bg-primary text-white' : 'text-foreground/50 hover:text-foreground')
                }
              >
                {p}d
              </button>
            ))}
          </div>
        )}
      </div>

      {!business ? (
        <div className="rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-10 text-center">
          <p className="text-foreground/50">Set up a shop to see analytics.</p>
        </div>
      ) : statsLoading || !stats || !totals ? (
        <div className="rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-10 text-center">
          <p className="text-foreground/40">Loading stats…</p>
        </div>
      ) : (
        <>
          <div className="flex gap-1 overflow-x-auto border-b border-black/10 mb-6">
            {(['simplified', 'detailed'] as const).map((key) => (
              <button data-press-feedback
                key={key}
                onClick={() => setView(key)}
                className={
                  'px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px capitalize transition-colors duration-150 ease-out ' +
                  (view === key
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-foreground/40 hover:text-foreground/70')
                }
              >
                {key}
              </button>
            ))}
          </div>

          {view === 'simplified' ? (
            <div className="flex flex-col gap-6">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatTile icon={Users} label="New members" value={stats.new_members} prev={stats.new_members_prev} color="#3B82C4" />
                <StatTile icon={Stamp} label="Stamps given" value={stats.stamps_given} prev={stats.stamps_given_prev} color="#E8703B" />
                <StatTile icon={Gift} label="Rewards earned" value={stats.rewards_earned} prev={stats.rewards_earned_prev} color="#8E5FC2" />
                <StatTile icon={Ticket} label="Rewards redeemed" value={stats.rewards_redeemed} prev={stats.rewards_redeemed_prev} color="#3FA34D" />
              </div>
              <AiSummaryCard businessId={business.id} period={period} stats={stats} totals={totals} />
              <DeepBusinessReportCard businessId={business.id} report={webResearch} onReport={setWebResearch} />
              <BusinessCoach businessId={business.id} stats={{ period: stats, totals, web_research: webResearch?.report }} />
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatTile icon={Users} label="New members" value={stats.new_members} prev={stats.new_members_prev} color="#3B82C4" />
                <StatTile icon={Users} label="Active members" value={stats.active_members} prev={stats.active_members_prev} color="#1B3A4B" />
                <StatTile icon={Stamp} label="Stamps given" value={stats.stamps_given} prev={stats.stamps_given_prev} color="#E8703B" />
                <StatTile icon={Gift} label="Rewards earned" value={stats.rewards_earned} prev={stats.rewards_earned_prev} color="#8E5FC2" />
                <StatTile icon={Ticket} label="Rewards redeemed" value={stats.rewards_redeemed} prev={stats.rewards_redeemed_prev} color="#3FA34D" />
              </div>

              <div className="rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6">
                <p className="font-display font-bold text-foreground mb-4">All-time totals</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    ['Members', totals.total_members],
                    ['Stamps given', totals.total_stamps],
                    ['Rewards earned', totals.total_rewards_earned],
                    ['Rewards redeemed', totals.total_rewards_redeemed],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <p className="text-2xl font-display font-extrabold text-foreground">{value}</p>
                      <p className="text-xs text-foreground/50">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6">
                <p className="font-display font-bold text-foreground mb-4">This period vs. the last {period} days</p>
                <div className="flex flex-col divide-y divide-black/5">
                  {[
                    ['New members', stats.new_members, stats.new_members_prev],
                    ['Active members', stats.active_members, stats.active_members_prev],
                    ['Stamps given', stats.stamps_given, stats.stamps_given_prev],
                    ['Rewards earned', stats.rewards_earned, stats.rewards_earned_prev],
                    ['Rewards redeemed', stats.rewards_redeemed, stats.rewards_redeemed_prev],
                  ].map(([label, cur, prev]) => (
                    <div key={label as string} className="flex items-center justify-between py-3 text-sm">
                      <span className="text-foreground/70">{label}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-foreground/40">
                          {prev} → {cur}
                        </span>
                        <Delta current={cur as number} prev={prev as number} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <AiSummaryCard businessId={business.id} period={period} stats={stats} totals={totals} />
              <DeepBusinessReportCard businessId={business.id} report={webResearch} onReport={setWebResearch} />
              <BusinessCoach businessId={business.id} stats={{ period: stats, totals, web_research: webResearch?.report }} />
            </div>
          )}
        </>
      )}
    </OwnerLayout>
  )
}
