import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const jsonHeaders = { ...cors, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authed = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Not authenticated");

    const { data: withinBurst } = await authed.rpc("check_rate_limit", { _action: "visit_thank_you", _limit: 20, _window_seconds: 60 });
    if (!withinBurst) {
      return new Response(JSON.stringify({ error: "Too many requests — please slow down." }), { status: 429, headers: jsonHeaders });
    }

    const { business_id, user_id, amount = 1 } = await req.json();
    const [{ data: business }, { data: member }, { data: profile }, { data: staff }] = await Promise.all([
      admin.from("businesses").select("name,owner_id").eq("id", business_id).single(),
      admin.from("memberships").select("promos_opted_out").eq("business_id", business_id).eq("user_id", user_id).single(),
      admin.from("profiles").select("email,first_name").eq("id", user_id).single(),
      admin.from("staff_members").select("id").eq("business_id", business_id).eq("user_id", user.id).eq("is_active", true).maybeSingle(),
    ]);
    if (!business || (business.owner_id !== user.id && !staff)) throw new Error("Not permitted");
    if (member?.promos_opted_out || !profile?.email) {
      return new Response(JSON.stringify({ sent: false }), { headers: jsonHeaders });
    }
    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) return new Response(JSON.stringify({ sent: false, reason: "Email not configured" }), { headers: jsonHeaders });

    const customerName = escapeHtml(profile.first_name ?? "there");
    const locationName = escapeHtml(business.name);
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Thank You!</title></head><body style="margin:0;padding:0;background-color:#F8EAD0;font-family:Georgia,'Times New Roman',serif;color:#333333;-webkit-font-smoothing:antialiased;"><table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F8EAD0;padding:40px 20px;"><tr><td align="center"><table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;background-color:#FFFFFF;border-radius:16px;border:1px solid #E2D1B8;box-shadow:0 8px 24px rgba(79,100,56,0.06);overflow:hidden;"><tr><td style="background-color:#4F6438;height:6px;width:100%;"></td></tr><tr><td align="center" style="padding:40px 40px 20px 40px;"><img src="https://www.the-loyalty-loop.com/logo-for-emails" alt="The Loyalty Loop" width="160" style="display:block;width:160px;max-width:100%;height:auto;"></td></tr><tr><td align="center" style="padding:0 40px 30px 40px;"><h1 style="color:#4F6438;font-size:28px;font-weight:normal;margin:0 0 16px 0;letter-spacing:.5px;">Thank You, ${customerName}!</h1><p style="color:#665C54;font-size:16px;line-height:1.6;margin:0 0 24px 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">We really appreciate you using our app during your visit to <strong style="color:#333333;">${locationName}</strong>. We hope you had a wonderful experience!</p><table border="0" cellpadding="0" cellspacing="0" style="background-color:#F8EAD0;border-radius:12px;border:1px solid #E2D1B8;"><tr><td align="center" style="padding:16px 28px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#C06E28;font-weight:600;letter-spacing:.5px;">ðŸ“ ${locationName}</td></tr></table></td></tr><tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #F0E4D2;margin:0;"></td></tr><tr><td align="center" style="padding:24px 40px 40px 40px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:#8A7E72;line-height:1.5;">See you again soon! If you have any feedback or questions, feel free to reach out to our team.</td></tr></table><table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;margin-top:20px;"><tr><td align="center" style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#8A7E72;line-height:1.4;">You received this email because you recently used our app at ${locationName}.</td></tr></table></td></tr></table></body></html>`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM_EMAIL") ?? "The Loyalty Loop <onboarding@resend.dev>",
        to: [profile.email],
        subject: `Thanks for visiting ${business.name}!`,
        html,
      }),
    });
    if (!response.ok) throw new Error("Email provider rejected the message");
    return new Response(JSON.stringify({ sent: true }), { headers: jsonHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Email failed" }), { status: 400, headers: jsonHeaders });
  }
});

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
