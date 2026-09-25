import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendPendingPushes } from "../_shared/push.ts";
import { supabasePushStore } from "../_shared/push-store.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: jsonHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "missing authorization" }), { status: 401, headers: jsonHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return new Response(JSON.stringify({ error: "not authenticated" }), { status: 401, headers: jsonHeaders });

    const body = await req.json().catch(() => ({}));
    const recipientId = typeof body.user_id === "string" ? body.user_id : "";
    const businessId = typeof body.business_id === "string" ? body.business_id : "";
    if (!recipientId || !businessId) return new Response(JSON.stringify({ error: "user_id and business_id are required" }), { status: 400, headers: jsonHeaders });

    const [{ data: business }, { data: staff }] = await Promise.all([
      admin.from("businesses").select("owner_id").eq("id", businessId).single(),
      admin.from("staff_members").select("id,can_scan_stamps,can_redeem_rewards").eq("business_id", businessId).eq("user_id", user.id).eq("status", "active").or("can_scan_stamps.eq.true,can_redeem_rewards.eq.true").maybeSingle(),
    ]);
    if (!business || (business.owner_id !== user.id && !staff)) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: jsonHeaders });
    }

    // Sends every recent unsent notification for this customer at this shop
    // (e.g. a reward and a progress update from one purchase), not just the latest.
    const result = await sendPendingPushes(supabasePushStore(admin), fetch, recipientId, businessId);
    return new Response(JSON.stringify({ ...result, sent: result.sent > 0, sentCount: result.sent }), { headers: jsonHeaders });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "internal error" }), { status: 500, headers: jsonHeaders });
  }
});
