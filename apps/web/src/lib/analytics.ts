import { supabase } from './supabase'

export type Period = 7 | 30 | 90

export interface PeriodStats {
  period_days: Period
  new_members: number
  new_members_prev: number
  stamps_given: number
  stamps_given_prev: number
  rewards_earned: number
  rewards_earned_prev: number
  rewards_redeemed: number
  rewards_redeemed_prev: number
  active_members: number
  active_members_prev: number
}

export interface TotalsStats {
  total_members: number
  total_stamps: number
  total_rewards_earned: number
  total_rewards_redeemed: number
}

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

async function countRows(
  table: string,
  businessId: string,
  extra: (q: any) => any,
  from?: string,
  to?: string
): Promise<number> {
  let q = supabase.from(table).select('id', { count: 'exact', head: true }).eq('business_id', businessId)
  q = extra(q)
  if (from) q = q.gte('created_at', from)
  if (to) q = q.lt('created_at', to)
  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

export async function fetchPeriodStats(businessId: string, period: Period): Promise<PeriodStats> {
  const now = new Date().toISOString()
  const periodStart = isoDaysAgo(period)
  const prevStart = isoDaysAgo(period * 2)

  const [
    newMembers,
    newMembersPrev,
    stampsGiven,
    stampsGivenPrev,
    rewardsEarned,
    rewardsEarnedPrev,
    rewardsRedeemed,
    rewardsRedeemedPrev,
    activeMembers,
    activeMembersPrev,
  ] = await Promise.all([
    supabase
      .from('memberships')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('joined_at', periodStart)
      .then((r) => r.count ?? 0),
    supabase
      .from('memberships')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('joined_at', prevStart)
      .lt('joined_at', periodStart)
      .then((r) => r.count ?? 0),
    countRows('transactions', businessId, (q) => q.eq('type', 'stamp'), periodStart, now),
    countRows('transactions', businessId, (q) => q.eq('type', 'stamp'), prevStart, periodStart),
    countRows('rewards', businessId, (q) => q, periodStart, now),
    countRows('rewards', businessId, (q) => q, prevStart, periodStart),
    supabase
      .from('rewards')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('redeemed_at', periodStart)
      .then((r) => r.count ?? 0),
    supabase
      .from('rewards')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('redeemed_at', prevStart)
      .lt('redeemed_at', periodStart)
      .then((r) => r.count ?? 0),
    supabase
      .from('memberships')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('last_activity_at', periodStart)
      .then((r) => r.count ?? 0),
    supabase
      .from('memberships')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('last_activity_at', prevStart)
      .lt('last_activity_at', periodStart)
      .then((r) => r.count ?? 0),
  ])

  return {
    period_days: period,
    new_members: newMembers,
    new_members_prev: newMembersPrev,
    stamps_given: stampsGiven,
    stamps_given_prev: stampsGivenPrev,
    rewards_earned: rewardsEarned,
    rewards_earned_prev: rewardsEarnedPrev,
    rewards_redeemed: rewardsRedeemed,
    rewards_redeemed_prev: rewardsRedeemedPrev,
    active_members: activeMembers,
    active_members_prev: activeMembersPrev,
  }
}

export async function fetchTotalsStats(businessId: string): Promise<TotalsStats> {
  const [totalMembers, totalStamps, totalRewardsEarned, totalRewardsRedeemed] = await Promise.all([
    supabase
      .from('memberships')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .then((r) => r.count ?? 0),
    supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('type', 'stamp')
      .then((r) => r.count ?? 0),
    supabase
      .from('rewards')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .then((r) => r.count ?? 0),
    supabase
      .from('rewards')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .not('redeemed_at', 'is', null)
      .then((r) => r.count ?? 0),
  ])

  return {
    total_members: totalMembers,
    total_stamps: totalStamps,
    total_rewards_earned: totalRewardsEarned,
    total_rewards_redeemed: totalRewardsRedeemed,
  }
}

export function pctChange(current: number, prev: number): number | null {
  if (prev === 0) return current > 0 ? null : 0
  return Math.round(((current - prev) / prev) * 100)
}

export async function fetchAnalyticsAiSummary(
  businessId: string,
  period: Period,
  stats: PeriodStats,
  totals: TotalsStats
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('analytics-summary', {
    body: { business_id: businessId, period, stats: { period: stats, totals } },
  })
  if (error) throw error
  return (data as { summary: string }).summary
}

export interface CoachMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function sendCoachMessage(
  businessId: string,
  messages: CoachMessage[],
  stats?: unknown
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('business-coach-chat', {
    body: { business_id: businessId, messages, stats },
  })
  if (error) throw error
  return (data as { reply: string }).reply
}

export interface WebResearchSource {
  url: string
  title: string
}

export interface DeepBusinessReport {
  report: string
  sources: WebResearchSource[]
}

/** Triggers a fresh Firecrawl scrape (Google reviews / shop web presence)
 * + Groq write-up. Owner-only, re-checked server-side. Each call re-scrapes
 * and appends a new business_web_research row — call on demand, not on
 * every page load. */
export async function fetchDeepBusinessReport(businessId: string): Promise<DeepBusinessReport> {
  const { data, error } = await supabase.functions.invoke('deep-business-report', {
    body: { business_id: businessId },
  })
  if (error) throw error
  const result = data as DeepBusinessReport & { error?: string }
  if (result.error) throw new Error(result.error)
  return result
}

/** Most recent cached scrape, if any — read-only, no Firecrawl call. Used to
 * give the business coach chat real review context without re-scraping on
 * every page visit. */
export async function fetchLatestWebResearch(businessId: string): Promise<DeepBusinessReport | null> {
  const { data, error } = await supabase
    .from('business_web_research')
    .select('report, sources')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as DeepBusinessReport | null
}
