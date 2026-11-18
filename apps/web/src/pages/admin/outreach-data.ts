import { supabase } from '@/lib/supabase'
import {
  STEPS, buildBoard, instagramShops, problems, render, sentToday, windowOpen,
  type Lead, type LeadEntry, type Links, type StateMap,
} from '@/lib/outreach-core'

// Data for the admin Outreach page. Everything is read with the admin's own
// session; RLS lets only admins see these tables. Sending happens in the
// `outreach-send` edge function, never in the browser.

export type Settings = {
  auto_send: boolean; leads_list: string; start_hour: number; end_hour: number; weekdays_only: boolean
  daily_limit: number; min_delay_seconds: number; max_delay_seconds: number; followup_gap_days: number[]
  linkedin_angle: 'pain' | 'features' | 'story'; linkedin_daily_limit: number; instagram_list: string; instagram_daily_limit: number
  sender_name: string; from_email: string; booking_link: string; signup_link: string; website: string
  next_send_at: string | null; consecutive_failures: number; last_error: string | null
}
export type MailStatus = { smtpReady: boolean; problem: string | null; host: string; port: number; user: string; hasPass: boolean; dryRunForced: boolean }
export type LogRow = { id: number; at: string; type: string; text: string }
export type LinkedinState = { requested: string | null; accepted: string | null; messaged: string | null }
export type InstagramState = { sent: string | null; followed_up: string | null; replied: string | null; no: string | null }
export type Reviewer = { handle: string; name: string; area: string; liked: string; added: string }

export type OutreachData = {
  settings: Settings
  leadsByList: Record<string, Lead[]>
  state: StateMap
  blocked: Set<string>
  excluded: Set<string>
  linkedin: Record<string, LinkedinState>
  instagram: Record<string, InstagramState>
  reviewers: Reviewer[]
  templates: Record<string, string>
  log: LogRow[]
  mail: MailStatus | null
  mailError: string
}

export const TEMPLATE_NAMES: Record<string, string> = {
  'email-1-pain.txt': 'Email 1 · pain points', 'email-2-features.txt': 'Email 2 · features', 'email-3-story.txt': 'Email 3 · your story',
  'linkedin.json': 'LinkedIn messages', 'instagram.json': 'Instagram DMs',
}

type Q<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>
async function all<T>(query: (from: number, to: number) => Q<T>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) return out
  }
}

type LeadRow = {
  list: string; email: string; all_emails: string[]; shop: string; first_name: string; shop_type: string; area: string
  linkedin_url: string; instagram_handle: string; legal_entity: string; company_number: string; email_ok: boolean
}

export async function invokeOutreach<T = Record<string, unknown>>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('outreach-send', { body: { action, ...extra } })
  if (error) {
    let msg = error.message
    try { msg = (await (error as { context?: Response }).context?.json())?.error ?? msg } catch { /* keep generic */ }
    throw new Error(msg)
  }
  const d = data as T & { error?: string }
  if (d && typeof d === 'object' && 'error' in d && d.error) throw new Error(d.error)
  return d
}

export async function loadOutreach(): Promise<OutreachData> {
  const [settingsRes, leadRows, stops, sends, dnc, excl, li, ig, reviewers, templates, log] = await Promise.all([
    supabase.from('outreach_settings').select('*').eq('id', true).single(),
    all<LeadRow>((a, b) => supabase.from('outreach_leads').select('list, email, all_emails, shop, first_name, shop_type, area, linkedin_url, instagram_handle, legal_entity, company_number, email_ok').order('list').order('position').range(a, b)),
    all<{ email: string; shop: string; stopped_reason: string | null; stopped_at: string | null }>((a, b) => supabase.from('outreach_lead_state').select('email, shop, stopped_reason, stopped_at').order('email').range(a, b)),
    all<{ email: string; step: number; step_key: string; sent_at: string; message_id: string | null }>((a, b) => supabase.from('outreach_sends').select('email, step, step_key, sent_at, message_id').order('sent_at').order('step').range(a, b)),
    all<{ email: string }>((a, b) => supabase.from('outreach_do_not_contact').select('email').order('email').range(a, b)),
    all<{ email: string }>((a, b) => supabase.from('outreach_excluded').select('email').order('email').range(a, b)),
    all<{ email: string } & LinkedinState>((a, b) => supabase.from('outreach_linkedin').select('*').order('email').range(a, b)),
    all<{ handle: string } & InstagramState>((a, b) => supabase.from('outreach_instagram').select('*').order('handle').range(a, b)),
    all<Reviewer>((a, b) => supabase.from('outreach_reviewers').select('*').order('added').order('handle').range(a, b)),
    supabase.from('outreach_templates').select('key, content'),
    supabase.from('outreach_log').select('*').order('at', { ascending: false }).limit(60),
  ])
  if (settingsRes.error || !settingsRes.data) throw new Error(settingsRes.error?.message ?? 'Outreach tables are not set up yet.')

  const leadsByList: Record<string, Lead[]> = {}
  for (const r of leadRows) (leadsByList[r.list] ??= []).push({
    email: r.email, allEmails: r.all_emails, shop: r.shop, firstName: r.first_name, shopType: r.shop_type, area: r.area,
    linkedin: r.linkedin_url, instagram: r.instagram_handle, legalEntity: r.legal_entity, companyNumber: r.company_number, emailOk: r.email_ok,
  })
  const state: StateMap = {}
  const entry = (email: string): LeadEntry => (state[email] ??= { shop: '', steps: [], stopped: null })
  for (const s of stops) { const e = entry(s.email); e.shop = s.shop; e.stopped = s.stopped_reason ? { reason: s.stopped_reason, at: s.stopped_at ?? '' } : null }
  for (const s of sends) entry(s.email).steps.push({ step: s.step, stepKey: s.step_key, sentAt: s.sent_at, messageId: s.message_id })

  let mail: MailStatus | null = null, mailError = ''
  try { mail = await invokeOutreach<MailStatus>('status') } catch (e) { mailError = (e as Error).message }

  return {
    settings: settingsRes.data as Settings,
    leadsByList, state,
    blocked: new Set(dnc.map((r) => r.email)),
    excluded: new Set(excl.map((r) => r.email)),
    linkedin: Object.fromEntries(li.map(({ email, ...v }) => [email, v])),
    instagram: Object.fromEntries(ig.map(({ handle, ...v }) => [handle, v])),
    reviewers,
    templates: Object.fromEntries((templates.data ?? []).map((t) => [t.key, t.content])),
    log: (log.data ?? []) as LogRow[],
    mail, mailError,
  }
}

export const linksOf = (s: Settings): Links => ({ bookingLink: s.booking_link, signupLink: s.signup_link, website: s.website, senderName: s.sender_name })

export function board(d: OutreachData) {
  return buildBoard(d.leadsByList[d.settings.leads_list] ?? [], d.state, d.blocked, d.excluded, d.settings.followup_gap_days)
}

// server.mjs autoStatus(), with the schedule now kept in the database.
export function autoStatus(d: OutreachData) {
  const s = d.settings
  let reason: string | null = null
  if (!s.auto_send) reason = 'Auto-send is off'
  else if (d.mail && !d.mail.smtpReady) reason = 'Email account not set up'
  else if (sentToday(d.state) >= s.daily_limit) reason = 'Today’s limit reached, carries on tomorrow'
  else if (!windowOpen({ startHour: s.start_hour, endHour: s.end_hour, weekdaysOnly: s.weekdays_only })) reason = `Outside sending hours (${s.start_hour}:00–${s.end_hour}:00${s.weekdays_only ? ', Mon–Fri' : ''}, London time)`
  const next = !reason && s.next_send_at && Date.parse(s.next_send_at) > Date.now() ? s.next_send_at : null
  return { on: s.auto_send, active: !reason, reason, nextSendAt: next }
}

// server.mjs overview() stats.
export function stats(d: OutreachData) {
  const b = board(d)
  const byStatus: Record<string, number> = {}
  for (const r of b.rows) byStatus[r.status] = (byStatus[r.status] || 0) + 1
  const allSteps = Object.values(d.state).flatMap((l) => l.steps)
  const stopped = Object.values(d.state).filter((l) => l.stopped)
  const booked = stopped.filter((l) => /book|call|meet/i.test(l.stopped!.reason)).length
  const started = allSteps.filter((x) => x.stepKey === 'pain').length
  const li = Object.values(d.linkedin)
  const ig = Object.values(d.instagram)
  const today = new Date().toDateString()
  return {
    board: b, byStatus,
    sentToday: sentToday(d.state),
    emailsSent: allSteps.length, started, replied: stopped.length, booked,
    replyRate: started ? Math.round((stopped.length / started) * 100) : 0,
    bySteps: STEPS.map((st) => ({ label: st.label, count: allSteps.filter((x) => x.stepKey === st.key).length })),
    linkedin: {
      requested: li.filter((x) => x.requested).length, accepted: li.filter((x) => x.accepted).length,
      messaged: li.filter((x) => x.messaged).length, today: li.filter((x) => x.requested && new Date(x.requested).toDateString() === today).length,
    },
    instagram: {
      sent: ig.filter((x) => x.sent).length, replied: ig.filter((x) => x.replied).length,
      today: ig.filter((x) => x.sent && new Date(x.sent).toDateString() === today).length,
    },
  }
}

export function templateIssues(d: OutreachData) {
  const out: string[] = []
  const sample = board(d).rows[0] ?? { shop: 'Sample Shop', shopType: 'café', area: 'London', firstName: '' }
  STEPS.forEach((st) => {
    const t = d.templates[st.file]
    if (!t) { out.push(`${st.label}: template missing`); return }
    const p = problems(render(t, sample, linksOf(d.settings)))
    if (p.length) out.push(`${st.label}: ${p.join('; ')}`)
  })
  return out
}

export function igShops(d: OutreachData) {
  return instagramShops(d.leadsByList[d.settings.instagram_list] ?? [], d.blocked)
}

export async function addLog(type: string, text: string) {
  await supabase.from('outreach_log').insert({ type, text })
}
