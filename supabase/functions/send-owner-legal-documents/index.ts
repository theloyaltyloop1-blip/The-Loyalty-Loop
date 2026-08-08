import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

function safeOrigin(value: string | null) {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" || url.hostname === "localhost" ? url.origin : null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) throw new Error("Missing authorization");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user?.email) throw new Error("Not authenticated");

    const { data: ownerRole } = await admin.from("user_roles").select("user_id").eq("user_id", user.id).eq("role", "business_owner").maybeSingle();
    if (!ownerRole) throw new Error("Owner account required");

    const { data: sent } = await admin.from("owner_legal_document_emails").select("user_id").eq("user_id", user.id).maybeSingle();
    if (sent) return new Response(JSON.stringify({ sent: false, reason: "already_sent" }), { headers: { ...cors, "Content-Type": "application/json" } });

    const appUrl = safeOrigin(req.headers.get("origin"));
    if (!appUrl) throw new Error("A secure website origin is required");
    const documents = [
      ["Merchant Agreement", "/legal/merchant-agreement"],
      ["Data Processing Addendum", "/legal/data-processing"],
      ["Terms of Service", "/legal/terms"],
      ["Privacy Notice", "/legal/privacy"],
      ["Cookie Policy", "/legal/cookies"],
      ["Acceptable Use Policy", "/legal/acceptable-use"],
    ];
    const links = documents.map(([title, path]) => `<li style="margin:0 0 10px"><a href="${appUrl}${path}" style="color:#C06E28;font-weight:700">${title}</a></li>`).join("");
    const html = `<!doctype html><html><body style="margin:0;background:#F8EAD0;color:#332B26;font-family:Arial,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:white;border:1px solid #E2D1B8;border-radius:16px"><tr><td style="height:6px;background:#4F6438"></td></tr><tr><td style="padding:36px"><h1 style="margin:0 0 16px;color:#4F6438;font-family:Georgia,serif">Your owner legal documents</h1><p style="line-height:1.6">Welcome to The Loyalty Loop. Please keep a copy of the documents that apply to your business account. You can always find the current versions in the footer of the website.</p><ul style="padding-left:20px;line-height:1.6">${links}</ul><p style="line-height:1.6;color:#665C54">By operating your shop through The Loyalty Loop, you agree to the Merchant Agreement and Data Processing Addendum, alongside the Terms of Service and Privacy Notice.</p></td></tr></table></td></tr></table></body></html>`;
    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) throw new Error("Email is not configured");
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: Deno.env.get("RESEND_FROM_EMAIL") ?? "The Loyalty Loop <onboarding@resend.dev>", to: [user.email], subject: "Your Loyalty Loop owner legal documents", html }) });
    if (!response.ok) throw new Error("Email provider rejected the message");
    const { error: recordError } = await admin.from("owner_legal_document_emails").insert({ user_id: user.id, email: user.email });
    if (recordError) throw recordError;
    return new Response(JSON.stringify({ sent: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Email failed" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
