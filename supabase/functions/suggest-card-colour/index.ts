import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import Anthropic from "npm:@anthropic-ai/sdk";
import UPNG from "npm:upng-js@2.1.0";
import jpeg from "npm:jpeg-js@0.4.4";
import { dominantColour, FALLBACK_COLOUR, finalise, parseAiColour, type CardColour, type ColourSource } from "../_shared/card-colour.ts";

// Picks a loyalty-card colour from a shop's logo. Suggest-only: it never writes.
// The Business app saves the result (brand_color + card_design) itself, only when
// the shop has not customised its card, so an owner's own design is never overwritten.
//
// Body: { business_id: uuid }   (the logo is read from the shop row, never from the caller)
// Reply: { background, secondary, text, source: 'ai' | 'extracted' | 'default' }
// The AI only ever returns hex strings, which are validated and contrast-fixed here.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = Deno.env.get("CARD_COLOUR_CLAUDE_MODEL") ?? "claude-haiku-4-5";
const MAX_BYTES = 5 * 1024 * 1024;
const LOGO_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/logos/`;

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

const SYSTEM = `You choose the colours for a shop's digital loyalty card from the shop's logo.
Pick a card BACKGROUND colour that looks best with the brand: usually the brand's main colour, or a deeper or richer shade of it when the main colour is very pale, very light grey or pure white. Avoid pure white and pure black. White or black text will be placed on the background, so it must be clearly readable. Also pick a SECONDARY accent colour (for stamps and highlights) that harmonises with the background and stands out against it.
Answer with ONE JSON object and nothing else: {"background":"#RRGGBB","secondary":"#RRGGBB"}. Use 6-digit hex only.`;

async function askClaude(bytes: Uint8Array, mime: string): Promise<CardColour | null> {
  if (!ANTHROPIC_API_KEY) return null;
  const claude = new Anthropic({ apiKey: ANTHROPIC_API_KEY, timeout: 20_000, maxRetries: 1 });
  const response = await claude.messages.create({
    model: MODEL,
    max_tokens: 100,
    system: SYSTEM,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mime as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data: encodeBase64(bytes) } },
        { type: "text", text: "Choose the card colours for this shop logo." },
      ],
    }],
  });
  const out = response.content.find((b: { type: string }) => b.type === "text") as { text?: string } | undefined;
  return out?.text ? parseAiColour(out.text) : null;
}

function decodePixels(bytes: Uint8Array, mime: string): Uint8Array | null {
  try {
    if (mime === "image/png") {
      const png = UPNG.decode(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      if (png.width * png.height > 16_000_000) return null;
      return new Uint8Array(UPNG.toRGBA8(png)[0]);
    }
    if (mime === "image/jpeg") {
      return jpeg.decode(bytes, { useTArray: true, maxResolutionInMP: 16 }).data;
    }
  } catch { /* fall through to default */ }
  return null; // webp / gif cannot be decoded here
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
    const { data: business } = await admin.from("businesses").select("id, owner_id, logo_url").eq("id", businessId).maybeSingle();
    if (!business) return reply({ error: "business not found" }, 404);
    if (business.owner_id !== callerId) {
      const { data: isAdmin } = await admin.rpc("has_role", { _user_id: callerId, _role: "admin" });
      if (!isAdmin) return reply({ error: "forbidden" }, 403);
    }

    const { data: withinBurst } = await authed.rpc("check_rate_limit", { _action: "card_colour", _limit: 6, _window_seconds: 60 });
    if (!withinBurst) return reply({ error: "Too many tries. Give it a few seconds." }, 429);
    const { data: withinDay } = await authed.rpc("check_daily_limit", { _action: "card_colour_daily", _limit: 40 });
    if (!withinDay) return reply({ error: "That's the limit for today. Try again tomorrow." }, 429);

    const fallback = (source: ColourSource, c: CardColour = finalise(FALLBACK_COLOUR)) => reply({ ...c, source });

    // Only our own public logo bucket is fetched (no caller-supplied URLs).
    const url = typeof business.logo_url === "string" ? business.logo_url : "";
    if (!url.startsWith(LOGO_PREFIX)) return fallback("default");

    let bytes: Uint8Array;
    let mime: string;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      mime = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (!res.ok || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mime)) return fallback("default");
      bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length > MAX_BYTES) return fallback("default");
    } catch {
      return fallback("default");
    }

    try {
      const ai = await askClaude(bytes, mime);
      if (ai) return reply({ ...ai, source: "ai" });
    } catch (e) {
      console.error("suggest-card-colour ai failed", e instanceof Error ? e.message : "unknown");
    }

    const pixels = decodePixels(bytes, mime);
    return pixels ? fallback("extracted", dominantColour(pixels)) : fallback("default");
  } catch (e) {
    console.error("suggest-card-colour error", e instanceof Error ? e.message : "unknown");
    return reply({ error: "Something went wrong." }, 500);
  }
});
