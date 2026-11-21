import * as React from 'react'
import { toast } from 'sonner'
import { CalendarCheck, BadgeCheck, MessageCircle, Hand, Plane, MailX, Flag, Send, FlaskConical, ArrowUpRight, Copy, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { fmtDate } from '@/pages/admin/kit'
import {
  STEPS, hasOptOutLine, igHandle, instagramTexts, linkedinSearch, linkedinTexts, problems, render, templateError,
  type BoardRow, type Status,
} from '@/lib/outreach-core'
import {
  TEMPLATE_NAMES, addLog, autoStatus, board, igShops, invokeOutreach, linksOf, loadOutreach, stats, templateIssues,
  type OutreachData, type Settings,
} from '@/pages/admin/outreach-data'

// The cold-email outreach bot, online. Same tabs and rules as the laptop
// dashboard (marketing/outreach-bot); sending runs in the `outreach-send`
// edge function every minute while auto-send is on, so the laptop can be off.

type Sub = 'overview' | 'leads' | 'linkedin' | 'instagram' | 'emails' | 'settings'
const SUBS: { key: Sub; label: string }[] = [
  { key: 'overview', label: 'Overview' }, { key: 'leads', label: 'Leads' }, { key: 'linkedin', label: 'LinkedIn' },
  { key: 'instagram', label: 'Instagram' }, { key: 'emails', label: 'Emails' }, { key: 'settings', label: 'Settings' },
]

const STATUS: Record<Status, string> = {
  due: 'Due now', waiting: 'Waiting', stopped: 'Replied', finished: 'Finished', 'emailed-before': 'Emailed before',
  'do-not-contact': 'Do not contact', 'no-consent': 'Needs consent',
}
const STATUS_TONE: Record<Status, string> = {
  due: 'is-accent', waiting: 'is-info', stopped: 'is-ok', finished: 'is-ok', 'emailed-before': 'is-warn', 'do-not-contact': 'is-bad', 'no-consent': 'is-warn',
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'Something went wrong')
const when = (v: string | null | undefined) => (v ? fmtDate(v) : '')

type Preview = { email: string; step: number }

export function Outreach() {
  const [sub, setSub] = React.useState<Sub>('overview')
  const [data, setData] = React.useState<OutreachData | null>(null)
  const [error, setError] = React.useState('')
  const [preview, setPreview] = React.useState<Preview | null>(null)
  const [stopFor, setStopFor] = React.useState<BoardRow | null>(null)

  const load = React.useCallback(async () => {
    try { setData(await loadOutreach()); setError('') } catch (e) { setError(errMsg(e)) }
  }, [])
  React.useEffect(() => { void load() }, [load])
  // Keep the overview fresh while it is open: the sender runs on its own.
  React.useEffect(() => {
    if (sub !== 'overview') return
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load() }, 30_000)
    return () => clearInterval(t)
  }, [sub, load])

  if (error && !data) return <div role="alert" className="ag-alert"><div><strong>Couldn’t load the outreach bot</strong><p>{error}</p></div><button type="button" className="ag-btn is-sm" onClick={() => void load()}>Retry</button></div>
  if (!data) return <div role="status" aria-label="Loading the outreach bot" className="ag-loading"><span/><span/><span/></div>

  const ctx = { data, reload: load, openPreview: (email: string, step?: number) => {
    const row = board(data).rows.find((r) => r.email === email)
    setPreview({ email, step: step ?? row?.dueStep ?? Math.min(row?.stepsSent.length ?? 0, 2) })
  }, openStop: setStopFor, go: setSub }

  return <div className="ag-or">
    <div className="ag-seg ag-or-subs" role="tablist" aria-label="Outreach sections">
      {SUBS.map((s) => <button key={s.key} type="button" role="tab" aria-pressed={sub === s.key} aria-selected={sub === s.key} onClick={() => setSub(s.key)}>{s.label}</button>)}
    </div>
    {sub === 'overview' ? <OverviewTab {...ctx}/> : sub === 'leads' ? <LeadsTab {...ctx}/> : sub === 'linkedin' ? <LinkedinTab {...ctx}/>
      : sub === 'instagram' ? <InstagramTab {...ctx}/> : sub === 'emails' ? <EmailsTab {...ctx}/> : <SettingsTab {...ctx}/>}
    <PreviewSheet data={data} preview={preview} onStep={(step) => preview && setPreview({ ...preview, step })} onClose={() => setPreview(null)}/>
    <StopSheet data={data} row={stopFor} onClose={() => setStopFor(null)} onDone={load}/>
  </div>
}

type Ctx = { data: OutreachData; reload: () => Promise<void>; openPreview: (email: string, step?: number) => void; openStop: (r: BoardRow) => void; go: (s: Sub) => void }

// ---------- overview ----------
function OverviewTab({ data, reload, openPreview, go }: Ctx) {
  const a = autoStatus(data)
  const st = stats(data)
  const [busy, setBusy] = React.useState<null | 'send' | 'dry' | 'switch'>(null)
  const [askOn, setAskOn] = React.useState(false)
  const s = data.settings
  const issues = templateIssues(data)

  async function setAuto(on: boolean) {
    if (on && data.mail && !data.mail.smtpReady) return void toast.error('Set up the email account first (Settings).')
    setBusy('switch')
    const { error } = await supabase.rpc('outreach_set_auto_send', { _on: on })
    setBusy(null); setAskOn(false)
    if (error) return void toast.error(error.message)
    toast.success(on ? 'Auto-send on' : 'Auto-send off')
    await reload()
  }
  async function sendNow(dry: boolean) {
    setBusy(dry ? 'dry' : 'send')
    try {
      const r = await invokeOutreach<{ sent?: boolean; dryRun?: boolean; skipped?: string; to?: string; step?: string; subject?: string }>(dry ? 'dry-run' : 'send-next')
      if (r.sent) toast.success(`Sent ${r.step} to ${r.to}`)
      else if (r.dryRun) toast.success(`Dry run: would send ${r.step} to ${r.to} (“${r.subject}”). Nothing was sent.`)
      else toast(`Nothing sent: ${r.skipped}`)
    } catch (e) { toast.error(errMsg(e)) }
    setBusy(null)
    await reload()
  }

  const title = a.active ? 'Auto-send is running' : a.on ? 'Auto-send is on, paused' : 'Auto-send is off'
  const subtitle = a.active ? (a.nextSendAt ? `Next email around ${when(a.nextSendAt)}` : st.board.queue.length ? 'Next email within a couple of minutes' : 'Nobody is due right now, it will pick up follow-ups as they fall due')
    : !a.on ? 'Flip the switch to start emailing shops automatically' : (a.reason ?? '')
  const warnings: React.ReactNode[] = []
  if (data.mail?.dryRunForced) warnings.push(<>Dry-run mode is on (secret <code>OUTREACH_DRY_RUN</code>): the sender only logs what it would send.</>)
  if (data.mailError) warnings.push(<>Couldn’t reach the sender function: {data.mailError}</>)
  else if (data.mail && !data.mail.smtpReady) warnings.push(<>{data.mail.problem} Nothing can send yet. <button type="button" className="ag-or-link" onClick={() => go('settings')}>Open Settings</button></>)
  if (!(data.leadsByList[s.leads_list]?.length)) warnings.push(<>The leads list “{s.leads_list}” is empty. Import the leads first.</>)
  for (const t of issues) warnings.push(t)
  if (s.last_error) warnings.push(<>Last send failed: {s.last_error}</>)
  // Reply checker problems never stop the sender; they are only shown here.
  if (s.checker_last_error) warnings.push(<>Reply check failed: {s.checker_last_error}. Sending carries on; mark replies by hand until this clears.</>)
  else if (s.checker_last_run && Date.now() - Date.parse(s.checker_last_run) > 20 * 60_000) warnings.push(<>Replies haven’t been checked since {when(s.checker_last_run)}.</>)
  const needsYou = Object.values(data.replies).filter((r) => r.label === 'Needs you').length
  if (data.mail?.smtpReady && !st.board.queue.length && !st.byStatus.waiting) warnings.push(<>Everyone on this list has been emailed or excluded. Add more leads.</>)
  const max = Math.max(1, ...st.bySteps.map((x) => x.count))

  return <div className="ag-or-stack">
    {warnings.map((w, i) => <div key={i} role="alert" className="ag-or-warn">{w}</div>)}
    <section className={'ag-card ag-or-hero' + (a.active ? ' is-live' : a.on ? ' is-wait' : '')}>
      <div className="ag-or-state"><span className="ag-or-dot" aria-hidden="true"/><div><h2>{title}</h2><p>{subtitle}</p></div></div>
      <div className="ag-or-row">
        <button type="button" className="ag-btn" disabled={!!busy} onClick={() => void sendNow(true)}><FlaskConical size={16} aria-hidden="true"/>{busy === 'dry' ? 'Checking…' : 'Dry run'}</button>
        <button type="button" className="ag-btn" disabled={!!busy} onClick={() => void sendNow(false)}><Send size={16} aria-hidden="true"/>{busy === 'send' ? 'Sending…' : 'Send next email now'}</button>
        <label className="ag-or-switch"><span>Auto-send</span><Switch checked={s.auto_send} disabled={!!busy} onCheckedChange={(on) => (on ? setAskOn(true) : void setAuto(false))} aria-label="Auto-send"/></label>
      </div>
    </section>
    {needsYou > 0 && <button type="button" className="ag-or-needs" onClick={() => go('leads')}>
      <Flag size={18} aria-hidden="true"/><span><b>{needsYou === 1 ? '1 reply needs you' : `${needsYou} replies need you`}</b><small>Their emails are stopped. Read and answer them yourself, then set the right label.</small></span>
      <ArrowUpRight size={18} aria-hidden="true"/></button>}
    <p className="ag-or-muted">{s.checker_last_ok ? `Replies are checked every 5 minutes. Last checked ${when(s.checker_last_ok)}.` : 'Reply checking hasn’t run yet.'}</p>
    <div className="ag-or-tiles">
      <Tile tone="var(--ag-sky)" value={`${st.sentToday}/${s.daily_limit}`} label="emails sent today"/>
      <Tile tone="var(--ag-peach)" value={st.board.queue.length} label="shops due an email"/>
      <Tile tone="var(--ag-good)" value={st.booked} label="calls booked"/>
      <Tile tone="var(--ag-rose)" value={`${st.replyRate}%`} label="reply rate"/>
    </div>
    <div className="ag-or-two">
      <section className="ag-card ag-sec"><div className="ag-sec-head"><h2>Sequence</h2></div>
        {st.bySteps.map((x) => <Bar key={x.label} label={x.label} n={x.count} max={max} tone="var(--ag-sky)"/>)}
        <Bar label="Replied / stopped" n={st.replied} max={max} tone="var(--ag-good)"/>
        <Bar label="LinkedIn requests" n={st.linkedin.requested} max={max} tone="#5AA2F0"/>
        <Bar label="LinkedIn accepted" n={st.linkedin.accepted} max={max} tone="#5AA2F0"/>
        <Bar label="Instagram DMs" n={st.instagram.sent} max={max} tone="var(--ag-rose)"/>
        <Bar label="Instagram replies" n={st.instagram.replied} max={max} tone="var(--ag-rose)"/>
      </section>
      <section className="ag-card ag-sec"><div className="ag-sec-head"><h2>Next up</h2></div>
        {st.board.queue.length ? <ul className="ag-or-list">{st.board.queue.slice(0, 5).map(({ lead, step }) => <li key={lead.email}>
          <span><b>{lead.shop}</b> <small>{STEPS[step].label}</small></span>
          <button type="button" className="ag-btn is-sm" onClick={() => openPreview(lead.email, step)}>Preview</button>
        </li>)}</ul> : <p className="ag-or-muted">Nobody is due right now.</p>}
      </section>
    </div>
    <section className="ag-card ag-sec"><div className="ag-sec-head"><h2>Activity</h2></div>
      {data.log.length ? <ul className="ag-or-log">{data.log.map((l) => <li key={l.id}><span className={`ag-or-ev is-${l.type}`} aria-hidden="true"/><time>{when(l.at)}</time><span>{l.text}</span></li>)}</ul>
        : <p className="ag-or-muted">Nothing yet. Activity shows here once emails start going out.</p>}
    </section>
    <Dialog open={askOn} onOpenChange={setAskOn}>
      <DialogContent className="admin-panel ag ag-or-dialog">
        <DialogHeader>
          <DialogTitle>Turn on auto-send?</DialogTitle>
          <DialogDescription>
            It will email up to <b>{s.daily_limit}</b> shops a day from <b>{s.from_email || 'your mailbox'}</b>, between {s.start_hour}:00 and {s.end_hour}:00 London time{s.weekdays_only ? ' on weekdays' : ''}, a few minutes apart. Follow-ups go out automatically {s.followup_gap_days[0]} and {s.followup_gap_days[0] + s.followup_gap_days[1]} days later.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">It runs online, so your laptop can be shut. Keep the laptop bot switched off, or shops could be emailed twice. When someone replies, mark them on the Leads tab so they get no more emails.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="ag-btn is-primary" disabled={busy === 'switch'} onClick={() => void setAuto(true)}>Turn on</button>
          <button type="button" className="ag-btn" onClick={() => setAskOn(false)}>Cancel</button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
}

function Tile({ tone, value, label }: { tone: string; value: React.ReactNode; label: string }) {
  return <div className="ag-card ag-or-tile" style={{ '--tone': tone } as React.CSSProperties}><b>{value}</b><span>{label}</span></div>
}
function Bar({ label, n, max, tone }: { label: string; n: number; max: number; tone: string }) {
  return <div className="ag-or-bar"><div><span>{label}</span><b>{n}</b></div><i><em style={{ width: `${Math.round((n / max) * 100)}%`, background: tone }}/></i></div>
}

// ---------- leads ----------
type LeadFilter = 'all' | 'replies' | 'needs-you' | Status
const FILTERS: LeadFilter[] = ['all', 'replies', 'needs-you', 'due', 'waiting', 'stopped', 'finished', 'emailed-before', 'do-not-contact', 'no-consent']
const FILTER_LABEL: Record<string, string> = { all: 'All', replies: 'Replies', 'needs-you': 'Needs you' }

const LABEL_TONE: Record<string, string> = {
  'Booked a call': 'is-ok', 'Signed up': 'is-ok', Interested: 'is-info', 'Said no': 'is-bad',
  'Out of office': 'is-warn', Bounced: 'is-bad', 'Needs you': 'is-accent',
}

function LeadsTab({ data, reload, openPreview, openStop }: Ctx) {
  const [filter, setFilter] = React.useState<LeadFilter>('all')
  const [q, setQ] = React.useState('')
  const { rows } = board(data)
  const counts: Record<string, number> = { all: rows.length }
  for (const r of rows) {
    counts[r.status] = (counts[r.status] || 0) + 1
    const rep = data.replies[r.email]
    if (rep) counts.replies = (counts.replies || 0) + 1
    if (rep?.label === 'Needs you') counts['needs-you'] = (counts['needs-you'] || 0) + 1
  }
  const match = (r: BoardRow) => filter === 'all' || r.status === filter
    || (filter === 'replies' && !!data.replies[r.email]) || (filter === 'needs-you' && data.replies[r.email]?.label === 'Needs you')
  const shown = rows.filter((r) => match(r) && (!q || (r.shop + r.email).toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => filter === 'replies' || filter === 'needs-you' ? String(data.replies[b.email]?.at ?? '').localeCompare(String(data.replies[a.email]?.at ?? '')) : 0)

  async function resume(email: string) {
    const { error } = await supabase.rpc('outreach_resume_lead', { _email: email })
    if (error) return void toast.error(error.message)
    toast.success('Back in the sequence')
    await reload()
  }

  return <section className="ag-card ag-sec">
    <div className="ag-sec-head"><div><h2>Leads</h2><p>List: {data.settings.leads_list}</p></div>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search shop or email" className="ag-or-input" aria-label="Search leads"/></div>
    <div className="ag-or-chips">{FILTERS.filter((k) => counts[k]).map((k) => <button key={k} type="button" aria-pressed={filter === k} className={k === 'needs-you' ? 'is-needs' : ''} onClick={() => setFilter(k)}>{FILTER_LABEL[k] ?? STATUS[k as Status]} <b>{counts[k]}</b></button>)}</div>
    <div className="ag-or-table"><table>
      <thead><tr><th>Shop</th><th>Progress</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
      <tbody>{shown.length ? shown.map((r) => {
        const last = r.stepsSent.at(-1)
        const rep = data.replies[r.email]
        const extra = r.stopped && !rep ? r.stopped.reason : r.nextDueAt ? `next ${when(r.nextDueAt)}` : last ? `last ${when(last.sentAt)}` : ''
        return <tr key={r.email}>
          <td><b>{r.shop}</b><small>{r.email} · {r.shopType}, {r.area}</small></td>
          <td><span className="ag-or-steps" aria-label={`${r.stepsSent.length} of 3 sent`}>{[0, 1, 2].map((i) => <i key={i} className={i < r.stepsSent.length ? 'is-done' : ''}/>)}</span></td>
          <td>
            <span className="ag-or-tags"><span className={`ag-tag ${STATUS_TONE[r.status]}`}>{STATUS[r.status]}</span>
              {rep && <span className={`ag-tag ${LABEL_TONE[rep.label] ?? ''}`}>{rep.label}{rep.by === 'ai' ? ' · AI' : ''}</span>}</span>
            {extra && <small>{extra}</small>}
            {rep && <div className="ag-or-reply">
              {rep.reason && <small>{rep.reason}</small>}
              {rep.snippet && <q>{rep.snippet}</q>}
              {rep.at && <small>{when(rep.at)}</small>}
            </div>}
          </td>
          <td className="ag-or-actions">
            {['due', 'waiting', 'finished'].includes(r.status) && <button type="button" className="ag-btn is-sm" onClick={() => openPreview(r.email)}>Preview</button>}
            {r.status === 'stopped' && !rep && <button type="button" className="ag-btn is-sm" onClick={() => void resume(r.email)}>Undo</button>}
            {(rep || ['due', 'waiting', 'finished', 'stopped'].includes(r.status)) && <button type="button" className={'ag-btn is-sm' + (rep ? '' : ' is-primary')} onClick={() => openStop(r)}>{rep ? 'Change' : 'Replied'}</button>}
          </td>
        </tr>
      }) : <tr><td colSpan={4} className="ag-or-muted">No leads here.</td></tr>}</tbody>
    </table></div>
  </section>
}

const REASONS = [
  { reason: 'Booked a call', hint: 'Brilliant', icon: CalendarCheck, tone: 'var(--ag-good)' },
  { reason: 'Signed up', hint: 'Already on board', icon: BadgeCheck, tone: 'var(--ag-sky)' },
  { reason: 'Interested', hint: 'Carry on by hand', icon: MessageCircle, tone: 'var(--ag-peach)' },
  { reason: 'Said no', hint: 'Adds to do-not-contact', icon: Hand, tone: 'var(--ag-rose)' },
  { reason: 'Out of office', hint: 'Keeps emailing', icon: Plane, tone: 'var(--ag-warn)' },
  { reason: 'Bounced', hint: 'Address doesn’t work', icon: MailX, tone: 'var(--ag-bad)' },
  { reason: 'Needs you', hint: 'Stops, you reply by hand', icon: Flag, tone: 'var(--ag-accent)' },
]

function StopSheet({ data, row, onClose, onDone }: { data: OutreachData; row: BoardRow | null; onClose: () => void; onDone: () => Promise<void> }) {
  const [busy, setBusy] = React.useState(false)
  const [askDnc, setAskDnc] = React.useState<string | null>(null)
  React.useEffect(() => { setAskDnc(null) }, [row])
  const current = row ? data.replies[row.email]?.label : undefined
  const onDnc = !!row && data.blocked.has(row.email)

  async function apply(label: string, removeDnc: boolean) {
    if (!row) return
    setBusy(true)
    const { error } = await supabase.rpc('outreach_set_reply_label', { _email: row.email, _label: label, _remove_dnc: removeDnc })
    setBusy(false)
    if (error) return void toast.error(error.message)
    toast.success(`${row.shop}: ${label}${removeDnc ? ', removed from do-not-contact' : ''}`)
    onClose()
    await onDone()
  }
  function pick(label: string) {
    // Leaving "Said no" never quietly un-blocks someone: ask first.
    if (label !== 'Said no' && onDnc) return setAskDnc(label)
    void apply(label, false)
  }

  return <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="admin-panel ag ag-or-dialog">
      {askDnc ? <>
        <DialogHeader><DialogTitle>Take {row?.shop} off do-not-contact?</DialogTitle>
          <DialogDescription>They’re on the do-not-contact list. Changing the label to “{askDnc}” can keep them there, or remove them so they can be emailed again.</DialogDescription></DialogHeader>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="ag-btn is-primary" disabled={busy} onClick={() => void apply(askDnc, false)}>Keep on do-not-contact</button>
          <button type="button" className="ag-btn" disabled={busy} onClick={() => void apply(askDnc, true)}>Remove from do-not-contact</button>
        </div>
      </> : <>
        <DialogHeader><DialogTitle>{current ? `Change ${row?.shop}’s label` : `${row?.shop} replied?`}</DialogTitle>
          <DialogDescription>{current ? `Now: ${current}.` : ''} Every label except Out of office stops their emails. Nothing is ever sent to them automatically.</DialogDescription></DialogHeader>
        <div className="ag-or-reasons">{REASONS.map((r) => <button key={r.reason} type="button" disabled={busy || r.reason === current} aria-pressed={r.reason === current} onClick={() => pick(r.reason)} style={{ '--tone': r.tone } as React.CSSProperties}>
          <span className="ag-disc" aria-hidden="true"><r.icon size={18} strokeWidth={1.75}/></span><span><b>{r.reason}</b><small>{r.hint}</small></span>
        </button>)}</div>
      </>}
    </DialogContent>
  </Dialog>
}

function PreviewSheet({ data, preview, onStep, onClose }: { data: OutreachData; preview: Preview | null; onStep: (s: number) => void; onClose: () => void }) {
  const row = preview && board(data).rows.find((r) => r.email === preview.email)
  const tpl = preview ? data.templates[STEPS[preview.step].file] : undefined
  const msg = row && tpl ? render(tpl, row, linksOf(data.settings)) : null
  const bad = msg ? [...problems(msg), ...(hasOptOutLine(msg.text) ? [] : ['no “reply no” opt-out line'])] : []
  return <Dialog open={!!preview} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="admin-panel ag ag-or-dialog sm:max-w-2xl">
      <DialogHeader><DialogTitle>{preview ? STEPS[preview.step].label : ''}</DialogTitle><DialogDescription>To {preview?.email}{preview && preview.step > 0 ? ' · same thread as email 1' : ''}</DialogDescription></DialogHeader>
      {!msg ? <p className="text-sm text-destructive">{tpl ? 'This lead isn’t on the current list.' : 'Template missing.'}</p> : <>
        {bad.length > 0 && <p role="alert" className="ag-or-warn">{bad.join('; ')}. This email would not be sent.</p>}
        <p className="font-semibold">{msg.subject}</p>
        <pre className="ag-or-msg">{msg.text}</pre>
      </>}
      <div className="flex flex-wrap gap-2">{[0, 1, 2].map((i) => <button key={i} type="button" className={'ag-btn is-sm' + (i === preview?.step ? ' is-primary' : '')} onClick={() => onStep(i)}>Email {i + 1}</button>)}
        <button type="button" className="ag-btn is-sm" onClick={onClose}>Close</button></div>
    </DialogContent>
  </Dialog>
}

// ---------- linkedin ----------
function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = React.useState(false)
  return <button type="button" className="ag-btn is-sm" onClick={() => void navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1400) }, () => toast.error('Couldn’t copy'))}>
    {done ? <Check size={14} aria-hidden="true"/> : <Copy size={14} aria-hidden="true"/>}{done ? 'Copied' : label}</button>
}

function LinkedinTab({ data, reload }: Ctx) {
  const [filter, setFilter] = React.useState<'todo' | 'accepted' | 'all'>('todo')
  const s = data.settings
  const json = data.templates['linkedin.json']
  const st = stats(data)
  if (!json) return <p className="ag-or-warn">The LinkedIn template is missing. Import the templates first.</p>
  const rows = board(data).rows.filter((r) => r.status !== 'do-not-contact')
  const shown = rows.filter((r) => { const x = data.linkedin[r.email]; return filter === 'all' || (filter === 'todo' ? !x?.requested : !!x?.accepted && !x?.messaged) })

  async function setAngle(angle: string) {
    const { error } = await supabase.from('outreach_settings').update({ linkedin_angle: angle, updated_at: new Date().toISOString() }).eq('id', true)
    if (error) return void toast.error(error.message)
    await reload()
  }
  async function mark(r: BoardRow, field: 'requested' | 'accepted' | 'messaged') {
    const on = !data.linkedin[r.email]?.[field]
    const { error } = await supabase.from('outreach_linkedin').upsert({ email: r.email, [field]: on ? new Date().toISOString() : null }, { onConflict: 'email' })
    if (error) return void toast.error(error.message)
    if (on) await addLog('linkedin', `LinkedIn ${field}: ${r.shop || r.email}`)
    await reload()
  }

  return <div className="ag-or-stack">
    <section className="ag-card ag-sec">
      <div className="ag-sec-head"><div><h2>LinkedIn queue</h2><p>Open the shop, send the note, tick it off. LinkedIn bans accounts that send by bot, so this one stays one click each.</p></div>
        <div className="ag-or-row"><span className="ag-tag is-info">{st.linkedin.today}/{s.linkedin_daily_limit} today</span>
          <select className="ag-or-input" value={s.linkedin_angle} onChange={(e) => void setAngle(e.target.value)} aria-label="Message angle"><option value="pain">Pain points</option><option value="features">Features</option><option value="story">Your story</option></select>
          <select className="ag-or-input" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Show"><option value="todo">To do</option><option value="accepted">Accepted, not messaged</option><option value="all">All</option></select></div></div>
    </section>
    {shown.length ? shown.map((r) => {
      const x = data.linkedin[r.email] ?? { requested: null, accepted: null, messaged: null }
      const t = linkedinTexts(json, r, s.linkedin_angle, linksOf(s))
      return <article key={r.email} className={'ag-card ag-or-card is-linkedin' + (filter === 'all' && x.messaged ? ' is-done' : '')}>
        <header><span><b>{r.shop}</b> <small>{r.shopType} · {r.area}</small></span>
          <a className="ag-btn is-sm ag-or-brand" href={linkedinSearch(r)} target="_blank" rel="noopener noreferrer">{r.linkedin ? 'Open profile' : 'Find on LinkedIn'}<ArrowUpRight size={14} aria-hidden="true"/></a></header>
        <small>Connection note · <span className={t.connect.length > 300 ? 'ag-or-over' : ''}>{t.connect.length}/300</span></small>
        <pre className="ag-or-msg">{t.connect}</pre><CopyButton text={t.connect} label="Copy note"/>
        {x.accepted && <><small>Message after they accept</small><pre className="ag-or-msg">{t.message}</pre><CopyButton text={t.message} label="Copy message"/></>}
        <div className="ag-or-checks">{(['requested', 'accepted', 'messaged'] as const).map((k) => <button key={k} type="button" aria-pressed={!!x[k]} onClick={() => void mark(r, k)}>
          {x[k] && <Check size={14} aria-hidden="true"/>}{{ requested: 'Request sent', accepted: 'Accepted', messaged: 'Message sent' }[k]}</button>)}</div>
      </article>
    }) : <p className="ag-card ag-sec ag-or-muted">Nothing here.{filter === 'todo' ? ' Every shop has had a request.' : ''}</p>}
  </div>
}

// ---------- instagram ----------
const IG_HELP = {
  shops: <>Follow them and like a couple of posts first, then send the DM. No links in the first message. <span className="ag-tag is-ok">Ltd company</span> = fine to DM. <span className="ag-tag is-warn">Check first</span> = may be a sole trader, who needs consent under UK rules: check Companies House, or call or visit instead.</>,
  reviewers: <>Only DM reviewers whose bio says they’re open to collabs or PR. Add a few words about a post you liked: it goes into the DM, and personal DMs get far more replies.</>,
}
const IG_LABEL = { sent: 'DM sent', followed_up: 'Followed up', replied: 'Replied', no: 'Said no' } as const
const IG_LOG = { sent: 'DM sent', followed_up: 'follow-up sent', replied: 'replied', no: 'said no' } as const

function InstagramTab({ data, reload }: Ctx) {
  const [kind, setKind] = React.useState<'shops' | 'reviewers'>('shops')
  const [filter, setFilter] = React.useState<'todo' | 'followup' | 'replied' | 'all'>('todo')
  const [paste, setPaste] = React.useState('')
  const s = data.settings
  const json = data.templates['instagram.json']
  if (!json) return <p className="ag-or-warn">The Instagram template is missing. Import the templates first.</p>
  const items = kind === 'shops' ? igShops(data).map((x) => ({ ...x, name: '', liked: '' })) : data.reviewers.map((r) => ({ ...r, shop: '', shopType: '', company: false, entity: '', companyNumber: '', email: '' }))
  const none = { sent: null, followed_up: null, replied: null, no: null }
  let shown = items.filter((it) => {
    const x = data.instagram[it.handle] ?? none
    if (x.no && filter !== 'all') return false
    return filter === 'all' || (filter === 'todo' ? !x.sent : filter === 'followup' ? !!x.sent && !x.replied : !!x.replied)
  })
  if (kind === 'shops') shown = [...shown].sort((a, b) => Number(b.company) - Number(a.company))

  async function mark(handle: string, field: keyof typeof IG_LABEL) {
    const on = !data.instagram[handle]?.[field]
    const { error } = await supabase.from('outreach_instagram').upsert({ handle, [field]: on ? new Date().toISOString() : null }, { onConflict: 'handle' })
    if (error) return void toast.error(error.message)
    if (on) await addLog('instagram', `Instagram ${IG_LOG[field]}: @${handle}`)
    await reload()
  }
  async function addReviewers() {
    const handles = [...new Set(paste.split(/\n+/).map(igHandle).filter(Boolean))]
    if (!handles.length) return void toast.error('Paste at least one handle')
    const fresh = handles.filter((h) => !data.reviewers.some((r) => r.handle === h))
    const { error } = await supabase.from('outreach_reviewers').upsert(fresh.map((handle) => ({ handle })), { onConflict: 'handle', ignoreDuplicates: true })
    if (error) return void toast.error(error.message)
    setPaste('')
    toast.success(`Added ${fresh.length} (${data.reviewers.length + fresh.length} reviewers in total)`)
    await reload()
  }
  async function saveReviewer(handle: string, field: 'name' | 'liked', value: string) {
    const clean = value.replace(/[\r\n]/g, ' ').trim().slice(0, 200)
    const { error } = await supabase.from('outreach_reviewers').update({ [field]: clean }).eq('handle', handle)
    if (error) return void toast.error(error.message)
    toast.success('Saved')
    await reload()
  }
  async function removeReviewer(handle: string) {
    const { error } = await supabase.from('outreach_reviewers').delete().eq('handle', handle)
    if (error) return void toast.error(error.message)
    toast.success('Removed')
    await reload()
  }

  return <div className="ag-or-stack">
    <section className="ag-card ag-sec">
      <div className="ag-sec-head">
        <div className="ag-seg ag-or-ig" role="group" aria-label="Instagram list">
          <button type="button" aria-pressed={kind === 'shops'} onClick={() => setKind('shops')}>Shops</button>
          <button type="button" aria-pressed={kind === 'reviewers'} onClick={() => setKind('reviewers')}>Food reviewers</button>
        </div>
        <div className="ag-or-row"><span className="ag-tag is-info">{stats(data).instagram.today}/{s.instagram_daily_limit} today</span>
          <select className="ag-or-input" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Show">
            <option value="todo">To do</option><option value="followup">Sent, no reply yet</option><option value="replied">Replied</option><option value="all">All</option></select></div>
      </div>
      <p className="ag-or-muted">{IG_HELP[kind]}</p>
      {kind === 'reviewers' && <div className="ag-or-add">
        <label>Add reviewers: paste Instagram handles or links, one per line
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={3} placeholder={'@londonfoodie\nhttps://instagram.com/cafehunter'} className="ag-or-input"/></label>
        <button type="button" className="ag-btn ag-or-ig-btn" onClick={() => void addReviewers()}>Add to list</button>
      </div>}
    </section>
    {shown.length ? shown.map((it) => {
      const x = data.instagram[it.handle] ?? none
      const texts = instagramTexts(json, kind, it, linksOf(s))
      const step = x.replied ? (['interested', 'Message once they reply'] as const) : x.sent ? (['followup', 'Follow-up (if no reply after 3–4 days)'] as const) : (['opener', 'First DM'] as const)
      return <article key={it.handle} className={'ag-card ag-or-card is-instagram' + (x.no ? ' is-done' : '')}>
        <header><span>{kind === 'shops'
          ? <><b>{it.shop}</b> <small>@{it.handle} · {it.shopType}, {it.area}</small> <span className={`ag-tag ${it.company ? 'is-ok' : 'is-warn'}`}>{it.company ? 'Ltd company' : 'Check first'}</span></>
          : <><b>@{it.handle}</b> {it.name && <small>{it.name}</small>}</>}</span>
          <a className="ag-btn is-sm ag-or-ig-btn" href={`https://www.instagram.com/${encodeURIComponent(it.handle)}/`} target="_blank" rel="noopener noreferrer">Open on Instagram<ArrowUpRight size={14} aria-hidden="true"/></a></header>
        {kind === 'reviewers' && <div className="ag-or-row">
          <input className="ag-or-input" placeholder="Name (optional)" defaultValue={it.name} onBlur={(e) => e.target.value !== it.name && void saveReviewer(it.handle, 'name', e.target.value)} aria-label="Name"/>
          <input className="ag-or-input ag-or-grow" placeholder="A post you liked, e.g. ‘your Peckham bakery crawl’" defaultValue={it.liked} onBlur={(e) => e.target.value !== it.liked && void saveReviewer(it.handle, 'liked', e.target.value)} aria-label="A post you liked"/>
          <button type="button" className="ag-btn is-sm" onClick={() => void removeReviewer(it.handle)}>Remove</button></div>}
        <small>{step[1]}</small><pre className="ag-or-msg">{texts[step[0]]}</pre><CopyButton text={texts[step[0]]} label="Copy"/>
        <div className="ag-or-checks">{(Object.keys(IG_LABEL) as (keyof typeof IG_LABEL)[]).map((k) => <button key={k} type="button" aria-pressed={!!x[k]} className={k === 'no' ? 'is-no' : ''} onClick={() => void mark(it.handle, k)}>
          {x[k] && <Check size={14} aria-hidden="true"/>}{IG_LABEL[k]}</button>)}</div>
      </article>
    }) : <p className="ag-card ag-sec ag-or-muted">{kind === 'reviewers' && !items.length ? 'No reviewers yet. Paste some Instagram handles above.' : 'Nothing here.'}</p>}
  </div>
}

// ---------- emails ----------
function EmailsTab({ data, reload, openPreview }: Ctx) {
  const [key, setKey] = React.useState('email-1-pain.txt')
  // Unsaved edits are kept per template, so switching templates loses nothing.
  const [drafts, setDrafts] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const text = drafts[key] ?? data.templates[key] ?? ''
  const setText = (v: string) => setDrafts((d) => ({ ...d, [key]: v }))
  const dirty = text !== (data.templates[key] ?? '')

  async function save() {
    const content = text.replace(/\r\n/g, '\n')
    const problem = templateError(key, content)
    if (problem) return void toast.error(problem)
    setBusy(true)
    const { error } = await supabase.from('outreach_templates').upsert({ key, content, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    setBusy(false)
    if (error) return void toast.error(error.message)
    toast.success('Saved')
    await reload()
    setDrafts(({ [key]: _saved, ...rest }) => rest)
  }
  function previewReal() {
    if (dirty) return void toast.error('Save first, so the preview shows your changes.')
    const lead = board(data).rows.find((r) => !['do-not-contact', 'no-consent'].includes(r.status))
    if (!lead) return void toast.error('No leads to preview with')
    openPreview(lead.email, STEPS.findIndex((s) => s.file === key))
  }

  return <section className="ag-card ag-sec">
    <div className="ag-sec-head"><h2>Email templates</h2>
      <select className="ag-or-input" value={key} onChange={(e) => setKey(e.target.value)} aria-label="Template">
        {Object.entries(TEMPLATE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}{drafts[k] !== undefined && drafts[k] !== data.templates[k] ? ' (unsaved)' : ''}</option>)}</select></div>
    <p className="ag-or-muted">Fill-ins: {'{{Greeting}} {{ShopName}} {{ShopType}} {{Area}} {{BookingLink}} {{SignupLink}} {{SenderName}} {{Website}}'}. Line 1 is the subject. Follow-ups are sent in the same thread. Keep the “reply no” line: emails without it are not sent.</p>
    <textarea className="ag-or-input ag-or-editor" value={text} onChange={(e) => setText(e.target.value)} spellCheck aria-label="Template text"/>
    <div className="ag-or-row">
      <button type="button" className="ag-btn is-primary" disabled={busy || !dirty} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</button>
      {!key.endsWith('.json') && <button type="button" className="ag-btn" onClick={previewReal}>Preview with a real shop</button>}
    </div>
  </section>
}

// ---------- settings ----------
function SettingsTab({ data, reload }: Ctx) {
  const s = data.settings
  const [form, setForm] = React.useState<Settings>(s)
  const [busy, setBusy] = React.useState<null | 'save' | 'smtp' | 'test'>(null)
  React.useEffect(() => { setForm(data.settings) }, [data.settings])
  const lists = Object.keys(data.leadsByList).sort()
  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: Number(e.target.value) })
  const str = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value })
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number(v) || 0))

  async function save() {
    // Same limits the laptop dashboard applied.
    const minDelay = Math.max(30, Number(form.min_delay_seconds) || s.min_delay_seconds)
    const patch = {
      leads_list: form.leads_list, instagram_list: form.instagram_list,
      start_hour: clamp(form.start_hour, 0, 24), end_hour: clamp(form.end_hour, 0, 24), weekdays_only: form.weekdays_only,
      daily_limit: Math.max(1, Math.min(60, Number(form.daily_limit) || s.daily_limit)),
      min_delay_seconds: minDelay, max_delay_seconds: Math.max(minDelay, Number(form.max_delay_seconds) || s.max_delay_seconds),
      linkedin_daily_limit: clamp(form.linkedin_daily_limit, 0, 100), instagram_daily_limit: clamp(form.instagram_daily_limit, 0, 100),
      sender_name: form.sender_name.replace(/[\r\n"<>]/g, '').trim(), from_email: form.from_email.trim().toLowerCase(),
      booking_link: form.booking_link.trim(), signup_link: form.signup_link.trim(), website: form.website.trim(),
      updated_at: new Date().toISOString(),
    }
    if (patch.from_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.from_email)) return void toast.error('“Send from” is not an email address.')
    setBusy('save')
    const { error } = await supabase.from('outreach_settings').update(patch).eq('id', true)
    setBusy(null)
    if (error) return void toast.error(error.message)
    toast.success('Saved')
    await reload()
  }
  async function test(action: 'test-smtp' | 'test-email') {
    setBusy(action === 'test-smtp' ? 'smtp' : 'test')
    toast(action === 'test-smtp' ? 'Connecting…' : 'Sending…')
    try { const r = await invokeOutreach<{ message: string }>(action); toast.success(r.message) } catch (e) { toast.error(errMsg(e)) }
    setBusy(null)
  }

  const m = data.mail
  return <div className="ag-or-two">
    <section className="ag-card ag-sec">
      <div className="ag-sec-head"><h2>Email account</h2>{m && <span className={`ag-tag ${m.smtpReady ? 'is-ok' : 'is-warn'}`}>{m.smtpReady ? 'Ready' : 'Not set up'}</span>}</div>
      <label className="ag-or-field">Your name (shown as sender)<input className="ag-or-input" value={form.sender_name} onChange={str('sender_name')}/></label>
      <label className="ag-or-field">Send from (email)<input className="ag-or-input" type="email" value={form.from_email} onChange={str('from_email')}/></label>
      <dl className="ag-or-dl">
        <div><dt>Mail server</dt><dd>{m?.host || 'not set'}{m ? `:${m.port}` : ''}</dd></div>
        <div><dt>Login</dt><dd>{m?.user || 'not set'}</dd></div>
        <div><dt>Password</dt><dd>{m?.hasPass ? 'saved as a Supabase secret' : 'not set'}</dd></div>
      </dl>
      <p className="ag-or-muted">The mailbox login lives only in Supabase function secrets (<code>OUTREACH_SMTP_HOST</code>, <code>OUTREACH_SMTP_PORT</code>, <code>OUTREACH_SMTP_USER</code>, <code>OUTREACH_SMTP_PASS</code>), never in this page or the code. Port 465 only: Supabase blocks 587.</p>
      {m?.problem && <p className="ag-or-warn">{m.problem}</p>}
      <div className="ag-or-row">
        <button type="button" className="ag-btn" disabled={!!busy} onClick={() => void test('test-smtp')}>{busy === 'smtp' ? 'Connecting…' : 'Test connection'}</button>
        <button type="button" className="ag-btn" disabled={!!busy} onClick={() => void test('test-email')}>{busy === 'test' ? 'Sending…' : 'Email me a test'}</button>
      </div>
    </section>
    <section className="ag-card ag-sec">
      <div className="ag-sec-head"><h2>Sending</h2></div>
      <div className="ag-or-grid">
        <label className="ag-or-field">Leads list<select className="ag-or-input" value={form.leads_list} onChange={str('leads_list')}>{lists.map((l) => <option key={l}>{l}</option>)}{!lists.includes(form.leads_list) && <option>{form.leads_list}</option>}</select></label>
        <label className="ag-or-field">Instagram shops list<select className="ag-or-input" value={form.instagram_list} onChange={str('instagram_list')}>{lists.map((l) => <option key={l}>{l}</option>)}{!lists.includes(form.instagram_list) && <option>{form.instagram_list}</option>}</select></label>
        <label className="ag-or-field">Start sending at (London)<input className="ag-or-input" type="number" min={0} max={23} value={form.start_hour} onChange={num('start_hour')}/></label>
        <label className="ag-or-field">Stop sending at<input className="ag-or-input" type="number" min={1} max={24} value={form.end_hour} onChange={num('end_hour')}/></label>
        <label className="ag-or-field">Emails per day (max)<input className="ag-or-input" type="number" min={1} max={60} value={form.daily_limit} onChange={num('daily_limit')}/></label>
        <label className="ag-or-check"><input type="checkbox" checked={form.weekdays_only} onChange={(e) => setForm({ ...form, weekdays_only: e.target.checked })}/> Weekdays only</label>
        <label className="ag-or-field">Gap between emails (min seconds)<input className="ag-or-input" type="number" min={30} value={form.min_delay_seconds} onChange={num('min_delay_seconds')}/></label>
        <label className="ag-or-field">Gap between emails (max seconds)<input className="ag-or-input" type="number" min={30} value={form.max_delay_seconds} onChange={num('max_delay_seconds')}/></label>
        <label className="ag-or-field">LinkedIn requests per day<input className="ag-or-input" type="number" min={1} max={100} value={form.linkedin_daily_limit} onChange={num('linkedin_daily_limit')}/></label>
        <label className="ag-or-field">Instagram DMs per day<input className="ag-or-input" type="number" min={1} max={100} value={form.instagram_daily_limit} onChange={num('instagram_daily_limit')}/></label>
        <label className="ag-or-field ag-or-wide">Booking link<input className="ag-or-input" value={form.booking_link} onChange={str('booking_link')}/></label>
        <label className="ag-or-field ag-or-wide">Sign-up link<input className="ag-or-input" value={form.signup_link} onChange={str('signup_link')}/></label>
        <label className="ag-or-field ag-or-wide">Website<input className="ag-or-input" value={form.website} onChange={str('website')}/></label>
      </div>
      <p className="ag-or-muted">New mailboxes should stay around 20–30 a day so emails land in inboxes, not spam. Sending runs online every minute, so your laptop can be off. Keep the laptop bot switched off.</p>
      <button type="button" className="ag-btn is-primary" disabled={!!busy} onClick={() => void save()}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
    </section>
  </div>
}
