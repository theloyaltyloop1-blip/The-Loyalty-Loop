import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import QRCode from "npm:qrcode@1.5.4";

// Win-back emails: a one-use COMEBACK coupon for members who have gone quiet.
//
// Two ways in:
//  1. "Send now" (owner or admin, JWT): body { business_id, days_inactive_threshold? }.
//     The caller must own business_id (checked here, not implied by the JWT).
//     Emails everyone quiet past the threshold who was not emailed in the last
//     30 days, up to MANUAL_CAP per press. Counts only, nothing sent:
//     { preview_for: business_id, days_inactive_threshold? } (or dry_run: true).
//  2. The daily job (pg_cron, header x-winback-secret = Vault 'winback_cron_secret'):
//     body { mode: "scheduled", dry_run? }. Only acts while it is 10 o'clock in
//     London (dry_run works any time). For every active shop with
//     winback_auto_enabled it claims today's winback_auto_runs row, then emails
//     members who went quiet in the last 30 days past the shop's threshold, have
//     not had a win-back since their last visit or in the last 30 days, up to
//     AUTO_CAP per shop per day.
//
// Both: promo opt-outs are never emailed; a row is logged 'sent' only when Resend
// accepted it, so a failure never locks a customer out. Coupons are redeemed once
// at the till via redeem_winback_coupon (30-day expiry from winback_email_log).

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
// Must be on a domain verified in Resend (the-loyalty-loop.com). Never fall back
// to onboarding@resend.dev: Resend only delivers that to the account owner, so
// real customers would get nothing.
const RESEND_FROM_EMAIL = [Deno.env.get("WINBACK_FROM_EMAIL"), Deno.env.get("RESEND_FROM_EMAIL")]
  .find((v) => v && !v.includes("resend.dev")) ?? "The Loyalty Loop <hello@the-loyalty-loop.com>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const AUTO_CAP = 50; // per shop per day
const MANUAL_CAP = 100; // per "Send now" press
const AUTO_HOUR_LONDON = 10;
const TIME_BUDGET_MS = 100_000; // stop starting new shops after this; the next 15-minute call carries on

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.the-loyalty-loop.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: jsonHeaders });

// No 0/O/1/I so codes read back cleanly at the till.
const COUPON_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genCoupon() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return "COMEBACK" + Array.from(bytes, (b) => COUPON_ALPHABET[b % COUPON_ALPHABET.length]).join("");
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

const SAFE_COLOR = /^#[0-9a-f]{3,8}$/i;

function clampThreshold(value: unknown, fallback: number) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 365) : fallback;
}

/** London calendar date (YYYY-MM-DD) and hour (0-23). */
function londonNow(d = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(d).map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

type Shop = { id: string; name: string; brand_color: string | null };
type Candidate = { user_id: string; email: string; first_name: string | null; days_inactive: number; recently_emailed: boolean };

async function candidates(admin: SupabaseClient, businessId: string, threshold: number, automatic: boolean) {
  const { data, error } = await admin.rpc("winback_candidates", {
    _business_id: businessId,
    _threshold_days: threshold,
    _automatic: automatic,
  });
  if (error) throw error;
  const all = (data ?? []) as Candidate[];
  const due = all.filter((c) => !c.recently_emailed);
  return { eligible: all.length, skipped: all.length - due.length, due };
}

type SendDetail = { qrSent: boolean; qrError: string | null; error: string | null };

/** One plain address only: no lists, no whitespace or control characters (so no header injection). */
const PLAIN_EMAIL = /^[A-Za-z0-9._%+'-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
function validTestAddress(v: unknown): v is string {
  return typeof v === "string" && v.length <= 254 && PLAIN_EMAIL.test(v);
}

/**
 * Sends one email and logs it. Returns true only when Resend accepted it.
 * test = true (owner "test_to" send): subject gets "[TEST]", nothing is written to
 * winback_email_log, so the sample code is not redeemable. `detail` reports QR/send status.
 */
async function sendOne(admin: SupabaseClient, shop: Shop, c: Candidate, test = false, detail?: SendDetail): Promise<boolean> {
  const coupon = genCoupon();
  const subject = `${test ? "[TEST] " : ""}We miss you at ${shop.name}!`;
  const greeting = c.first_name ? `Hi ${esc(c.first_name)},` : "Hi there,";
  const name = esc(shop.name);
  const color = SAFE_COLOR.test(shop.brand_color ?? "") ? shop.brand_color : "#222";
  // Shown as "COMEBACK KP28AWKZ" (display only). The stored/redeemed code has no space;
  // the Business app strips whitespace before redeeming, so typing it either way works.
  const font = "'Helvetica Neue',Helvetica,Arial,sans-serif";
  // QR of the coupon, sent as an inline (CID) attachment so no third party ever sees the code.
  // Payload matches apps/retailer/src/winback-qr.ts and apps/shopper/src/winback-qr.ts.
  let qrBase64: string | null = null;
  try {
    const png: Uint8Array = await QRCode.toBuffer(`loyaltyloop:winback:${coupon}`, { type: "png", margin: 2, width: 280, errorCorrectionLevel: "M" });
    qrBase64 = btoa(String.fromCharCode(...png));
  } catch (e) {
    console.error("winback qr failed", e instanceof Error ? e.message : e);
    if (detail) detail.qrError = e instanceof Error ? e.message.slice(0, 200) : "qr failed";
  }
  const qrBlock = qrBase64
    ? `<tr><td align="center" style="padding:0 28px 8px 28px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#FFFFFF" style="background-color:#FFFFFF;border:1px solid #E2D1B8;border-radius:12px;padding:10px;line-height:0;font-size:0;"><img src="cid:coupon-qr" alt="QR code for ${coupon}" width="160" height="160" style="display:block;width:160px;height:160px;border:0;"></td></tr></table><p class="em-muted" style="margin:10px 0 0 0;font-family:${font};font-size:13px;color:#555555;">Or let the shop scan this.</p></td></tr>`
    : "";
  const codeShown = coupon.replace(/^COMEBACK/, "COMEBACK ");
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>We miss you at ${name}!</title>
<style>
:root{color-scheme:light dark;supported-color-schemes:light dark}
@media (prefers-color-scheme: dark){
  .em-bg{background-color:#1E2118 !important}
  .em-card{background-color:#2A2E22 !important;border-color:#454B38 !important}
  .em-text{color:#EDE6D8 !important}
  .em-muted{color:#B5AD9C !important}
  .em-coupon{background-color:#3A3F2C !important;border-color:#A9BF86 !important}
  .em-code{color:#F6EBD3 !important}
}
@media only screen and (max-width:420px){.em-code{font-size:19px !important;letter-spacing:1px !important}}
</style></head>
<body class="em-bg" bgcolor="#F4EEE2" style="margin:0;padding:0;background-color:#F4EEE2;">
<table role="presentation" class="em-bg" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F4EEE2" style="background-color:#F4EEE2;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" class="em-card" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="max-width:480px;background-color:#FFFFFF;border:1px solid #E2D1B8;border-radius:16px;overflow:hidden;">
  <tr><td align="center" bgcolor="#4F6438" style="background-color:#4F6438;padding:24px 20px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#F8E4C6" style="background-color:#F8E4C6;border-radius:12px;overflow:hidden;line-height:0;font-size:0;"><img src="https://www.the-loyalty-loop.com/logo-for-emails" alt="The Loyalty Loop" width="180" style="display:block;width:180px;max-width:100%;height:auto;border:0;border-radius:12px;"></td></tr></table>
  </td></tr>
  <tr><td style="padding:28px 28px 8px 28px;font-family:${font};">
    <h2 class="em-text" style="margin:0 0 14px 0;font-size:22px;line-height:1.3;color:${color};">${greeting}</h2>
    <p class="em-text" style="margin:0;font-size:16px;line-height:1.6;color:#333333;">It's been a while since your last visit to <strong>${name}</strong>. Come back and show this code at the till for a little something extra on us:</p>
  </td></tr>
  <tr><td align="center" style="padding:20px 28px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:100%;"><tr><td class="em-coupon" align="center" bgcolor="#F8EAD0" style="background-color:#F8EAD0;border:2px dashed #4F6438;border-radius:12px;padding:16px 22px;">
      <span class="em-code" style="font-family:'SFMono-Regular',Menlo,Consolas,'Courier New',monospace;font-size:22px;font-weight:bold;letter-spacing:2px;color:#2F3D22;white-space:nowrap;">${codeShown}</span>
    </td></tr></table>
  </td></tr>
  ${qrBlock}
  <tr><td style="padding:12px 28px 24px 28px;font-family:${font};">
    <p class="em-muted" style="margin:0;font-size:13px;text-align:center;color:#555555;">One use only, valid for 30 days.</p>
  </td></tr>
  <tr><td style="padding:0 28px 28px 28px;font-family:${font};border-top:1px solid #F0E4D2;">
    <p class="em-muted" style="margin:18px 0 0 0;font-size:13px;line-height:1.5;color:#777777;">You're receiving this because you're a member of ${name}'s loyalty card on The Loyalty Loop. You can opt out of promotional emails any time from the shop page.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  let ok = false;
  let errText: string | null = null;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL, to: [c.email], subject, html,
        ...(qrBase64 ? { attachments: [{ filename: "coupon-qr.png", content: qrBase64, content_type: "image/png", content_id: "coupon-qr" }] } : {}),
      }),
    });
    ok = res.ok;
    errText = ok ? null : (await res.text()).slice(0, 500);
  } catch {
    errText = "send failed";
  }

  if (detail) {
    detail.qrSent = ok && qrBase64 !== null;
    detail.error = errText;
  }
  if (test) return ok; // test sends are never logged and never create a coupon row

  const { error: logErr } = await admin.from("winback_email_log").insert({
    business_id: shop.id,
    user_id: c.user_id,
    recipient_email: c.email,
    days_inactive: c.days_inactive,
    coupon_code: coupon,
    subject,
    body_preview: `${greeting} It's been a while since your last visit to ${shop.name}. Code: ${coupon}`.slice(0, 300),
    status: ok ? "sent" : "failed",
    error: errText,
  });
  if (logErr) console.error("winback log insert failed", shop.id, logErr.message);
  return ok;
}

// ---------- daily job ----------
async function scheduled(admin: SupabaseClient, dryRun: boolean) {
  const now = londonNow();
  if (!dryRun && now.hour !== AUTO_HOUR_LONDON) {
    return { ran: false, reason: `only runs at ${AUTO_HOUR_LONDON}:00 London time`, london: now };
  }
  if (!dryRun && !RESEND_API_KEY) return { ran: false, reason: "RESEND_API_KEY not set" };

  const { data: shops, error } = await admin
    .from("businesses")
    .select("id, name, brand_color, winback_threshold_days")
    .eq("winback_auto_enabled", true)
    .eq("is_active", true)
    .eq("approval_status", "approved")
    .order("created_at");
  if (error) throw error;

  const started = Date.now();
  const report: Array<Record<string, unknown>> = [];
  let unfinished = 0;

  for (const shop of shops ?? []) {
    const threshold = clampThreshold(shop.winback_threshold_days, 30);

    if (dryRun) {
      const { eligible, skipped, due } = await candidates(admin, shop.id, threshold, true);
      report.push({
        business_id: shop.id,
        name: shop.name,
        threshold_days: threshold,
        quiet_in_window: eligible,
        already_emailed: skipped,
        would_send: Math.min(due.length, AUTO_CAP),
        waiting_for_later_days: Math.max(0, due.length - AUTO_CAP),
      });
      continue;
    }

    if (Date.now() - started > TIME_BUDGET_MS) {
      unfinished++;
      continue;
    }

    // Claim today's run for this shop; another call that got here first wins.
    const { data: claim, error: claimErr } = await admin
      .from("winback_auto_runs")
      .upsert({ business_id: shop.id, run_on: now.date, threshold_days: threshold }, {
        onConflict: "business_id,run_on",
        ignoreDuplicates: true,
      })
      .select("business_id");
    if (claimErr) {
      console.error("winback claim failed", shop.id, claimErr.message);
      continue;
    }
    if (!claim || claim.length === 0) continue; // already handled today

    let sent = 0, failed = 0, eligible = 0, waiting = 0;
    try {
      const found = await candidates(admin, shop.id, threshold, true);
      eligible = found.eligible;
      const batch = found.due.slice(0, AUTO_CAP);
      waiting = found.due.length - batch.length;
      for (const c of batch) {
        if (await sendOne(admin, shop, c)) sent++;
        else failed++;
      }
    } catch (e) {
      console.error("winback shop run failed", shop.id, String(e));
    }
    await admin
      .from("winback_auto_runs")
      .update({ eligible, sent, failed, waiting, finished_at: new Date().toISOString() })
      .eq("business_id", shop.id)
      .eq("run_on", now.date);
    report.push({ business_id: shop.id, sent, failed, waiting });
  }

  return { ran: true, dry_run: dryRun, london_date: now.date, shops: report, unfinished };
}

// ---------- entry ----------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "method not allowed" }, 405);

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({})) as {
      mode?: string;
      dry_run?: boolean;
      business_id?: string;
      preview_for?: string;
      days_inactive_threshold?: number;
      test_to?: string;
    };
    // Apps ask for counts with { preview_for } rather than { business_id, dry_run }:
    // the previous version of this function ignored dry_run and would have sent,
    // but rejects a body with no business_id, so a preview can never send by mistake.
    const previewFor = typeof body.preview_for === "string" ? body.preview_for : undefined;
    const dryRun = body.dry_run === true || previewFor !== undefined;

    // The daily job. This function is deployed with verify_jwt = false so the
    // scheduler can reach it; every other caller is checked below.
    const cronSecret = req.headers.get("x-winback-secret") ?? "";
    if (cronSecret) {
      const { data: okSecret } = await admin.rpc("winback_cron_secret_ok", { _secret: cronSecret });
      if (okSecret !== true || body.mode !== "scheduled" || body.test_to !== undefined) return reply({ error: "forbidden" }, 403);
      return reply(await scheduled(admin, dryRun));
    }

    // "Send now": a signed-in owner (or admin).
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return reply({ error: "unauthorized" }, 401);
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return reply({ error: "unauthorized" }, 401);
    const callerId = userData.user.id;

    const businessId = previewFor ?? body.business_id;
    if (!businessId) return reply({ error: "business_id required" }, 400);

    const { data: business, error: bizErr } = await admin
      .from("businesses")
      .select("id, name, owner_id, brand_color, winback_threshold_days")
      .eq("id", businessId)
      .single();
    if (bizErr || !business) return reply({ error: "business not found" }, 404);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (business.owner_id !== callerId && !isAdmin) return reply({ error: "forbidden" }, 403);

    const authed = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    // test_to is checked for shape before anything else happens; one plain address only.
    if (body.test_to !== undefined && !validTestAddress(body.test_to)) {
      return reply({ error: "test_to must be one plain email address" }, 400);
    }

    const { data: withinBurst } = await authed.rpc("check_rate_limit", {
      _action: dryRun ? "winback_preview" : "winback_emails",
      _limit: dryRun ? 10 : 2,
      _window_seconds: 60,
    });
    if (!withinBurst) return reply({ error: "Too many requests — please slow down." }, 429);

    // Test send: owner/admin of this business only (checked above). Skips the candidate list,
    // writes no winback_email_log row and no coupon row, returns before any batch logic.
    if (body.test_to !== undefined) {
      if (!RESEND_API_KEY) return reply({ error: "win-back email sending is not configured yet" }, 500);
      const detail: SendDetail = { qrSent: false, qrError: null, error: null };
      const fake: Candidate = { user_id: callerId, email: body.test_to, first_name: "Test", days_inactive: 30, recently_emailed: false };
      const emailSent = await sendOne(admin, business, fake, true, detail);
      return reply({ test: true, email_sent: emailSent, qr_sent: detail.qrSent, qr_error: detail.qrError, error: detail.error });
    }

    const threshold = clampThreshold(body.days_inactive_threshold, clampThreshold(business.winback_threshold_days, 30));

    if (dryRun) {
      // Counts only. "automatic" is what tomorrow morning's run would send today.
      const manual = await candidates(admin, business.id, threshold, false);
      const auto = await candidates(admin, business.id, clampThreshold(business.winback_threshold_days, 30), true);
      return reply({
        dry_run: true,
        send_now: { would_send: Math.min(manual.due.length, MANUAL_CAP), skipped: manual.skipped, waiting: Math.max(0, manual.due.length - MANUAL_CAP) },
        automatic: { would_send: Math.min(auto.due.length, AUTO_CAP), waiting: Math.max(0, auto.due.length - AUTO_CAP) },
      });
    }

    if (!RESEND_API_KEY) return reply({ error: "win-back email sending is not configured yet" }, 500);

    // Don't race the morning run for the same shop (it would see the same customers).
    const { data: running } = await admin
      .from("winback_auto_runs")
      .select("started_at")
      .eq("business_id", business.id)
      .is("finished_at", null)
      .gte("started_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .limit(1);
    if (running && running.length > 0) {
      return reply({ error: "Automatic win-back emails are going out right now. Try again in a few minutes." }, 409);
    }

    const { eligible, skipped, due } = await candidates(admin, business.id, threshold, false);
    if (eligible === 0) return reply({ sent: 0, skipped: 0, message: "no inactive members found" });

    const batch = due.slice(0, MANUAL_CAP);
    let sent = 0, errors = 0;
    for (const c of batch) {
      if (await sendOne(admin, business, c)) sent++;
      else errors++;
    }
    return reply({ sent, skipped, errors, remaining: due.length - batch.length });
  } catch (e) {
    console.error(e);
    return reply({ error: "internal error" }, 500);
  }
});
