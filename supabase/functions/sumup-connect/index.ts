// Owner starts or ends the SumUp till link. JWT-required; the caller must own
// the business (or be an admin) - checked here, not implied by the JWT.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildAuthorizeUrl } from "../_shared/sumup.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("SUMUP_CLIENT_ID");

const cors = {
  "Access-Control-Allow-Origin": "https://www.the-loyalty-loop.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: userData, error: userError } = await admin.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
    if (userError || !userData?.user) return reply({ error: "unauthorized" }, 401);
    const callerId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const businessId = typeof body.business_id === "string" ? body.business_id : "";
    const action = body.action;
    if (!businessId || (action !== "start" && action !== "disconnect")) {
      return reply({ error: "invalid_request" }, 400);
    }

    const { data: business } = await admin
      .from("businesses")
      .select("id, owner_id, reward_model")
      .eq("id", businessId)
      .maybeSingle();
    if (!business) return reply({ error: "not_found" }, 404);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (business.owner_id !== callerId && isAdmin !== true) return reply({ error: "forbidden" }, 403);

    if (action === "disconnect") {
      const { error } = await admin.from("pos_connections").delete().eq("business_id", businessId).eq("provider", "sumup");
      if (error) return reply({ error: "server_error" }, 500);
      // Scans still waiting have nothing left to match.
      await admin.from("pos_scans").update({ status: "expired" }).eq("business_id", businessId).eq("status", "pending");
      return reply({ status: "disconnected" });
    }

    if (business.reward_model !== "spend_threshold") return reply({ error: "shop_not_spend_based" }, 409);
    if (!CLIENT_ID || !Deno.env.get("SUMUP_CLIENT_SECRET")) return reply({ error: "sumup_not_configured" }, 503);

    // Old unused states for this owner are dropped so the table cannot grow.
    await admin.from("pos_oauth_states").delete().lt("expires_at", new Date().toISOString());
    const { data: state, error: stateError } = await admin
      .from("pos_oauth_states")
      .insert({ business_id: businessId, user_id: callerId, provider: "sumup" })
      .select("state")
      .single();
    if (stateError || !state) return reply({ error: "server_error" }, 500);

    const redirectUri = `${SUPABASE_URL}/functions/v1/sumup-callback`;
    return reply({ url: buildAuthorizeUrl(CLIENT_ID, redirectUri, state.state) });
  } catch {
    return reply({ error: "server_error" }, 500);
  }
});
