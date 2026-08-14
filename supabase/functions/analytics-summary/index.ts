import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Owner-only AI-written plain-English summary of the dashboard stats the
// client already computed (server re-checks owner_id = auth.uid() OR admin,
// never trusts the client's claim of ownership).

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  try {
    if (!GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: "AI summary is not configured yet" }), { status: 500, headers: jsonHeaders });
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
    const stats = body.stats;
    const period = body.period ?? 30;
    if (!businessId || !stats) {
      return new Response(JSON.stringify({ error: "business_id and stats required" }), { status: 400, headers: jsonHeaders });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: business, error: bizErr } = await admin
      .from("businesses")
      .select("id, name, owner_id, category")
      .eq("id", businessId)
      .single();
    if (bizErr || !business) {
      return new Response(JSON.stringify({ error: "business not found" }), { status: 404, headers: jsonHeaders });
    }
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (business.owner_id !== callerId && !isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: jsonHeaders });
    }

    const { data: withinBurst } = await authed.rpc("check_rate_limit", { _action: "analytics_summary", _limit: 5, _window_seconds: 60 });
    if (!withinBurst) {
      return new Response(JSON.stringify({ error: "Too many requests — please slow down." }), { status: 429, headers: jsonHeaders });
    }
    const { data: withinDailyCap } = await authed.rpc("check_daily_limit", { _action: "analytics_summary_daily", _limit: 50 });
    if (!withinDailyCap) {
      return new Response(JSON.stringify({ error: "Daily summary limit reached — try again tomorrow." }), { status: 429, headers: jsonHeaders });
    }

    const prompt = `You are a friendly small-business analyst writing a short summary for the owner of "${business.name}" (a ${business.category ?? "local"} shop) using a neighbourhood loyalty-card app.

Here are their stats for the last ${period} days, compared to the previous ${period}-day period, as JSON:
${JSON.stringify(stats, null, 2)}

Write a plain-English summary, 3-5 short sentences max. Lead with the single most important trend (good or bad). Mention one concrete number. Suggest one specific, actionable next step. No headers, no bullet points, no markdown, just plain prose. Be warm but direct, not corporate.`;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
        max_tokens: 300,
      }),
    });

    if (!groqRes.ok) {
      console.error(await groqRes.text());
      return new Response(JSON.stringify({ error: "AI summary failed" }), { status: 502, headers: jsonHeaders });
    }

    const json = await groqRes.json();
    const summary = json.choices?.[0]?.message?.content?.trim() ?? "";

    return new Response(JSON.stringify({ summary }), { headers: jsonHeaders });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "internal error" }), { status: 500, headers: jsonHeaders });
  }
});
