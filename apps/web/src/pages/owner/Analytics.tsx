import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { Users, ShoppingBag, Gift, Ticket, TrendingUp, TrendingDown, Minus, Sparkles, Send, MessageCircle, Search, ExternalLink } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { OwnerLayout } from '@/components/owner-layout'
import { BarePageSkeleton, SkeletonBlock } from '@/components/page-skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useOwner } from '@/lib/owner-context'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
  const compareLabel = 'Compared to the equal-length period right before this one'
  if (pct === null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="flex items-center gap-1 text-xs font-bold text-fun-green outline-none">
            <TrendingUp className="h-3.5 w-3.5" /> new
          </span>
        </TooltipTrigger>
        <TooltipContent>{compareLabel}</TooltipContent>
      </Tooltip>
    )
  }
  if (pct === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="flex items-center gap-1 text-xs font-bold text-muted-foreground outline-none">
            <Minus className="h-3.5 w-3.5" /> flat
          </span>
        </TooltipTrigger>
        <TooltipContent>{compareLabel}</TooltipContent>
      </Tooltip>
    )
  }
  const up = pct > 0
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className={'flex items-center gap-1 text-xs font-bold outline-none ' + (up ? 'text-fun-green' : 'text-destructive')}>
          {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {up ? '+' : ''}
          {pct}%
        </span>
      </TooltipTrigger>
      <TooltipContent>{compareLabel}</TooltipContent>
    </Tooltip>
  )
}

const TILE_TONES = {
  sage: 'bg-sage text-sage-ink',
  peach: 'bg-peach text-peach-ink',
  amber: 'bg-amber text-amber-ink',
  card: 'bg-card text-foreground ring-1 ring-foreground/8',
} as const

function StatTile({
  icon: Icon,
  label,
  hint,
  value,
  prev,
  tone,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  label: string
  hint?: string
  value: number
  prev: number
  tone: keyof typeof TILE_TONES
}) {
  const displayedValue = useCountUp(value)
  return (
    <div className={'rounded-2xl p-5 ' + TILE_TONES[tone]}>
      <div className="flex items-center justify-between mb-4">
        <span className="h-10 w-10 rounded-full bg-card flex items-center justify-center text-foreground">
          <Icon className="h-5 w-5" />
        </span>
        <span className="rounded-full bg-card px-2 py-1"><Delta current={value} prev={prev} /></span>
      </div>
      <p className="text-4xl font-display font-bold tracking-tight tabular-nums" aria-label={`${value} ${label}`}>{displayedValue}</p>
      {hint ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <p tabIndex={0} className="text-sm opacity-80 mt-1 w-fit underline decoration-dotted underline-offset-2 outline-none">{label}</p>
          </TooltipTrigger>
          <TooltipContent side="bottom">{hint}</TooltipContent>
        </Tooltip>
      ) : (
        <p className="text-sm opacity-80 mt-1">{label}</p>
      )}
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
      setError('AI summary unavailable right now. The coach may still be getting set up.')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, period, stats, totals])

  React.useEffect(() => {
    generate()
  }, [generate])

  return (
    <div className="rounded-2xl bg-peach p-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <p className="font-display text-lg font-semibold tracking-tight text-peach-ink">What changed in the last {period} days</p>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Thinking…</p>
      ) : error ? (
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : (
        <p className="max-w-[70ch] text-peach-ink/90 leading-relaxed">{summary}</p>
      )}
      <button data-press-feedback onClick={generate} disabled={loading} className="mt-4 rounded-full bg-card px-3.5 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-card/80 disabled:opacity-40">
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
      setError(e instanceof Error ? e.message : 'Web research is unavailable right now. It may still be getting set up.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl bg-card ring-1 ring-foreground/8 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          <p className="font-display text-lg font-semibold tracking-tight text-foreground">Deep business report</p>
        </div>
        <button data-press-feedback
          onClick={handleResearch}
          disabled={loading}
          className="flex items-center gap-2 rounded-full bg-foreground text-background text-sm font-semibold px-4 h-10 transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Researching…' : report ? 'Refresh research' : 'Research my shop online'}
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Scans Google reviews and your shop's web presence, then writes up what customers are saying and where
        to improve.
      </p>

      {error && <p className="text-sm text-destructive mb-3">{error}</p>}

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
                  className="flex items-center gap-1 text-xs font-semibold text-foreground bg-secondary rounded-full px-3 py-1.5 transition-colors hover:bg-sage"
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
      setError('The coach is unavailable right now. It may still be getting set up.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-2xl bg-card ring-1 ring-foreground/8 p-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="h-4 w-4 text-primary" />
        <p className="font-display text-lg font-semibold tracking-tight text-foreground">Business coach</p>
      </div>

      <div ref={scrollRef} className="flex flex-col gap-3 max-h-80 overflow-y-auto mb-4 pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Ask anything, like "How do I get more repeat visits?", "Is my reward threshold too high?"...
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              'rounded-2xl px-4 py-2.5 text-sm max-w-[90%] ' +
              (m.role === 'user'
                ? 'bg-primary text-primary-foreground self-end'
                : 'bg-secondary text-foreground self-start')
            }
          >
            {m.content}
          </div>
        ))}
        {sending && <div className="rounded-2xl px-4 py-2.5 text-sm bg-secondary text-muted-foreground self-start">Thinking…</div>}
      </div>

      {error && <p className="text-xs text-destructive mb-2">{error}</p>}

      <div className="flex items-center gap-2">
        <input
          aria-label="Ask the coach"
          className="h-11 flex-1 rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-primary/20"
          placeholder="Ask the coach…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button data-press-feedback
          onClick={handleSend}
          disabled={sending || !input.trim()}
          aria-label="Send"
          className="h-11 w-11 rounded-full bg-primary hover:bg-primary-hover transition-colors text-primary-foreground flex items-center justify-center disabled:opacity-40 shrink-0"
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
        <h1 className="text-3xl font-display font-bold tracking-tight text-foreground sm:text-4xl">Know your customers</h1>
        {business && (
          <div className="flex items-center gap-1 bg-card rounded-full p-1 ring-1 ring-foreground/8">
            {PERIODS.map((p) => (
              <button data-press-feedback
                key={p}
                onClick={() => setPeriod(p)}
                className={
                  'px-4 h-9 rounded-full text-sm font-semibold tabular-nums transition-colors duration-200 ease-out ' +
                  (period === p ? 'bg-peach text-peach-ink' : 'text-muted-foreground hover:text-foreground')
                }
              >
                {p}d
              </button>
            ))}
          </div>
        )}
      </div>

      {!business ? (
        <div className="rounded-3xl bg-sage px-6 py-12 text-center text-sage-ink">
          <p>Set up a shop to see analytics.</p>
        </div>
      ) : statsLoading || !stats || !totals ? (
        <div role="status" aria-label="Loading stats" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonBlock className="h-36 rounded-2xl" /><SkeletonBlock className="h-36 rounded-2xl" /><SkeletonBlock className="h-36 rounded-2xl" /><SkeletonBlock className="h-36 rounded-2xl" />
        </div>
      ) : (
        <Tabs value={view} onValueChange={(v) => setView(v as 'simplified' | 'detailed')}>
          <TabsList variant="line" className="mb-6 border-b border-border">
            <TabsTrigger value="simplified">Simplified</TabsTrigger>
            <TabsTrigger value="detailed">Detailed</TabsTrigger>
          </TabsList>

          <TabsContent value="simplified">
            <div className="flex flex-col gap-6">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatTile icon={Users} label="New members" value={stats.new_members} prev={stats.new_members_prev} tone="sage" />
                <StatTile icon={ShoppingBag} label="Purchases recorded" value={stats.stamps_given} prev={stats.stamps_given_prev} tone="peach" />
                <StatTile icon={Gift} label="Rewards earned" value={stats.rewards_earned} prev={stats.rewards_earned_prev} tone="amber" />
                <StatTile icon={Ticket} label="Rewards redeemed" value={stats.rewards_redeemed} prev={stats.rewards_redeemed_prev} tone="card" />
              </div>
              <AiSummaryCard businessId={business.id} period={period} stats={stats} totals={totals} />
              <DeepBusinessReportCard businessId={business.id} report={webResearch} onReport={setWebResearch} />
              <BusinessCoach businessId={business.id} stats={{ period: stats, totals, web_research: webResearch?.report }} />
            </div>
          </TabsContent>

          <TabsContent value="detailed">
            <div className="flex flex-col gap-6">
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatTile icon={Users} label="New members" value={stats.new_members} prev={stats.new_members_prev} tone="sage" />
                <StatTile icon={Users} label="Active members" hint="Members who made a purchase in this period" value={stats.active_members} prev={stats.active_members_prev} tone="card" />
                <StatTile icon={ShoppingBag} label="Purchases recorded" value={stats.stamps_given} prev={stats.stamps_given_prev} tone="peach" />
                <StatTile icon={Gift} label="Rewards earned" value={stats.rewards_earned} prev={stats.rewards_earned_prev} tone="amber" />
                <StatTile icon={Ticket} label="Rewards redeemed" value={stats.rewards_redeemed} prev={stats.rewards_redeemed_prev} tone="card" />
              </div>

              <div className="rounded-2xl bg-card ring-1 ring-foreground/8 p-6">
                <p className="font-display text-lg font-semibold tracking-tight text-foreground mb-4">All-time totals</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    ['Members', totals.total_members],
                    ['Purchases recorded', totals.total_stamps],
                    ['Rewards earned', totals.total_rewards_earned],
                    ['Rewards redeemed', totals.total_rewards_redeemed],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <p className="text-3xl font-display font-bold tracking-tight tabular-nums text-foreground">{value}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-card ring-1 ring-foreground/8 p-6">
                <p className="font-display text-lg font-semibold tracking-tight text-foreground mb-4">This period vs. the last {period} days</p>
                <div className="flex flex-col divide-y divide-border">
                  {[
                    ['New members', stats.new_members, stats.new_members_prev],
                    ['Active members', stats.active_members, stats.active_members_prev],
                    ['Purchases recorded', stats.stamps_given, stats.stamps_given_prev],
                    ['Rewards earned', stats.rewards_earned, stats.rewards_earned_prev],
                    ['Rewards redeemed', stats.rewards_redeemed, stats.rewards_redeemed_prev],
                  ].map(([label, cur, prev]) => (
                    <div key={label as string} className="flex items-center justify-between py-3 text-sm">
                      <span className="text-foreground/70">{label}</span>
                      <div className="flex items-center gap-4">
                        <span className="tabular-nums text-muted-foreground">
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
          </TabsContent>
        </Tabs>
      )}
    </OwnerLayout>
  )
}
