import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { bodyToText, chunk, renderEmailHtml, signUnsubscribe, unsubscribeApiUrl, unsubscribeUrl } from "../_shared/release-email.ts";

// Admin-only. Sends a drafted release announcement ("what's new" email).
//   { action: "test", announcement_id }  -> sends one copy to the calling admin
//   { action: "send", announcement_id }  -> sends to the whole audience
// "send" is safe to press twice or re-run after a timeout: every recipient row
// is claimed (primary key announcement_id+user_id) before anything is sent, so
// nobody gets the same announcement twice. Failed rows are retried on re-run;
// rows left "pending" by a crashed run are not (they may already have gone).

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("RELEASE_FROM_EMAIL") ?? Deno.env.get("WINBACK_FROM_EMAIL") ?? "The Loyalty Loop <onboarding@resend.dev>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.the-loyalty-loop.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const headers = { ...corsHeaders, "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

type Announcement = { id: string; audience: "owners" | "shoppers"; subject: string; body: string; status: string };
type Recipient = { user_id: string; email: string; first_name: string | null };

async function buildEmail(a: Announcement, r: Recipient, subjectPrefix = "") {
  const token = await signUnsubscribe(r.user_id, SERVICE_ROLE_KEY);
  const pageUrl = await unsubscribeUrl(r.user_id, SERVICE_ROLE_KEY);
  return {
    from: FROM_EMAIL,
    to: [r.email],
    subject: subjectPrefix + a.subject,
    html: renderEmailHtml({ body: a.body, firstName: r.first_name, unsubscribeUrl: pageUrl, audience: a.audience }),
    text: bodyToText(a.body, r.first_name, pageUrl),
    headers: {
      "List-Unsubscribe": `<${unsubscribeApiUrl(SUPABASE_URL, r.user_id, token)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

async function resendBatch(emails: unknown[], idempotencyKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(emails),
      signal: AbortSignal.timeout(30000),
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 300)}` };
  } catch (e) {
    return { ok: false, error: `Resend request failed: ${String(e).slice(0, 200)}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "method not allowed" }, 405);
  try {
    if (!RESEND_API_KEY) return reply({ error: "Email sending is not configured (RESEND_API_KEY missing)." }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return reply({ error: "unauthorized" }, 401);
    const callerId = userData.user.id;
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (!isAdmin) return reply({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    const id = body.announcement_id as string;
    if (!id || !["test", "send"].includes(action)) return reply({ error: "announcement_id and action (test|send) required" }, 400);

    const { data: a, error: aErr } = await admin
      .from("release_announcements")
      .select("id, audience, subject, body, status")
      .eq("id", id)
      .maybeSingle<Announcement>();
    if (aErr || !a) return reply({ error: "announcement not found" }, 404);

    if (action === "test") {
      const { data: me } = await admin.from("profiles").select("email, first_name").eq("id", callerId).maybeSingle();
      const email = me?.email ?? userData.user.email;
      if (!email) return reply({ error: "your account has no email address" }, 400);
      const msg = await buildEmail(a, { user_id: callerId, email, first_name: me?.first_name ?? null }, "[Test] ");
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(msg),
      });
      if (!res.ok) return reply({ error: `Test email failed: ${(await res.text()).slice(0, 300)}` }, 502);
      return reply({ ok: true, sent_to: email });
    }

    // ---- send to the audience ----
    if (a.status !== "draft" && a.status !== "sending") return reply({ error: `This announcement is ${a.status}.` }, 409);

    const { data: started, error: startErr } = await admin
      .from("release_announcements")
      .update({ status: "sending", approved_by: callerId, sending_started_at: new Date().toISOString() })
      .eq("id", id)
      .in("status", ["draft", "sending"])
      .select("id");
    if (startErr || !started?.length) return reply({ error: "could not start sending" }, 409);

    const { data: audience, error: audErr } = await admin.rpc("release_announcement_audience", { _audience: a.audience });
    if (audErr) throw audErr;
    const people = (audience ?? []) as Recipient[];
    await admin.from("release_announcements").update({ recipient_count: people.length }).eq("id", id);

    // Claim new recipients; existing rows (from an earlier run) are left alone.
    if (people.length) {
      const { error: claimErr } = await admin
        .from("release_announcement_recipients")
        .upsert(people.map((p) => ({ announcement_id: id, user_id: p.user_id, email: p.email })), {
          onConflict: "announcement_id,user_id",
          ignoreDuplicates: true,
        });
      if (claimErr) throw claimErr;
    }

    // Take ownership of rows that still need sending: never-claimed ones, plus
    // earlier failures. Each UPDATE only matches rows no other run holds, and
    // Postgres row locks make a concurrent run skip rows this one just took.
    const runId = crypto.randomUUID();
    const now = new Date().toISOString();
    const { data: fresh, error: c1 } = await admin.from("release_announcement_recipients")
      .update({ claimed_by: runId, updated_at: now })
      .eq("announcement_id", id).eq("status", "pending").is("claimed_by", null)
      .select("user_id");
    const { data: retry, error: c2 } = await admin.from("release_announcement_recipients")
      .update({ claimed_by: runId, status: "pending", error: null, updated_at: now })
      .eq("announcement_id", id).eq("status", "failed")
      .select("user_id");
    if (c1 || c2) throw c1 ?? c2;
    const toSend = new Set([...(fresh ?? []), ...(retry ?? [])].map((r) => r.user_id));
    const byId = new Map(people.map((p) => [p.user_id, p]));
    const batchPeople = [...toSend].map((uid) => byId.get(uid)).filter((p): p is Recipient => !!p);
    // Someone who unsubscribed (or lost the role) since an earlier failed run: drop them.
    const gone = [...toSend].filter((uid) => !byId.has(uid));
    if (gone.length) {
      await admin.from("release_announcement_recipients").delete()
        .eq("announcement_id", id).eq("claimed_by", runId).in("user_id", gone);
    }

    let sent = 0;
    let failed = 0;
    for (const group of chunk(batchPeople, 100)) {
      const emails = await Promise.all(group.map((p) => buildEmail(a, p)));
      const ids = group.map((p) => p.user_id);
      const result = await resendBatch(emails, `release-${runId}-${ids[0]}`);
      await admin.from("release_announcement_recipients")
        .update({ status: result.ok ? "sent" : "failed", error: result.error ?? null, updated_at: new Date().toISOString() })
        .eq("announcement_id", id).eq("claimed_by", runId).in("user_id", ids);
      if (result.ok) sent += ids.length;
      else failed += ids.length;
    }

    // Totals across all runs.
    const { data: rows } = await admin.from("release_announcement_recipients").select("status").eq("announcement_id", id);
    const totals = { sent: 0, failed: 0, pending: 0 };
    for (const r of rows ?? []) totals[r.status as keyof typeof totals]++;
    const done = totals.failed === 0 && totals.pending === 0;
    await admin.from("release_announcements").update({
      sent_count: totals.sent,
      failed_count: totals.failed,
      status: done ? "sent" : "sending",
      sent_at: done ? new Date().toISOString() : null,
    }).eq("id", id);

    return reply({ ok: true, sent_this_run: sent, failed_this_run: failed, totals, recipient_count: people.length, status: done ? "sent" : "sending" });
  } catch (e) {
    console.error(e);
    return reply({ error: "internal error" }, 500);
  }
});
