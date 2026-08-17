import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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
      admin.from("staff_members").select("id").eq("business_id", businessId).eq("user_id", user.id).eq("status", "active").eq("can_scan_stamps", true).maybeSingle(),
    ]);
    if (!business || (business.owner_id !== user.id && !staff)) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: jsonHeaders });
    }

    const { data: notification } = await admin
      .from("notifications")
      .select("id,kind,title,body,push_sent_at")
      .eq("user_id", recipientId)
      .eq("business_id", businessId)
      .is("push_sent_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!notification) return new Response(JSON.stringify({ sent: false, reason: "no pending notification" }), { headers: jsonHeaders });

    const { data: settings } = await admin
      .from("user_settings")
      .select("notify_stamps,notify_rewards,notify_offers")
      .eq("user_id", recipientId)
      .maybeSingle();
    const enabled = notification.kind === "stamp" ? settings?.notify_stamps !== false
      : notification.kind === "reward" ? settings?.notify_rewards !== false
      : notification.kind === "promo" ? settings?.notify_offers !== false
      : true;
    if (!enabled) return new Response(JSON.stringify({ sent: false, reason: "recipient opted out" }), { headers: jsonHeaders });

    const { data: tokens } = await admin.from("push_tokens").select("token").eq("user_id", recipientId);
    if (!tokens?.length) return new Response(JSON.stringify({ sent: false, reason: "no registered device" }), { headers: jsonHeaders });

    const expoResponse = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(tokens.map(({ token }) => ({ to: token, sound: "default", title: notification.title, body: notification.body ?? "", data: { notificationId: notification.id, businessId } }))),
    });
    if (!expoResponse.ok) {
      await admin.from("notifications").update({ push_error: "Expo Push Service rejected the request" }).eq("id", notification.id);
      return new Response(JSON.stringify({ error: "push provider rejected the request" }), { status: 502, headers: jsonHeaders });
    }

    const payload = await expoResponse.json() as { data?: Array<{ status?: string; details?: { error?: string } }> };
    const errors = payload.data?.filter((item) => item.status !== "ok").map((item) => item.details?.error).filter(Boolean) ?? [];
    await admin.from("notifications").update({ push_sent_at: new Date().toISOString(), push_error: errors.join(", ") || null }).eq("id", notification.id);
    return new Response(JSON.stringify({ sent: true, deliveryErrors: errors.length }), { headers: jsonHeaders });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "internal error" }), { status: 500, headers: jsonHeaders });
  }
});
