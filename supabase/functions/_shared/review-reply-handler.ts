// Request handling for the ai-review-reply Edge Function, with its
// dependencies injected so it can be tested with fakes (no model calls).
import {
  buildReplyMessages, buildVerifierMessages, sanitizeReply, verifierPassed, type ReplyContext,
} from "./review-reply.ts";

export type ChatMessage = { role: "system" | "user"; content: string };

export type ReplyDeps = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: any; error: { code?: string } | null }>;
  reviewBusinessId: (reviewId: string) => Promise<string | null>;
  userIdFromToken: (token: string) => Promise<string | null>;
  withinUserLimits: (authHeader: string) => Promise<boolean>;
  // null when no model key is configured.
  chat: ((messages: ChatMessage[], maxTokens: number) => Promise<string>) | null;
};

export type HandlerResult = { status: number; body: Record<string, unknown> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Automatic requests ({ review_id }) come from the reviews trigger and need no
// user: the database only lets them consume a request the trigger queued.
// Owner requests ({ review_id, mode: "draft" }) need a signed-in manager and
// only ever produce a draft.
export async function handleReviewReply(body: unknown, authHeader: string, deps: ReplyDeps): Promise<HandlerResult> {
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const reviewId = input.review_id;
  if (typeof reviewId !== "string" || !UUID.test(reviewId)) return { status: 400, body: { error: "invalid_review_id" } };
  if (input.mode !== undefined && input.mode !== null && input.mode !== "draft") {
    return { status: 400, body: { error: "invalid_mode" } };
  }
  const ownerRequest = input.mode === "draft";

  if (ownerRequest) {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const userId = token ? await deps.userIdFromToken(token) : null;
    if (!userId) return { status: 401, body: { error: "not_authenticated" } };
    const businessId = await deps.reviewBusinessId(reviewId);
    if (!businessId) return { status: 404, body: { error: "not_found" } };
    const { data: allowed } = await deps.rpc("can_manage_review_replies", { _business_id: businessId, _user_id: userId });
    if (allowed !== true) return { status: 403, body: { error: "forbidden" } };
    if (!(await deps.withinUserLimits(authHeader))) {
      return { status: 429, body: { error: "Too many AI replies right now. Try again later." } };
    }
  }

  if (!deps.chat) {
    return ownerRequest
      ? { status: 503, body: { error: "AI replies are not configured yet" } }
      : { status: 200, body: { status: "skipped", reason: "not_configured" } };
  }

  const { data: claim, error: claimError } = await deps.rpc("claim_review_reply_generation", {
    _review_id: reviewId, _force: ownerRequest,
  });
  if (claimError) {
    console.error("ai-review-reply claim failed", claimError.code ?? "unknown");
    return { status: 500, body: { error: "server_error" } };
  }
  if (claim?.status !== "claimed") {
    return ownerRequest
      ? { status: 409, body: { error: claim?.reason === "in_progress" ? "A reply is already being written." : "Nothing to write." } }
      : { status: 200, body: { status: "skipped", reason: claim?.reason } };
  }
  const ctx = claim as ReplyContext & { attempt: number };

  let raw = "";
  let failure: string | null = null;
  try {
    raw = await deps.chat(buildReplyMessages(ctx), 700);
  } catch (error) {
    failure = error instanceof Error ? error.message : "generation_failed";
    console.error("ai-review-reply generation failed", failure);
  }
  const reply = sanitizeReply(raw, ctx);
  let safe = reply.safe;
  let reason = reply.reason ?? null;

  // Only an automatic reply to a 4-5 star review can be posted unseen, and
  // only if an independent check also passes it.
  if (!ownerRequest && safe && reply.text && ctx.review.rating >= 4) {
    try {
      if (!verifierPassed(await deps.chat(buildVerifierMessages(reply.text, ctx), 300))) {
        safe = false;
        reason = "verifier";
      }
    } catch {
      safe = false;
      reason = "verifier_unavailable";
    }
  } else {
    // Owner drafts and replies to 1-3 star reviews are never posted unseen;
    // the database refuses them too.
    safe = false;
  }

  const { data: done, error: doneError } = await deps.rpc("complete_review_reply_generation", {
    _review_id: reviewId,
    _attempt: ctx.attempt,
    _body: reply.text,
    _error: failure ?? reason,
    _safe_to_post: safe,
    _allow_auto_post: !ownerRequest,
  });
  if (doneError) {
    console.error("ai-review-reply complete failed", doneError.code ?? "unknown");
    return { status: 500, body: { error: "server_error" } };
  }
  if (ownerRequest) {
    return done?.status === "ready"
      ? { status: 200, body: { status: "ready", body: reply.text } }
      : { status: 502, body: { error: "The AI couldn't write a reply. Please try again." } };
  }
  return { status: 200, body: { status: done?.status ?? "unknown" } };
}
