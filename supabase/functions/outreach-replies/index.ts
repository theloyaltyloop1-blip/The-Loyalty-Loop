// Outreach reply checker. Every 5 minutes (pg_cron) it reads the outreach
// mailbox over IMAP, read-only, and labels replies from leads with the AI the
// programme builder already uses (Groq). It never sends anything.
//
// Callers:
//   - pg_cron: header x-outreach-secret (Vault 'outreach_cron_secret'), body { action: "check" }.
//   - An admin with their JWT: { action: "check" } or { action: "dry-run", days? }.
//     The dry run reads the mailbox and returns what it WOULD label (shop, label,
//     reason). It writes nothing and returns no email text.
//
// Privacy: only messages FROM a lead's address, or bounce notices that name an
// address we emailed, are opened. Everything else is skipped by sender address
// alone and nothing about it is stored. The AI sees only the new text of that
// one reply.
//
// Secrets: OUTREACH_SMTP_USER / OUTREACH_SMTP_PASS (same mailbox login),
// GROQ_API_KEY. IMAP host defaults to the SMTP host with smtp. -> imap.
// (smtp.ionos.co.uk -> imap.ionos.co.uk), port 993; override with
// OUTREACH_IMAP_HOST / OUTREACH_IMAP_PORT.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { ImapFlow } from "npm:imapflow@1.0.171";
import PostalMime from "npm:postal-mime@2.4.3";
import { FAILED, SYSTEM_PROMPT, bouncedAddress, isBounceSender, replyText, snippet, verdictFrom, type Verdict } from "../_shared/outreach-replies-core.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const SMTP_HOST = (Deno.env.get("OUTREACH_SMTP_HOST") ?? "").trim();
const IMAP = {
  host: (Deno.env.get("OUTREACH_IMAP_HOST") ?? "").trim() || SMTP_HOST.replace(/^smtp\./i, "imap."),
  port: Number(Deno.env.get("OUTREACH_IMAP_PORT") || "993"),
  user: (Deno.env.get("OUTREACH_SMTP_USER") ?? "").trim(),
  pass: (Deno.env.get("OUTREACH_SMTP_PASS") ?? "").replace(/\s+/g, ""),
};
const FIRST_RUN_DAYS = 30; // with no saved position, look this far back
const MAX_PER_RUN = 40; // replies opened per run; the rest wait for the next run

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.the-loyalty-loop.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const errText = (e: unknown) => String((e as Error)?.message ?? e).slice(0, 300);

async function all<T>(q: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(from, from + 999);
    if (error) throw new Error(`Database read failed: ${(error as { message?: string }).message ?? error}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

async function classify(text: string): Promise<Verdict> {
  if (!GROQ_API_KEY) return { ...FAILED, reason: "AI not set up (GROQ_API_KEY missing)" };
  if (!text.trim()) return { ...FAILED, reason: "Reply had no readable text" };
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: `Reply:\n"""\n${text}\n"""` }],
        temperature: 0,
        max_tokens: 400,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) { console.error("groq", res.status); return FAILED; }
    const json = await res.json();
    return verdictFrom(String(json.choices?.[0]?.message?.content ?? ""));
  } catch (e) {
    console.error("groq", errText(e));
    return FAILED;
  }
}

type Found = { uid: number; email: string; shop: string; verdict: Verdict; text: string; received: string | null };

async function run(db: SupabaseClient, dryRun: boolean, lookBackDays?: number) {
  if (!IMAP.host || !IMAP.user || !IMAP.pass) throw new Error("Mailbox login not set up (OUTREACH_SMTP_* secrets).");
  const { data: s, error: sErr } = await db.from("outreach_settings")
    .select("imap_uidvalidity, imap_last_uid, checker_last_error").eq("id", true).single();
  if (sErr || !s) throw new Error("Outreach settings row missing.");

  // Who counts: every lead address, plus every address we have emailed.
  const known = new Map<string, string>();
  const leads = await all<{ all_emails: string[]; email: string; shop: string }>((a, b) =>
    db.from("outreach_leads").select("email, all_emails, shop").order("list").order("position").range(a, b));
  for (const l of leads) for (const e of [l.email, ...l.all_emails]) if (e && !known.has(e)) known.set(e, l.shop);
  const sends = await all<{ email: string; shop: string }>((a, b) => db.from("outreach_sends").select("email, shop").order("email").range(a, b));
  for (const x of sends) if (!known.has(x.email)) known.set(x.email, x.shop);
  const sentTo = new Set(sends.map((x) => x.email));
  for (const k of known.keys()) sentTo.add(k);

  const client = new ImapFlow({
    host: IMAP.host, port: IMAP.port, secure: true, auth: { user: IMAP.user, pass: IMAP.pass },
    logger: false, socketTimeout: 60_000, greetingTimeout: 20_000, connectionTimeout: 20_000,
  });
  const found: Found[] = [];
  let uidValidity = 0, highestSeen = 0, skipped = 0;
  await client.connect();
  try {
    const box = await client.mailboxOpen("INBOX", { readOnly: true });
    uidValidity = Number(box.uidValidity);
    const continuing = !lookBackDays && s.imap_uidvalidity === uidValidity && s.imap_last_uid != null;
    const lastUid = continuing ? Number(s.imap_last_uid) : 0;
    let uids: number[];
    if (continuing) {
      uids = ((await client.search({ uid: `${lastUid + 1}:*` }, { uid: true })) || []).filter((u: number) => u > lastUid);
    } else {
      const since = new Date(Date.now() - (lookBackDays ?? FIRST_RUN_DAYS) * 86_400_000);
      uids = (await client.search({ since }, { uid: true })) || [];
    }
    uids.sort((a, b) => a - b);
    highestSeen = lastUid;

    // Pass 1: sender addresses only. Nothing about non-matching mail is kept.
    const wanted: { uid: number; from: string; bounce: boolean }[] = [];
    if (uids.length) {
      for await (const m of client.fetch(uids.join(","), { uid: true, envelope: true }, { uid: true })) {
        const from = String(m.envelope?.from?.[0]?.address ?? "").toLowerCase();
        if (known.has(from)) wanted.push({ uid: m.uid, from, bounce: false });
        else if (isBounceSender(from)) wanted.push({ uid: m.uid, from, bounce: true });
      }
    }
    wanted.sort((a, b) => a.uid - b.uid);
    const take = wanted.slice(0, MAX_PER_RUN);
    // Advance past everything checked, but not past a reply left for the next run.
    const cutoff = wanted.length > MAX_PER_RUN ? wanted[MAX_PER_RUN].uid - 1 : (uids.at(-1) ?? lastUid);
    highestSeen = Math.max(lastUid, cutoff);

    // Pass 2: open only the matching messages.
    for (const w of take) {
      const msg = await client.fetchOne(String(w.uid), { source: true, internalDate: true }, { uid: true });
      if (!msg || !msg.source) continue;
      const parsed = await PostalMime.parse(msg.source);
      const body = parsed.text || String(parsed.html ?? "").replace(/<[^>]+>/g, " ");
      const received = msg.internalDate ? new Date(msg.internalDate).toISOString() : null;
      if (w.bounce) {
        const addr = bouncedAddress(body, sentTo);
        if (!addr) { skipped++; continue; } // a bounce about someone else: ignore, store nothing
        found.push({ uid: w.uid, email: addr, shop: known.get(addr) ?? "", received, text: "",
          verdict: { label: "Bounced", reason: "Delivery failed: the mail server returned the email", confidence: 1, holdUntil: null } });
      } else {
        const text = replyText(body);
        found.push({ uid: w.uid, email: w.from, shop: known.get(w.from) ?? "", received, text, verdict: await classify(text) });
      }
    }
  } finally {
    await client.logout().catch(() => {});
  }

  if (!dryRun) {
    for (const f of found) {
      // Already handled in an earlier run (the position is only saved at the end).
      const { data: seen } = await db.from("outreach_replies").select("id")
        .eq("uidvalidity", uidValidity).eq("uid", f.uid).eq("email", f.email).limit(1);
      if (seen?.length) continue;
      const { error: aErr } = await db.rpc("outreach_apply_reply", {
        _email: f.email, _label: f.verdict.label, _reason: f.verdict.reason, _snippet: snippet(f.text), _by: "ai", _hold_until: f.verdict.holdUntil,
      });
      if (aErr) throw new Error(`Could not apply a label: ${aErr.message}`);
      const { error } = await db.from("outreach_replies").insert({
        uidvalidity: uidValidity, uid: f.uid, email: f.email, label: f.verdict.label, reason: f.verdict.reason,
        confidence: f.verdict.confidence, snippet: snippet(f.text), received_at: f.received,
      });
      if (error && error.code !== "23505") throw new Error(`Could not record a reply: ${error.message}`);
    }
    await db.from("outreach_settings").update({
      imap_uidvalidity: uidValidity, imap_last_uid: highestSeen, checker_last_ok: new Date().toISOString(), checker_last_error: null,
    }).eq("id", true);
  }
  return {
    dryRun,
    checkedUpTo: highestSeen,
    replies: found.map((f) => ({ shop: f.shop || "(unknown shop)", label: f.verdict.label, reason: f.verdict.reason, holdUntil: f.verdict.holdUntil })),
    ignoredBounces: skipped,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST" || !SERVICE_ROLE_KEY) return reply({ error: "forbidden" }, 403);
  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let caller: "cron" | "admin" | null = null;
  const cronSecret = req.headers.get("x-outreach-secret") ?? "";
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (cronSecret) {
    const { data } = await db.rpc("outreach_cron_secret_ok", { _secret: cronSecret });
    if (data === true) caller = "cron";
  } else if (token) {
    const { data: u } = await db.auth.getUser(token);
    if (u?.user) {
      const { data: isAdmin } = await db.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
      if (isAdmin === true) caller = "admin";
    }
  }
  if (!caller) return reply({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({})) as { action?: string; days?: number };
  const action = body.action ?? "check";
  if (action !== "check" && action !== "dry-run") return reply({ error: "unknown action" }, 400);
  if (caller === "cron" && action !== "check") return reply({ error: "forbidden" }, 403);

  if (action === "dry-run") {
    try {
      const days = Number.isFinite(body.days) ? Math.max(1, Math.min(90, Number(body.days))) : undefined;
      return reply(await run(db, true, days));
    } catch (e) {
      return reply({ error: errText(e) }, 400);
    }
  }

  const { data: claimed } = await db.rpc("outreach_claim_checker_lock", { _seconds: 240 });
  if (claimed !== true) return reply({ skipped: "already checking" });
  await db.from("outreach_settings").update({ checker_last_run: new Date().toISOString() }).eq("id", true);
  try {
    return reply(await run(db, false));
  } catch (e) {
    // A checker failure never touches the sender or any lead; it is shown on the Overview.
    const message = errText(e);
    const { data: s } = await db.from("outreach_settings").select("checker_last_error").eq("id", true).single();
    await db.from("outreach_settings").update({ checker_last_error: message }).eq("id", true);
    if (s?.checker_last_error !== message) await db.from("outreach_log").insert({ type: "checker-error", text: `Reply check failed: ${message}` });
    return reply({ error: message }, 500);
  } finally {
    await db.rpc("outreach_release_checker_lock");
  }
});
