// Outreach sender: the online version of the local bot's auto-send loop
// (marketing/outreach-bot/server.mjs tick() + sendNext(), lib.mjs sendStep()).
//
// Callers:
//   - pg_cron every minute while auto-send is on: header x-outreach-secret
//     (Vault secret 'outreach_cron_secret'), body { action: "tick" }.
//   - An admin from the website (/access?view=outreach), with their JWT:
//       { action: "status" }                    mailbox set up? dry run forced?
//       { action: "send-next", dry_run? }       "Send next email now"
//       { action: "dry-run" }                   what would go next, nothing sent
//       { action: "tick", dry_run? }            run the scheduled check by hand
//       { action: "test-smtp" }                 log in to the mailbox only
//       { action: "test-email" }                email 1 with a sample shop, to yourself
//
// Secrets (Supabase function secrets, never in a file):
//   OUTREACH_SMTP_HOST, OUTREACH_SMTP_PORT (465), OUTREACH_SMTP_USER, OUTREACH_SMTP_PASS
//   OUTREACH_DRY_RUN=true  -> every path logs what it would send and sends nothing.
// Supabase blocks outgoing ports 25 and 587, so only 465 (TLS from the start) works.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";
import {
  STEPS, buildBoard, dueStep, hasOptOutLine, listUnsubscribe, problems, render, sentToday, windowOpen,
  type Lead, type LeadEntry, type Links, type StateMap,
} from "../_shared/outreach-core.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SMTP = {
  host: (Deno.env.get("OUTREACH_SMTP_HOST") ?? "").trim(),
  port: Number(Deno.env.get("OUTREACH_SMTP_PORT") || "465"),
  user: (Deno.env.get("OUTREACH_SMTP_USER") ?? "").trim(),
  pass: (Deno.env.get("OUTREACH_SMTP_PASS") ?? "").replace(/\s+/g, ""), // Google shows app passwords with spaces
};
const FORCED_DRY_RUN = /^(1|true|yes)$/i.test(Deno.env.get("OUTREACH_DRY_RUN") ?? "");

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.the-loyalty-loop.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Settings = {
  auto_send: boolean; leads_list: string; start_hour: number; end_hour: number; weekdays_only: boolean;
  daily_limit: number; min_delay_seconds: number; max_delay_seconds: number; followup_gap_days: number[];
  sender_name: string; from_email: string; booking_link: string; signup_link: string; website: string;
  next_send_at: string | null; consecutive_failures: number; last_error: string | null;
};

type Result = {
  sent?: boolean; dryRun?: boolean; skipped?: string; error?: string;
  to?: string; email?: string; step?: string; subject?: string; text?: string;
};

const encoder = new TextEncoder();
function sameSecret(expected: string, received: string) {
  const a = encoder.encode(expected), b = encoder.encode(received);
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

function smtpProblem(fromEmail: string): string | null {
  if (!SMTP.host || !SMTP.user || !SMTP.pass) return "Email account not set up yet (OUTREACH_SMTP_* secrets missing).";
  if (SMTP.port === 25 || SMTP.port === 587) return `Port ${SMTP.port} is blocked on Supabase. Use port 465.`;
  if (!fromEmail || /^you@/.test(fromEmail)) return "Set the 'Send from' email in Settings.";
  return null;
}

function makeTransport() {
  return nodemailer.createTransport({
    host: SMTP.host,
    port: SMTP.port,
    secure: SMTP.port === 465,
    auth: { user: SMTP.user, pass: SMTP.pass },
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
  });
}

const links = (s: Settings): Links => ({
  bookingLink: s.booking_link, signupLink: s.signup_link, website: s.website, senderName: s.sender_name,
});

// ---------- loading ----------
async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(from, from + 999);
    if (error) throw new Error(`Database read failed: ${(error as { message?: string }).message ?? error}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

type LeadRow = {
  email: string; all_emails: string[]; shop: string; first_name: string; shop_type: string; area: string;
  linkedin_url: string; instagram_handle: string; legal_entity: string; company_number: string; email_ok: boolean;
};
const toLead = (r: LeadRow): Lead => ({
  email: r.email, allEmails: r.all_emails, shop: r.shop, firstName: r.first_name, shopType: r.shop_type, area: r.area,
  linkedin: r.linkedin_url, instagram: r.instagram_handle, legalEntity: r.legal_entity, companyNumber: r.company_number,
  emailOk: r.email_ok,
});

async function loadSettings(db: SupabaseClient): Promise<Settings> {
  const { data, error } = await db.from("outreach_settings").select("*").eq("id", true).single();
  if (error || !data) throw new Error("Outreach settings row missing.");
  return data as Settings;
}

async function loadState(db: SupabaseClient, onlyEmail?: string): Promise<StateMap> {
  const state: StateMap = {};
  const entry = (email: string): LeadEntry => (state[email] ??= { shop: "", steps: [], stopped: null });
  const stops = await all<{ email: string; shop: string; stopped_reason: string | null; stopped_at: string | null; hold_until: string | null }>((a, b) => {
    let q = db.from("outreach_lead_state").select("email, shop, stopped_reason, stopped_at, hold_until");
    if (onlyEmail) q = q.eq("email", onlyEmail);
    return q.order("email").range(a, b);
  });
  for (const s of stops) {
    const e = entry(s.email);
    e.shop = s.shop;
    e.stopped = s.stopped_reason ? { reason: s.stopped_reason, at: s.stopped_at ?? "" } : null;
    e.holdUntil = s.hold_until;
  }
  const sends = await all<{ email: string; step: number; step_key: string; sent_at: string; message_id: string | null }>((a, b) => {
    let q = db.from("outreach_sends").select("email, step, step_key, sent_at, message_id");
    if (onlyEmail) q = q.eq("email", onlyEmail);
    return q.order("sent_at").order("step").range(a, b);
  });
  for (const s of sends) entry(s.email).steps.push({ step: s.step, stepKey: s.step_key, sentAt: s.sent_at, messageId: s.message_id });
  return state;
}

async function emailSet(db: SupabaseClient, table: "outreach_do_not_contact" | "outreach_excluded") {
  const rows = await all<{ email: string }>((a, b) => db.from(table).select("email").order("email").range(a, b));
  return new Set(rows.map((r) => r.email));
}

async function loadTemplates(db: SupabaseClient) {
  const { data, error } = await db.from("outreach_templates").select("key, content");
  if (error) throw new Error("Could not read the email templates.");
  return Object.fromEntries((data ?? []).map((t) => [t.key, t.content])) as Record<string, string>;
}

async function log(db: SupabaseClient, type: string, text: string) {
  await db.from("outreach_log").insert({ type, text });
}

// ---------- sending ----------

// lib.mjs sendStep(): re-checks blocks right before sending, refuses bad
// templates, sends in the same thread as email 1, records it.
async function sendStep(db: SupabaseClient, s: Settings, lead: Lead, step: number, dryRun: boolean): Promise<Result> {
  const blocked = await emailSet(db, "outreach_do_not_contact");
  const state = await loadState(db, lead.email);
  if (blocked.has(lead.email) || state[lead.email]?.stopped) return { skipped: "stopped" };
  if (dueStep(state[lead.email], s.followup_gap_days) !== step) return { skipped: "no longer due" };

  const templates = await loadTemplates(db);
  const file = STEPS[step].file;
  if (!templates[file]) throw new Error(`${file}: template missing`);
  const msg = render(templates[file], lead, links(s));
  const bad = problems(msg);
  if (!hasOptOutLine(msg.text)) bad.push('no "reply no" opt-out line');
  if (bad.length) throw new Error(`${file}: ${bad.join("; ")}`);

  const first = state[lead.email]?.steps.find((x) => x.step === 0)?.messageId ?? state[lead.email]?.steps[0]?.messageId;
  const mail = {
    from: `"${s.sender_name}" <${s.from_email}>`,
    to: lead.email,
    subject: msg.subject,
    text: msg.text,
    ...(first ? { inReplyTo: first, references: [first] } : {}),
    headers: { "List-Unsubscribe": listUnsubscribe(s.from_email) },
  };
  const base = { to: lead.shop, email: lead.email, step: STEPS[step].label, subject: msg.subject, text: msg.text };

  if (dryRun) {
    console.log(`[dry run] would send ${STEPS[step].key} to ${lead.email}${first ? " (same thread)" : ""}`);
    await log(db, "dry-run", `Dry run, not sent: ${STEPS[step].label} → ${lead.shop} (${lead.email})${first ? ", same thread" : ""}`);
    return { dryRun: true, ...base };
  }

  let info: { messageId?: string };
  try {
    info = await makeTransport().sendMail(mail);
  } catch (e) {
    // The mail server refused this one address for good (550 "mailbox
    // unavailable", "invalid DNS MX"...). That is a dead lead, not a fault in
    // our mailbox: mark it Bounced, skip it, and don't count it as a failure.
    if (!isDeadAddress(e)) throw e;
    const reason = String((e as { response?: string })?.response ?? (e as Error)?.message ?? e).slice(0, 300);
    const { error } = await db.rpc("outreach_apply_reply", {
      _email: lead.email, _label: "Bounced", _reason: `Rejected when sending: ${reason}`, _snippet: null, _by: "ai", _hold_until: null, // "ai" = set automatically (the column allows only ai/owner)
    });
    if (error) throw new Error(`Address rejected, and marking it Bounced failed: ${error.message}`);
    await log(db, "bounced", `${STEPS[step].label} → ${lead.shop} (${lead.email}) rejected by their mail server. Marked Bounced, moving on.`);
    return { skipped: "address rejected, marked Bounced", ...base };
  }
  const { error } = await db.from("outreach_sends").insert({
    email: lead.email, step, step_key: STEPS[step].key, shop: lead.shop, subject: msg.subject, message_id: info.messageId ?? null,
  });
  // The email has gone. If recording it fails, stop auto-send so it can't be sent again.
  if (error) {
    await db.from("outreach_settings").update({ auto_send: false }).eq("id", true);
    await log(db, "paused", `Sent to ${lead.email} but could not record it (${error.message}). Auto-send switched off.`);
    throw new Error(`Sent, but recording failed: ${error.message}`);
  }
  await db.from("outreach_lead_state").upsert({ email: lead.email, shop: lead.shop }, { onConflict: "email", ignoreDuplicates: true });
  await log(db, "sent", `${STEPS[step].label} → ${lead.shop} (${lead.email})`);
  return { sent: true, ...base };
}

// A permanent refusal of the recipient address itself. Nodemailer reports
// these as EENVELOPE with a 5xx code; login, connection and 4xx (try later)
// errors are different and still count towards the 3-in-a-row pause.
export function isDeadAddress(e: unknown): boolean {
  const err = e as { code?: string; responseCode?: number; rejected?: unknown[] };
  return err?.code === "EENVELOPE" && typeof err.responseCode === "number" && err.responseCode >= 500 && err.responseCode < 600
    && Array.isArray(err.rejected) && err.rejected.length > 0;
}

// server.mjs sendNext(): daily limit, next in the queue (follow-ups first),
// failure counting and the 3-in-a-row auto-off.
async function sendNext(db: SupabaseClient, dryRun: boolean): Promise<Result> {
  const { data: claimed } = await db.rpc("outreach_claim_send_lock", { _seconds: 120 });
  if (claimed !== true) return { skipped: "already sending" };
  let lead: Lead | null = null;
  try {
    const s = await loadSettings(db);
    const state = await loadState(db);
    if (sentToday(state) >= s.daily_limit) return { skipped: `daily limit of ${s.daily_limit} reached` };
    const leads = (await all<LeadRow>((a, b) =>
      db.from("outreach_leads").select("email, all_emails, shop, first_name, shop_type, area, linkedin_url, instagram_handle, legal_entity, company_number, email_ok")
        .eq("list", s.leads_list).order("position").range(a, b))).map(toLead);
    if (!leads.length) return { skipped: `the leads list "${s.leads_list}" is empty` };
    const { queue } = buildBoard(leads, state, await emailSet(db, "outreach_do_not_contact"),
      await emailSet(db, "outreach_excluded"), s.followup_gap_days);
    if (!queue.length) return { skipped: "nobody is due an email right now" };
    lead = queue[0].lead;
    const problem = dryRun ? null : smtpProblem(s.from_email);
    if (problem) throw new Error(problem);
    const r = await sendStep(db, s, lead, queue[0].step, dryRun);
    if (r.sent) await db.from("outreach_settings").update({ consecutive_failures: 0, last_error: null }).eq("id", true);
    return r;
  } catch (e) {
    const message = String((e as Error)?.message ?? e).slice(0, 500);
    if (dryRun) return { error: message };
    const s = await loadSettings(db);
    const failures = s.consecutive_failures + 1;
    const pause = failures >= 3 && s.auto_send;
    await db.from("outreach_settings").update({
      consecutive_failures: failures, last_error: message, ...(pause ? { auto_send: false } : {}),
    }).eq("id", true);
    await log(db, "error", `Sending${lead ? ` to ${lead.email}` : ""} failed: ${message}`);
    if (pause) await log(db, "paused", "Auto-send switched off after 3 failures in a row. Check Settings → Email account.");
    return { error: message };
  } finally {
    await db.rpc("outreach_release_send_lock");
  }
}

// server.mjs tick(): only inside sending hours, only when the random gap since
// the last send has passed. 10 minutes after a failure.
async function tick(db: SupabaseClient, dryRun: boolean): Promise<Result> {
  const s = await loadSettings(db);
  if (!s.auto_send) return { skipped: "auto-send is off" };
  if (!dryRun && smtpProblem(s.from_email)) return { skipped: "email account not set up" };
  if (!windowOpen({ startHour: s.start_hour, endHour: s.end_hour, weekdaysOnly: s.weekdays_only })) return { skipped: "outside sending hours" };
  if (s.next_send_at && Date.now() < Date.parse(s.next_send_at)) return { skipped: "waiting for the gap between emails" };
  const r = await sendNext(db, dryRun);
  if (r.sent || r.error || r.dryRun) {
    const gap = r.error ? 10 * 60 : s.min_delay_seconds + Math.random() * (s.max_delay_seconds - s.min_delay_seconds);
    await db.from("outreach_settings").update({ next_send_at: new Date(Date.now() + gap * 1000).toISOString() }).eq("id", true);
  }
  return r;
}

// ---------- entry ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST" || !SERVICE_ROLE_KEY) return reply({ error: "forbidden" }, 403);
  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // Who is calling: the scheduler (Vault secret), the service role, or an admin.
  let caller: "cron" | "admin" | null = null;
  const cronSecret = req.headers.get("x-outreach-secret") ?? "";
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (cronSecret) {
    const { data } = await db.rpc("outreach_cron_secret_ok", { _secret: cronSecret });
    if (data === true) caller = "cron";
  } else if (token && sameSecret(SERVICE_ROLE_KEY, token)) {
    caller = "cron";
  } else if (token) {
    const { data: u } = await db.auth.getUser(token);
    if (u?.user) {
      const { data: isAdmin } = await db.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
      if (isAdmin === true) caller = "admin";
    }
  }
  if (!caller) return reply({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({})) as { action?: string; dry_run?: boolean };
  const action = body.action ?? "tick";
  const dryRun = FORCED_DRY_RUN || body.dry_run === true || action === "dry-run";
  if (caller === "cron" && action !== "tick") return reply({ error: "forbidden" }, 403);

  try {
    if (action === "tick") return reply({ dryRun, ...(await tick(db, dryRun)) });
    if (action === "send-next" || action === "dry-run") return reply({ dryRun, ...(await sendNext(db, dryRun)) });

    const s = await loadSettings(db);
    if (action === "status") {
      return reply({
        smtpReady: !smtpProblem(s.from_email), problem: smtpProblem(s.from_email),
        host: SMTP.host, port: SMTP.port, user: SMTP.user, hasPass: Boolean(SMTP.pass), dryRunForced: FORCED_DRY_RUN,
      });
    }
    if (action === "test-smtp" || action === "test-email") {
      const problem = smtpProblem(s.from_email);
      if (problem) return reply({ error: problem }, 400);
      const tx = makeTransport();
      await tx.verify();
      if (action === "test-smtp") return reply({ ok: true, message: `Connected to ${SMTP.host} as ${SMTP.user}` });
      const templates = await loadTemplates(db);
      const sample = { shop: "Sample Café", shopType: "café", area: "Wimbledon", firstName: "" };
      const msg = render(templates[STEPS[0].file] ?? "Subject: (template missing)\n", sample, links(s));
      await tx.sendMail({ from: `"${s.sender_name}" <${s.from_email}>`, to: s.from_email, subject: `[TEST] ${msg.subject}`, text: msg.text });
      return reply({ ok: true, message: `Test email sent to yourself (${s.from_email})` });
    }
    return reply({ error: "unknown action" }, 400);
  } catch (e) {
    return reply({ error: String((e as Error)?.message ?? e).slice(0, 500) }, 400);
  }
});
