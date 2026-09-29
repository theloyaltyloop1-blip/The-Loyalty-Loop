import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildReplyMessages, sanitizeReply, type ReplyContext } from "../_shared/review-reply.ts";

// Writes AI replies to Loyalty Loop reviews.
// - Called by the reviews trigger with { review_id } and no user: the
//   database decides whether a reply is due and whether it may be posted.
//   Calling it again, or by hand, can do no more than the trigger would.
// - Called by an owner or permitted staff with { review_id, mode: "draft" }
//   and their session: always writes a draft, never posts.

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function writeReply(ctx: ReplyContext): Promise<string> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages: buildReplyMessages(ctx),
      temperature: 0.6,
      max_tokens: 700,
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
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const reviewId = body?.review_id;
    if (typeof reviewId !== "string" || !UUID.test(reviewId)) return json({ error: "invalid_review_id" }, 400);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const ownerRequest = body?.mode === "draft";
    if (ownerRequest) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.replace(/^Bearer\s+/i, "");
      const { data: userData } = token ? await admin.auth.getUser(token) : { data: { user: null } };
      const user = userData?.user;
      if (!user) return json({ error: "not_authenticated" }, 401);

      const { data: review } = await admin.from("reviews").select("business_id").eq("id", reviewId).maybeSingle();
      if (!review) return json({ error: "not_found" }, 404);
      const { data: allowed } = await admin.rpc("can_manage_review_replies", {
        _business_id: review.business_id, _user_id: user.id,
      });
      if (allowed !== true) return json({ error: "forbidden" }, 403);

      const asUser = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } },
      });
      const { data: withinBurst } = await asUser.rpc("check_rate_limit", {
        _action: "ai_review_reply", _limit: 10, _window_seconds: 60,
      });
      const { data: withinDaily } = withinBurst
        ? await asUser.rpc("check_daily_limit", { _action: "ai_review_reply_daily", _limit: 50 })
        : { data: false };
      if (!withinBurst || !withinDaily) return json({ error: "Too many AI replies right now. Try again later." }, 429);
    }

    if (!GROQ_API_KEY) {
      return ownerRequest ? json({ error: "AI replies are not configured yet" }, 503) : json({ status: "skipped", reason: "not_configured" });
    }

    const { data: claim, error: claimError } = await admin.rpc("claim_review_reply_generation", {
      _review_id: reviewId, _force: ownerRequest,
    });
    if (claimError) {
      console.error("ai-review-reply claim failed", claimError.code ?? "unknown");
      return json({ error: "server_error" }, 500);
    }
    if (claim?.status !== "claimed") {
      return ownerRequest
        ? json({ error: claim?.reason === "in_progress" ? "A reply is already being written." : "Nothing to write." }, 409)
        : json({ status: "skipped", reason: claim?.reason });
    }

    let raw = "";
    let failure: string | null = null;
    try {
      raw = await writeReply(claim as ReplyContext);
    } catch (error) {
      failure = error instanceof Error ? error.message : "generation_failed";
      console.error("ai-review-reply generation failed", failure);
    }
    const reply = sanitizeReply(raw);
    const { data: done, error: doneError } = await admin.rpc("complete_review_reply_generation", {
      _review_id: reviewId,
      _attempt: claim.attempt,
      _body: reply.text,
      _error: failure ?? reply.reason ?? null,
      _safe_to_post: reply.safe,
      _allow_auto_post: !ownerRequest,
    });
    if (doneError) {
      console.error("ai-review-reply complete failed", doneError.code ?? "unknown");
      return json({ error: "server_error" }, 500);
    }
    if (ownerRequest) {
      return done?.status === "ready"
        ? json({ status: "ready", body: reply.text })
        : json({ error: "The AI couldn't write a reply. Please try again." }, 502);
    }
    return json({ status: done?.status ?? "unknown" });
  } catch (error) {
    console.error("ai-review-reply failed", error instanceof Error ? error.name : "unknown");
    return json({ error: "server_error" }, 500);
  }
});
