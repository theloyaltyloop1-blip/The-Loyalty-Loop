import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Admin-only health report. It never returns secret values: only whether each
// expected integration secret exists, database reachability, and recent email
// failures. This is deliberately a read-only diagnostic endpoint.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const headers = { ...corsHeaders, "Content-Type": "application/json" };

type Check = { label: string; ok: boolean; detail: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const auth = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: user, error: userError } = await auth.auth.getUser(jwt);
    if (userError || !user.user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers });

    const { error: dbError } = await admin.from("businesses").select("id", { head: true, count: "exact" });
    const sevenDays = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: emailFailures, error: emailError } = await admin
      .from("winback_email_log").select("id", { head: true, count: "exact" })
      .eq("status", "failed").gte("sent_at", sevenDays);
    const checks: Check[] = [
      { label: "Database", ok: !dbError, detail: dbError ? dbError.message : "Supabase database reachable" },
      { label: "Resend", ok: Boolean(Deno.env.get("RESEND_API_KEY")), detail: Deno.env.get("RESEND_API_KEY") ? "Email secret configured" : "RESEND_API_KEY is missing" },
      { label: "Groq AI", ok: Boolean(Deno.env.get("GROQ_API_KEY")), detail: Deno.env.get("GROQ_API_KEY") ? "AI secret configured" : "GROQ_API_KEY is missing" },
      { label: "Firecrawl", ok: Boolean(Deno.env.get("FIRECRAWL_API_KEY")), detail: Deno.env.get("FIRECRAWL_API_KEY") ? "Research secret configured" : "FIRECRAWL_API_KEY is missing" },
      { label: "Recent email delivery", ok: !emailError && (emailFailures ?? 0) === 0, detail: emailError ? emailError.message : emailFailures ? `${emailFailures} failed win-back email(s) in the last 7 days` : "No failed win-back emails in the last 7 days" },
      { label: "Scheduled jobs", ok: false, detail: "No cron jobs configured yet" },
    ];
    return new Response(JSON.stringify({ checks }), { headers });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "health check failed" }), { status: 500, headers });
  }
});
