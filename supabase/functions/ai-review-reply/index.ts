import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleReviewReply, type ChatMessage } from "../_shared/review-reply-handler.ts";

// Writes AI replies to Loyalty Loop reviews. The logic is in
// _shared/review-reply-handler.ts; this file only wires up Supabase and Groq.

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function groqChat(messages: ChatMessage[], maxTokens: number): Promise<string> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages,
      temperature: 0.4,
      max_tokens: maxTokens,
      reasoning_effort: "low",
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`groq_${response.status}`);
  const body = await response.json();
  return body.choices?.[0]?.message?.content ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const authHeader = req.headers.get("Authorization") ?? "";
    const result = await handleReviewReply(await req.json().catch(() => ({})), authHeader, {
      rpc: async (fn, args) => {
        const { data, error } = await admin.rpc(fn, args);
        return { data, error };
      },
      reviewBusinessId: async (reviewId) => {
        const { data } = await admin.from("reviews").select("business_id").eq("id", reviewId).maybeSingle();
        return data?.business_id ?? null;
      },
      userIdFromToken: async (token) => (await admin.auth.getUser(token)).data?.user?.id ?? null,
      withinUserLimits: async (header) => {
        const asUser = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
          auth: { persistSession: false },
          global: { headers: { Authorization: header } },
        });
        const { data: burst } = await asUser.rpc("check_rate_limit", { _action: "ai_review_reply", _limit: 10, _window_seconds: 60 });
        if (!burst) return false;
        const { data: daily } = await asUser.rpc("check_daily_limit", { _action: "ai_review_reply_daily", _limit: 50 });
        return daily === true;
      },
      chat: GROQ_API_KEY ? groqChat : null,
    });
    return new Response(JSON.stringify(result.body), { status: result.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("ai-review-reply failed", error instanceof Error ? error.name : "unknown");
    return new Response(JSON.stringify({ error: "server_error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
