// Scheduled sync of every connected shop's till sales. Service role only:
// called by a scheduled job, never by the app.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { syncConnection, type PosConnection } from "../_shared/pos-sync.ts";
import { posDb } from "../_shared/pos-sync-db.ts";

const encoder = new TextEncoder();

function sameSecret(expected: string, received: string): boolean {
  const left = encoder.encode(expected);
  const right = encoder.encode(received);
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

Deno.serve(async (request) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (request.method !== "POST" || !serviceKey || !sameSecret(serviceKey, token)) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }
  const clientId = Deno.env.get("SUMUP_CLIENT_ID");
  const clientSecret = Deno.env.get("SUMUP_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: "sumup_not_configured" }), { status: 503 });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await admin
    .from("pos_connections")
    .select("id, business_id, merchant_code, access_token, refresh_token, token_expires_at, sync_cursor")
    .eq("provider", "sumup")
    .eq("status", "active");
  if (error) return new Response(JSON.stringify({ error: "server_error" }), { status: 500 });

  const db = posDb(admin);
  let synced = 0;
  let failed = 0;
  for (const row of data ?? []) {
    const conn: PosConnection = {
      id: row.id,
      businessId: row.business_id,
      merchantCode: row.merchant_code,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      tokenExpiresAt: Date.parse(row.token_expires_at),
      syncCursor: row.sync_cursor ? Date.parse(row.sync_cursor) : null,
    };
    try {
      const summary = await syncConnection({ db, fetch, now: Date.now(), clientId, clientSecret }, conn);
      if (summary.errors.length) failed += 1;
      else synced += 1;
    } catch {
      // One shop's failure must never stop the others. No details are logged:
      // they could contain customer or sale data.
      failed += 1;
    }
  }
  return new Response(JSON.stringify({ synced, failed }), { headers: { "Content-Type": "application/json" } });
});
