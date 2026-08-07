import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Owner-triggered win-back email send. JWT-required: the caller must own
// the business_id they pass in (checked below, not just implied by the
// JWT existing). Finds members inactive past `days_inactive_threshold`,
// not opted out of promos, not already emailed in the last 30 days
// (winback_email_log), sends via Resend, logs each send.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function genCoupon() {
  return "COMEBACK" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "win-back email sending is not configured yet" }), { status: 500, headers: jsonHeaders });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const authed = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authed.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: jsonHeaders });
    }
    const callerId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const businessId = body.business_id as string | undefined;
    const daysThreshold = Number(body.days_inactive_threshold ?? 30);
    if (!businessId) {
      return new Response(JSON.stringify({ error: "business_id required" }), { status: 400, headers: jsonHeaders });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: business, error: bizErr } = await admin
      .from("businesses")
      .select("id, name, owner_id, brand_color")
      .eq("id", businessId)
      .single();
    if (bizErr || !business) {
      return new Response(JSON.stringify({ error: "business not found" }), { status: 404, headers: jsonHeaders });
    }
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (business.owner_id !== callerId && !isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: jsonHeaders });
    }

    const cutoff = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000).toISOString();

    const { data: members, error: memErr } = await admin
      .from("memberships")
      .select("user_id, last_activity_at, promos_opted_out, joined_at")
      .eq("business_id", businessId)
      .eq("promos_opted_out", false)
      .or(`last_activity_at.lt.${cutoff},last_activity_at.is.null`);
    if (memErr) throw memErr;

    const eligible = (members ?? []).filter((m) => {
      const reference = m.last_activity_at ?? m.joined_at;
      return reference && new Date(reference).getTime() < new Date(cutoff).getTime();
    });

    if (eligible.length === 0) {
      return new Response(JSON.stringify({ sent: 0, skipped: 0, message: "no inactive members found" }), {
        headers: jsonHeaders,
      });
    }

    const recentCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentlySent } = await admin
      .from("winback_email_log")
      .select("user_id")
      .eq("business_id", businessId)
      .gte("sent_at", recentCutoff);
    const recentlySentIds = new Set((recentlySent ?? []).map((r) => r.user_id));

    const toEmail = eligible.filter((m) => !recentlySentIds.has(m.user_id));

    let sent = 0;
    const errors: string[] = [];

    for (const member of toEmail) {
      const { data: profile } = await admin
        .from("profiles")
        .select("email, first_name")
        .eq("id", member.user_id)
        .single();
      if (!profile?.email) continue;

      const coupon = genCoupon();
      const daysInactive = Math.floor(
        (Date.now() - new Date(member.last_activity_at ?? member.joined_at).getTime()) / (24 * 60 * 60 * 1000)
      );
      const subject = `We miss you at ${business.name}!`;
      const greeting = profile.first_name ? `Hi ${profile.first_name},` : "Hi there,";
      const html = `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:${business.brand_color}">${greeting}</h2>
        <p>It's been a while since your last visit to <strong>${business.name}</strong> — come back and use code <strong>${coupon}</strong> for a little something extra on us.</p>
        <p style="color:#888;font-size:13px">You're receiving this because you're a member of ${business.name}'s loyalty card on The Loyalty Loop. You can opt out of promotional emails any time from the shop page.</p>
      </div>`;

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "The Loyalty Loop <onboarding@resend.dev>",
            to: [profile.email],
            subject,
            html,
          }),
        });
        const ok = res.ok;
        const errText = ok ? null : await res.text();

        await admin.from("winback_email_log").insert({
          business_id: businessId,
          user_id: member.user_id,
          recipient_email: profile.email,
          days_inactive: daysInactive,
          coupon_code: coupon,
          subject,
          body_preview: html.slice(0, 300),
          status: ok ? "sent" : "failed",
          error: errText,
        });

        if (ok) sent++;
        else errors.push(`${profile.email}: ${errText}`);
      } catch (e) {
        errors.push(`${profile.email}: ${String(e)}`);
        await admin.from("winback_email_log").insert({
          business_id: businessId,
          user_id: member.user_id,
          recipient_email: profile.email,
          days_inactive: daysInactive,
          coupon_code: coupon,
          subject,
          status: "failed",
          error: "send failed",
        });
      }
    }

    return new Response(
      JSON.stringify({ sent, skipped: eligible.length - toEmail.length, errors: errors.length }),
      { headers: jsonHeaders }
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "internal error" }), { status: 500, headers: jsonHeaders });
  }
});
