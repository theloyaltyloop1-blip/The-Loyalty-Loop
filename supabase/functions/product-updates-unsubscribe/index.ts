import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifyUnsubscribe } from "../_shared/release-email.ts";

// Public (verify_jwt = false). Opts a user out of product-news emails.
// Authenticated by an HMAC token in the link, which only ever means "this user
// may opt out of product news", so a leaked link can do nothing else.
// POST only: the website /unsubscribe page posts here after a button press,
// and mail apps post here for RFC 8058 one-click (List-Unsubscribe-Post).
// A GET does nothing, so link scanners can't unsubscribe people.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.the-loyalty-loop.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const headers = { ...corsHeaders, "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "method not allowed" }, 405);
  try {
    const url = new URL(req.url);
    let u = url.searchParams.get("u") ?? "";
    let t = url.searchParams.get("t") ?? "";
    if ((!u || !t) && (req.headers.get("content-type") ?? "").includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      u = String(body.u ?? "");
      t = String(body.t ?? "");
    }
    if (!(await verifyUnsubscribe(u, t, SERVICE_ROLE_KEY))) return reply({ error: "This unsubscribe link isn't valid." }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { error } = await admin.from("profiles").update({ product_updates_opted_out: true }).eq("id", u);
    if (error) throw error;
    return reply({ ok: true });
  } catch (e) {
    console.error(e);
    return reply({ error: "internal error" }, 500);
  }
});
