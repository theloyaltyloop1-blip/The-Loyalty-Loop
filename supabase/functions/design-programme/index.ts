import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { cleanMessages, designTurn, type ShopContext } from "../_shared/programme-designer.ts";
import { validateRules, type ProgrammeRules } from "../_shared/programme-rules.ts";

// AI programme builder. A shop owner describes the loyalty programme they want;
// the model answers with a rules document (never code), which is validated here
// and again by the database when the owner saves it. Things the building blocks
// cannot do are logged to programme_requests for the team.
//
// Body: { messages: [{role, content}], shop?: {name, category, currencySymbol},
//         business_id?: uuid (when changing an existing shop's programme) }
// Reply: { reply, rules | null, unsupported: [{request, closest}] }

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// The live website, plus local previews while developing. The apps send no Origin.
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": LOCAL_ORIGIN.test(origin) ? origin : "https://www.the-loyalty-loop.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function text(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = corsFor(req);
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "method not allowed" }, 405);

  try {
    if (!GROQ_API_KEY) return reply({ error: "The programme builder is not set up yet." }, 503);

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const authed = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await authed.auth.getUser(jwt);
    if (userErr || !userData?.user) return reply({ error: "unauthorized" }, 401);
    const callerId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const messages = cleanMessages(body.messages);
    if (!messages) return reply({ error: "messages must be a short conversation ending with the owner" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: callerId, _role: "admin" });
    const { data: isOwner } = await admin.rpc("has_role", { _user_id: callerId, _role: "business_owner" });

    const shop: ShopContext = {
      name: text(body.shop?.name, 80),
      category: text(body.shop?.category, 60),
      currencySymbol: text(body.shop?.currencySymbol, 4),
    };
    let current: ProgrammeRules | null = null;
    const businessId = typeof body.business_id === "string" ? body.business_id : null;
    if (businessId) {
      const { data: business } = await admin
        .from("businesses")
        .select("id, name, category, owner_id, reward_model, programme_rules, country_code")
        .eq("id", businessId)
        .maybeSingle();
      if (!business) return reply({ error: "business not found" }, 404);
      if (business.owner_id !== callerId && !isAdmin) return reply({ error: "forbidden" }, 403);
      shop.name = business.name;
      shop.category = business.category;
      if (business.reward_model === "custom") {
        const check = validateRules(business.programme_rules);
        if (check.ok) current = check.rules;
      }
    } else if (!isOwner && !isAdmin) {
      return reply({ error: "forbidden" }, 403);
    }

    const { data: withinBurst } = await authed.rpc("check_rate_limit", { _action: "programme_builder", _limit: 8, _window_seconds: 60 });
    if (!withinBurst) return reply({ error: "Too many messages at once. Give it a few seconds." }, 429);
    const { data: withinDay } = await authed.rpc("check_daily_limit", { _action: "programme_builder_daily", _limit: 80 });
    if (!withinDay) return reply({ error: "That's the limit for today. Try again tomorrow." }, 429);

    const call = async (convo: { role: string; content: string }[]) => {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: convo,
          temperature: 0.3,
          max_tokens: 4000,
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        console.error("groq", res.status, (await res.text()).slice(0, 500));
        throw new Error("model_failed");
      }
      const json = await res.json();
      return String(json.choices?.[0]?.message?.content ?? "");
    };

    let answer;
    try {
      answer = await designTurn(call, shop, current, messages);
    } catch (e) {
      console.error(e);
      return reply({ error: "The programme builder couldn't answer just now. Try again in a moment." }, 502);
    }

    if (answer.unsupported.length) {
      const { error } = await admin.from("programme_requests").insert(
        answer.unsupported.map((u) => ({ owner_id: callerId, business_id: businessId, request: u.request, closest: u.closest || null })),
      );
      if (error) console.error("programme_requests", error.message);
    }

    return reply(answer);
  } catch (e) {
    console.error(e);
    return reply({ error: "internal error" }, 500);
  }
});
