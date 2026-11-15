import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { programmeProgressText } from "../_shared/whatsapp-messages.ts";
import type { BotShop } from "../_shared/whatsapp-bot.ts";
import {
  DAILY_LIMIT, GLOBAL_DAILY_LIMIT, handleAsk, MINUTE_LIMIT, ownShops, type ModelMessage, type PublicShop,
} from "../_shared/whirl-shopper.ts";

// "Ask Whirl" for shoppers. Signed-in users only (JWT verification stays ON,
// and the user id is read from the verified token, never from the body).
// No chat is stored. The model sees only the asker's own cards, public shop
// details and the static FAQ: see ../_shared/whirl-shopper.ts.
//
// Secrets: GROQ_API_KEY (already set for other functions). Optional kill
// switch: WHIRL_ENABLED=false makes this answer 503 ("resting").

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENABLED = (Deno.env.get("WHIRL_ENABLED") ?? "true").toLowerCase() !== "false";

const MEMBER_COLUMNS = "user_id,reward_progress_pence,stamp_count,points_balance,visit_count,current_tier";
const BUSINESS_COLUMNS = "id,name,category,description,reward_model,loyalty_type,loyalty_config,programme_rules,reward_threshold_pence,reward_catalog(title,spend_threshold_pence,points_cost)";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

async function groqChat(messages: ModelMessage[], maxTokens: number): Promise<string> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "openai/gpt-oss-120b", messages, temperature: 0.3, max_tokens: maxTokens, reasoning_effort: "low" }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`groq_${response.status}`);
  const body = await response.json();
  return body.choices?.[0]?.message?.content ?? "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: jsonHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const authed = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: userData, error: userErr } = jwt ? await authed.auth.getUser(jwt) : { data: null, error: true };
    const userId = !userErr && userData?.user ? userData.user.id : null;

    const body = await req.json().catch(() => ({}));

    const result = await handleAsk({
      enabled: ENABLED,
      configured: Boolean(GROQ_API_KEY),
      userId,
      // Per-user limits use the caller's own JWT (auth.uid()); the overall cap
      // is service-role only, so a user cannot touch it.
      checkMinute: async () => Boolean((await authed.rpc("check_rate_limit", { _action: "whirl_shopper", _limit: MINUTE_LIMIT, _window_seconds: 60 })).data),
      checkDay: async () => Boolean((await authed.rpc("check_daily_limit", { _action: "whirl_shopper_daily", _limit: DAILY_LIMIT })).data),
      checkGlobal: async () => Boolean((await admin.rpc("check_global_daily_limit", { _action: "whirl_shopper", _limit: GLOBAL_DAILY_LIMIT })).data),
      loadOwn: async (uid) => {
        const [{ data: memberships }, { data: rewards }] = await Promise.all([
          admin.from("memberships").select(`${MEMBER_COLUMNS},business:businesses(${BUSINESS_COLUMNS})`).eq("user_id", uid),
          admin.from("rewards").select("business_id,title,expires_at").eq("user_id", uid).is("redeemed_at", null),
        ]);
        const now = Date.now();
        // deno-lint-ignore no-explicit-any
        return ownShops(uid, (memberships ?? []) as any[], (m): BotShop | null => {
          const business = Array.isArray(m.business) ? m.business[0] : m.business;
          if (!business) return null;
          const catalog: Array<{ title: string; spend_threshold_pence: number | null; points_cost?: number | null }> = business.reward_catalog ?? [];
          const pointsShop = business.reward_model === "points" || business.reward_model === "custom";
          const unitMany = business.programme_rules?.unit?.many || "points";
          return {
            name: business.name,
            category: business.category ?? null,
            description: business.description ?? null,
            progressPence: m.reward_progress_pence ?? 0,
            thresholdPence: business.reward_threshold_pence ?? null,
            tiers: business.reward_catalog ?? [],
            stampLine: programmeProgressText(business, m, catalog),
            programmeSummary: business.reward_model === "custom" ? business.programme_rules?.summary ?? null : null,
            rewardCosts: pointsShop
              ? catalog.filter((r) => typeof r.points_cost === "number" && r.points_cost > 0).map((r) => `${r.title} for ${r.points_cost} ${unitMany}`)
              : [],
            readyRewards: (rewards ?? [])
              .filter((r) => r.business_id === business.id && (!r.expires_at || Date.parse(r.expires_at) > now))
              .map((r) => r.title),
          };
        });
      },
      loadPublicShops: async () => {
        const { data } = await admin.from("businesses")
          .select("id,name,category,description,address,lat,lng")
          .eq("is_active", true).eq("approval_status", "approved")
          .limit(2000);
        return (data ?? []).map((b): PublicShop => ({
          id: b.id, name: b.name, category: b.category ?? null, description: b.description ?? null,
          area: typeof b.address === "string" ? b.address.slice(0, 80) : null,
          lat: typeof b.lat === "number" ? b.lat : null, lng: typeof b.lng === "number" ? b.lng : null,
        }));
      },
      chat: groqChat,
      // Outcome and latency only. Never the question, the reply or the user's data.
      log: (outcome, ms) => console.log(JSON.stringify({ fn: "ask-whirl", outcome, ms })),
    }, body);

    return new Response(JSON.stringify(result.body), { status: result.status, headers: jsonHeaders });
  } catch (_e) {
    console.error("ask-whirl failed");
    return new Response(JSON.stringify({ error: "unavailable" }), { status: 502, headers: jsonHeaders });
  }
});
