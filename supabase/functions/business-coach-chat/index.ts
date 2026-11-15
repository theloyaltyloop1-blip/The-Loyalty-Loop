import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { cleanCoachMessages, coachSystemPrompt, statsHavePersonalData } from "../_shared/business-coach.ts";

// Owner-only conversational AI coach. Re-checks owner_id = auth.uid() OR
// admin server-side. Client sends the running message list plus current
// stats context so the model has real numbers, not just vibes.
// It only talks about the shop's loyalty and The Loyalty Loop: see
// ../_shared/business-coach.ts for the instructions and input checks.

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Kill switch: WHIRL_ENABLED=false makes the assistant answer 503 ("resting").
const ENABLED = (Deno.env.get("WHIRL_ENABLED") ?? "true").toLowerCase() !== "false";
const GLOBAL_DAILY_LIMIT = 1500; // all owners together, per UK day

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.the-loyalty-loop.com",
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
    if (!ENABLED) {
      return new Response(JSON.stringify({ error: "unavailable", reason: "resting" }), { status: 503, headers: jsonHeaders });
    }
    if (!GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: "Business coach is not configured yet" }), { status: 500, headers: jsonHeaders });
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
    const messages = cleanCoachMessages(body.messages);
    const stats = body.stats;
    if (!businessId || !messages) {
      return new Response(JSON.stringify({ error: "business_id and a valid conversation are required" }), { status: 400, headers: jsonHeaders });
    }

    // Privacy: stats are aggregate counts only. Refuse rather than forward personal data.
    if (statsHavePersonalData(stats)) {
      return new Response(JSON.stringify({ error: "stats must not contain personal data" }), { status: 400, headers: jsonHeaders });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: business, error: bizErr } = await admin
      .from("businesses")
      .select("id, name, owner_id, category, loyalty_type")
      .eq("id", businessId)
      .single();
    if (bizErr || !business) {
      return new Response(JSON.stringify({ error: "business not found" }), { status: 404, headers: jsonHeaders });
    }
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (business.owner_id !== callerId && !isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: jsonHeaders });
    }

    const { data: withinBurst } = await authed.rpc("check_rate_limit", { _action: "coach_chat", _limit: 6, _window_seconds: 60 });
    if (!withinBurst) {
      return new Response(JSON.stringify({ error: "Too many requests — please slow down." }), { status: 429, headers: jsonHeaders });
    }
    const { data: withinDailyCap } = await authed.rpc("check_daily_limit", { _action: "coach_chat_daily", _limit: 100 });
    if (!withinDailyCap) {
      return new Response(JSON.stringify({ error: "Daily message limit reached — try again tomorrow." }), { status: 429, headers: jsonHeaders });
    }

    // Overall cap across all owners (needs the ai_global_daily_cap migration).
    // If that function is not there yet the per-user limits above still apply.
    const { data: withinGlobal, error: globalErr } = await admin.rpc("check_global_daily_limit", { _action: "whirl_owner", _limit: GLOBAL_DAILY_LIMIT });
    if (globalErr) {
      console.error("global cap check unavailable");
    } else if (!withinGlobal) {
      return new Response(JSON.stringify({ error: "Whirl is resting for today — try again tomorrow.", scope: "global" }), { status: 429, headers: jsonHeaders });
    }

    const systemPrompt = coachSystemPrompt(business, stats);

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "system", content: systemPrompt }, ...messages.slice(-10)],
        temperature: 0.4,
        max_tokens: 500,
      }),
    });

    if (!groqRes.ok) {
      console.error(await groqRes.text());
      return new Response(JSON.stringify({ error: "coach reply failed" }), { status: 502, headers: jsonHeaders });
    }

    const json = await groqRes.json();
    const reply = json.choices?.[0]?.message?.content?.trim() ?? "";

    return new Response(JSON.stringify({ reply }), { headers: jsonHeaders });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "internal error" }), { status: 500, headers: jsonHeaders });
  }
});
