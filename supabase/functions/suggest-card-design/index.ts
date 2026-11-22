import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import Anthropic from "npm:@anthropic-ai/sdk";
import UPNG from "npm:upng-js@2.1.0";
import jpeg from "npm:jpeg-js@0.4.4";
import { dominantColour, finalise, FALLBACK_COLOUR } from "../_shared/card-colour.ts";
import { fallbackDesign, parseAiDesign, BACKGROUNDS, ICONS, TYPEFACES, LAYOUTS, ENTRANCES, POSITIONS, type DesignContext } from "../_shared/card-design.ts";

// "Design it for me": proposes a complete loyalty-card design for a shop. Suggest-only:
// it never writes. The Business app shows it as a preview and saves it only when the
// shop presses accept. Body: { business_id: uuid } (images come from the shop row only).
// Reply: { design: card_design, source: 'ai' | 'fallback' }. Every value is validated
// against the real card_design options and contrast-fixed in ../_shared/card-design.ts.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = Deno.env.get("CARD_DESIGN_CLAUDE_MODEL") ?? "claude-haiku-4-5";
const MAX_BYTES = 5 * 1024 * 1024;
const LOGO_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/logos/`;
const COVER_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/covers/`;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

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

const SYSTEM = `You design a shop's digital loyalty card. Choose ONLY from these options and answer with ONE JSON object, nothing else:
{"background":${JSON.stringify(BACKGROUNDS)},"color":"#RRGGBB","secondary":"#RRGGBB","icon":${JSON.stringify(ICONS)},"font":${JSON.stringify(TYPEFACES)},"layout":${JSON.stringify(LAYOUTS)},"entrance":${JSON.stringify(ENTRANCES)},"logoPosition":${JSON.stringify(POSITIONS)}}
Pick one value per field. "color" is the card background (usually the brand colour from the logo, or a richer shade if it is pale). "secondary" is the stamp accent and must stand out on it. Textures (kraft, chalkboard, marble, wood, roast, pinstripe, paper) suit shops that match them; "photo" uses the shop's cover photo if one was given. Use icon "logo" only if a logo was given. Match the shop's category and personality. White or black text goes on the card, so keep the colour readable.`;

async function fetchImage(url: unknown, prefix: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (typeof url !== "string" || !url.startsWith(prefix)) return null; // our own buckets only
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!res.ok || !IMAGE_TYPES.includes(mime)) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return bytes.length > MAX_BYTES ? null : { bytes, mime };
  } catch {
    return null;
  }
}

type Img = { bytes: Uint8Array; mime: string };
async function askClaude(facts: string, logo: Img | null, cover: Img | null, ctx: DesignContext) {
  if (!ANTHROPIC_API_KEY) return null;
  const claude = new Anthropic({ apiKey: ANTHROPIC_API_KEY, timeout: 25_000, maxRetries: 1 });
  const content: Array<Record<string, unknown>> = [];
  for (const [label, img] of [["Logo:", logo], ["Cover photo:", cover]] as const) {
    if (!img) continue;
    content.push({ type: "text", text: label });
    content.push({ type: "image", source: { type: "base64", media_type: img.mime, data: encodeBase64(img.bytes) } });
  }
  content.push({ type: "text", text: facts });
  const response = await claude.messages.create({
    model: MODEL,
    max_tokens: 220,
    system: SYSTEM,
    messages: [{ role: "user", content }],
  } as never);
  const out = (response as { content: Array<{ type: string; text?: string }> }).content.find((b) => b.type === "text");
  return out?.text ? parseAiDesign(out.text, ctx) : null;
}

function decodePixels(bytes: Uint8Array, mime: string): Uint8Array | null {
  try {
    if (mime === "image/png") {
      const png = UPNG.decode(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      if (png.width * png.height > 16_000_000) return null;
      return new Uint8Array(UPNG.toRGBA8(png)[0]);
    }
    if (mime === "image/jpeg") return jpeg.decode(bytes, { useTArray: true, maxResolutionInMP: 16 }).data;
  } catch { /* fall through */ }
  return null;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = corsFor(req);
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const authed = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await authed.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData?.user) return reply({ error: "unauthorized" }, 401);
    const callerId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const businessId = typeof body.business_id === "string" ? body.business_id : "";
    if (!/^[0-9a-f-]{36}$/i.test(businessId)) return reply({ error: "business_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: business } = await admin.from("businesses")
      .select("id, owner_id, name, category, logo_url, cover_url, loyalty_type, reward_model")
      .eq("id", businessId).maybeSingle();
    if (!business) return reply({ error: "business not found" }, 404);
    if (business.owner_id !== callerId) {
      const { data: isAdmin } = await admin.rpc("has_role", { _user_id: callerId, _role: "admin" });
      if (!isAdmin) return reply({ error: "forbidden" }, 403);
    }

    const { data: withinBurst } = await authed.rpc("check_rate_limit", { _action: "card_design", _limit: 6, _window_seconds: 60 });
    if (!withinBurst) return reply({ error: "Too many tries. Give it a few seconds." }, 429);
    const { data: withinDay } = await authed.rpc("check_daily_limit", { _action: "card_design_daily", _limit: 30 });
    if (!withinDay) return reply({ error: "That's the limit for today. Try again tomorrow." }, 429);

    const [logo, cover] = await Promise.all([fetchImage(business.logo_url, LOGO_PREFIX), fetchImage(business.cover_url, COVER_PREFIX)]);
    const stamps = business.reward_model !== "spend_threshold" && !["points", "tiered"].includes(business.loyalty_type || "");
    const ctx: DesignContext = {
      category: business.category,
      hasLogo: !!logo,
      coverUrl: cover ? (business.cover_url as string) : null,
      stamps,
    };
    const programme = business.reward_model === "spend_threshold" ? "spend" : business.loyalty_type === "points" || business.reward_model === "points" ? "points" : "stamps";
    const facts = `Shop: ${String(business.name ?? "").slice(0, 80)}. Category: ${String(business.category ?? "unknown").slice(0, 40)}. Programme: ${programme}. Logo given: ${logo ? "yes" : "no"}. Cover photo given: ${cover ? "yes" : "no"}.`;

    try {
      const ai = await askClaude(facts, logo, cover, ctx);
      if (ai) return reply({ design: ai, source: "ai" });
    } catch (e) {
      console.error("suggest-card-design ai failed", e instanceof Error ? e.message : "unknown");
    }

    // Fallback: existing deterministic colour logic + category template.
    const pixels = logo ? decodePixels(logo.bytes, logo.mime) : null;
    const colour = pixels ? dominantColour(pixels) : finalise(FALLBACK_COLOUR);
    return reply({ design: fallbackDesign(ctx, colour), source: "fallback" });
  } catch (e) {
    console.error("suggest-card-design error", e instanceof Error ? e.message : "unknown");
    return reply({ error: "Something went wrong." }, 500);
  }
});
