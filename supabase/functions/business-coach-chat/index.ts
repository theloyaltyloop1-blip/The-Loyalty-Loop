import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Owner-only conversational AI coach. Re-checks owner_id = auth.uid() OR
// admin server-side. Client sends the running message list plus current
// stats context so the model has real numbers, not just vibes.

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
    const messages = body.messages as Array<{ role: string; content: string }> | undefined;
    const stats = body.stats;
    if (!businessId || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "business_id and messages required" }), { status: 400, headers: jsonHeaders });
    }
    if (messages.length > 20) {
      return new Response(JSON.stringify({ error: "conversation too long" }), { status: 400, headers: jsonHeaders });
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

    const systemPrompt = `You are the Business Coach inside The Loyalty Loop, a neighbourhood loyalty-card app. You're helping the owner of "${business.name}" (a ${business.category ?? "local"} shop running a ${business.loyalty_type} loyalty program). Give specific, practical, small-business marketing/retention advice grounded in the stats provided below when relevant. Keep answers concise (a few sentences to a short paragraph, not an essay), conversational, no markdown headers. If you don't have enough data to answer precisely, say so and suggest what would help.\n\nCurrent stats:\n${JSON.stringify(stats ?? {}, null, 2)}`;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: systemPrompt }, ...messages.slice(-10)],
        temperature: 0.7,
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
