// Called by the scan screen while it waits for a customer's payment, so the sale
// is picked up within seconds instead of at the next scheduled sync. JWT-required;
// the caller must be allowed to record spend at that shop. Runs the same sync pass
// as the schedule for that one shop, at most once every 3 seconds.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { syncConnection } from "../_shared/pos-sync.ts";
import { posDb } from "../_shared/pos-sync-db.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: userData, error: userError } = await admin.auth.getUser(jwt);
    if (userError || !userData?.user) return reply({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const businessId = typeof body.business_id === "string" ? body.business_id : "";
    if (!businessId) return reply({ error: "invalid_request" }, 400);

    const { data: allowed } = await admin.rpc("can_record_manual_spend", {
      _business_id: businessId,
      _user_id: userData.user.id,
    });
    if (allowed !== true) return reply({ error: "forbidden" }, 403);

    const clientId = Deno.env.get("SUMUP_CLIENT_ID");
    const clientSecret = Deno.env.get("SUMUP_CLIENT_SECRET");
    if (!clientId || !clientSecret) return reply({ error: "sumup_not_configured" }, 503);

    const { data: row } = await admin
      .from("pos_connections")
      .select("id, business_id, merchant_code, access_token, refresh_token, token_expires_at, sync_cursor, last_synced_at")
      .eq("business_id", businessId)
      .eq("provider", "sumup")
      .eq("status", "active")
      .maybeSingle();
    if (!row) return reply({ status: "not_connected" });

    // At most one check every 3 seconds per shop, however many screens are open.
    if (row.last_synced_at && Date.now() - Date.parse(row.last_synced_at) < 3000) {
      return reply({ status: "skipped" });
    }

    const summary = await syncConnection(
      { db: posDb(admin), fetch, now: Date.now(), clientId, clientSecret },
      {
        id: row.id,
        businessId: row.business_id,
        merchantCode: row.merchant_code,
        accessToken: row.access_token,
        refreshToken: row.refresh_token,
        tokenExpiresAt: Date.parse(row.token_expires_at),
        syncCursor: row.sync_cursor ? Date.parse(row.sync_cursor) : null,
      },
    );
    return reply({ status: "checked", matched: summary.matched, errors: summary.errors.length });
  } catch {
    return reply({ error: "server_error" }, 500);
  }
});
