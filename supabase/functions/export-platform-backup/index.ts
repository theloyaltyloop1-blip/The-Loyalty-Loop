import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// This creates a recovery archive of the application's public data. It is
// intentionally admin-only and never exports passwords, database credentials,
// service secrets, or Storage object bytes.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAGE_SIZE = 1_000;
const MAX_ROWS_PER_TABLE = 100_000;
// Recovery-minimised data set. It restores the customer/shop/loyalty service
// but excludes chat messages, push tokens, support messages, rate-limit logs,
// research, audit events and other data not needed to restart the platform.
const BACKUP_TABLES = [
  "profiles", "user_roles", "user_settings", "businesses", "reward_catalog",
  "memberships", "transactions", "rewards", "announcements", "reviews",
  "review_replies", "staff_members", "favourites", "business_photos",
  "referral_codes", "referrals", "legal_acceptances", "platform_announcements",
  "business_promotions", "brands", "brand_members", "brand_handoffs",
  "business_feature_settings",
] as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const headers = { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" };

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace("Bearer ", "");
  const auth = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data, error } = await auth.auth.getUser(jwt);
  if (error || !data.user) throw new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
  if (!isAdmin) throw new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers });
  return { admin, userId: data.user.id };
}

async function readAllRows(admin: ReturnType<typeof createClient>, table: string) {
  const rows: unknown[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await admin.from(table).select("*").range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Could not read ${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (rows.length > MAX_ROWS_PER_TABLE) throw new Error(`${table} is too large for a browser download. Use an off-site automated backup instead.`);
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers });

  try {
    const { admin, userId } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));

    if (body.action === "confirm_download") {
      const backupId = typeof body.backup_id === "string" ? body.backup_id : "";
      if (!backupId) return new Response(JSON.stringify({ error: "backup_id required" }), { status: 400, headers });
      const { error } = await admin.from("admin_laptop_backups")
        .update({ status: "download_confirmed", download_confirmed_at: new Date().toISOString() })
        .eq("id", backupId).eq("created_by", userId);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers });
    }

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count, error: rateError } = await admin.from("admin_laptop_backups")
      .select("id", { count: "exact", head: true }).eq("created_by", userId).gte("created_at", fifteenMinutesAgo);
    if (rateError) throw rateError;
    if ((count ?? 0) > 0) return new Response(JSON.stringify({ error: "For safety, wait 15 minutes before creating another laptop backup." }), { status: 429, headers });

    const tables: Record<string, unknown[]> = {};
    let recordCount = 0;
    for (const table of BACKUP_TABLES) {
      const rows = await readAllRows(admin, table);
      tables[table] = rows;
      recordCount += rows.length;
    }

    const archive = {
      format: "the-loyalty-loop-application-backup",
      format_version: 1,
      created_at: new Date().toISOString(),
      recovery_notes: "Recovery-minimised application data only. Password hashes, service secrets, database roles, Storage file bytes, WhatsApp conversations, push tokens, support requests and audit logs are intentionally not included.",
      tables,
    };
    const archiveBytes = new TextEncoder().encode(JSON.stringify(archive)).byteLength;
    const { data: backup, error: backupError } = await admin.from("admin_laptop_backups")
      .insert({ created_by: userId, table_count: BACKUP_TABLES.length, record_count: recordCount, archive_bytes: archiveBytes })
      .select("id, created_at, table_count, record_count, archive_bytes, format_version, status")
      .single();
    if (backupError) throw backupError;

    return new Response(JSON.stringify({ backup, archive }), { headers });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "backup export failed" }), { status: 500, headers });
  }
});
