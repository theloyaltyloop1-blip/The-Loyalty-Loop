import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = (Deno.env.get("APP_BASE_URL") ?? "https://www.the-loyalty-loop.com").replace(/\/$/, "");
const DISPLAY_NUMBER = (Deno.env.get("META_WHATSAPP_DISPLAY_NUMBER") ?? "").replace(/\D/g, "");

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const allowed = origin === APP_URL || /^https?:\/\/localhost(?::\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : APP_URL,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request: Request) => {
  const cors = corsHeaders(request);
  const headers = { ...cors, "Content-Type": "application/json" };
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers });

  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token : "";
    const action = body.action === "card" ? "card" : body.action === "start" ? "start" : "signup";
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    if (action === "start") {
      const shop = typeof body.shop === "string" ? body.shop.trim().toLowerCase() : "";
      if (!DISPLAY_NUMBER || !/^[a-z0-9][a-z0-9-]{0,100}$/.test(shop)) {
        return new Response(JSON.stringify({ error: "WhatsApp onboarding is not configured for this QR code yet." }), { status: 400, headers });
      }
      const { data: business } = await admin.from("businesses")
        .select("id")
        .eq("slug", shop)
        .eq("is_active", true)
        .eq("approval_status", "approved")
        .maybeSingle();
      if (!business) return new Response(JSON.stringify({ error: "This shop is no longer available." }), { status: 404, headers });
      return new Response(JSON.stringify({ url: `https://wa.me/${DISPLAY_NUMBER}?text=${encodeURIComponent(`START ${shop}`)}` }), { headers });
    }

    if (token.length < 32 || token.length > 200) {
      return new Response(JSON.stringify({ error: "This link is invalid or has expired." }), { status: 400, headers });
    }
    const { data: link, error } = await admin.from("whatsapp_handoff_links")
      .select("link_type,user_id,business_id,expected_email,first_name,expires_at,claimed_at,business:businesses(name,slug)")
      .eq("token_hash", await hashToken(token))
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error) throw error;
    if (!link || link.link_type !== action || (action === "signup" && link.claimed_at)) {
      return new Response(JSON.stringify({ error: "This link has expired. Return to WhatsApp and send START again." }), { status: 404, headers });
    }

    if (action === "signup") {
      return new Response(JSON.stringify({ kind: "signup", email: link.expected_email, firstName: link.first_name, business: link.business }), { headers });
    }

    const [{ data: profile }, { data: memberships, error: membershipsError }] = await Promise.all([
      admin.from("profiles").select("first_name,stamp_code").eq("id", link.user_id!).single(),
      admin.from("memberships").select("stamp_count,points_balance,visit_count,business:businesses(name,slug,loyalty_type)").eq("user_id", link.user_id!),
    ]);
    if (membershipsError) throw membershipsError;
    return new Response(JSON.stringify({
      kind: "card",
      customerCode: `loyaltyloop:customer:${link.user_id}`,
      manualCode: profile?.stamp_code ?? null,
      firstName: profile?.first_name ?? "Loyalty Loop member",
      memberships: memberships ?? [],
      appUrl: `${APP_URL}/dashboard`,
    }), { headers });
  } catch (error) {
    console.error("whatsapp-handoff", error instanceof Error ? error.message : "unknown error");
    return new Response(JSON.stringify({ error: "We could not open this WhatsApp link." }), { status: 500, headers });
  }
});
