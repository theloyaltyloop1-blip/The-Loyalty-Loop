import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Fires right after an owner submits the sign-up form (see Signup.tsx),
// before email confirmation — there is no session/JWT to check at that
// point, so this is intentionally public (verify_jwt: false). To stop it
// being abused as an arbitrary "send mail to anyone" endpoint, it only ever
// sends to an email address that genuinely just registered with owner
// intent: it looks the address up via the service role and requires the
// auth.users row to (a) exist, (b) carry intent = 'business_owner' in its
// signup metadata, and (c) have been created within the last 15 minutes.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "The Loyalty Loop <onboarding@resend.dev>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const DOCUMENTS = [
  { file: "terms-of-service.pdf", label: "Terms of Service" },
  { file: "privacy-notice.pdf", label: "Privacy Notice" },
  { file: "cookie-policy.pdf", label: "Cookie Policy" },
  { file: "merchant-agreement.pdf", label: "Merchant Agreement" },
  { file: "data-processing-addendum.pdf", label: "Data Processing Addendum" },
  { file: "acceptable-use-policy.pdf", label: "Acceptable Use Policy" },
];

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const email = (body.email as string | undefined)?.trim().toLowerCase();
    const siteUrl = body.site_url as string | undefined;

    if (!email || !siteUrl || !/^https?:\/\//.test(siteUrl)) {
      return new Response(JSON.stringify({ error: "email and site_url are required" }), { status: 400, headers: jsonHeaders });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Confirm this is a genuine, very recent owner signup — not an arbitrary
    // address someone is trying to spam via this endpoint.
    const { data: page, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) throw listErr;
    const user = page.users.find((u) => u.email?.toLowerCase() === email);
    if (!user) {
      return new Response(JSON.stringify({ sent: false, reason: "unknown account" }), { status: 200, headers: jsonHeaders });
    }
    const intent = (user.user_metadata as Record<string, unknown> | null)?.intent;
    const createdAt = new Date(user.created_at).getTime();
    const isFresh = Date.now() - createdAt < 15 * 60 * 1000;
    if (intent !== "business_owner" || !isFresh) {
      return new Response(JSON.stringify({ sent: false, reason: "not a fresh owner signup" }), { status: 200, headers: jsonHeaders });
    }

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ sent: false, reason: "Email not configured" }), { headers: jsonHeaders });
    }

    const firstName = (user.user_metadata as Record<string, unknown> | null)?.first_name as string | undefined;
    const greeting = firstName ? escapeHtml(firstName) : "there";

    const attachments = await Promise.all(
      DOCUMENTS.map(async (doc) => {
        const res = await fetch(`${siteUrl.replace(/\/$/, "")}/legal/${doc.file}`);
        if (!res.ok) throw new Error(`Could not fetch ${doc.file}`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        return { filename: doc.file, content: bytesToBase64(bytes) };
      })
    );

    const listHtml = DOCUMENTS.map((d) => `<li style="margin-bottom:4px;">${escapeHtml(d.label)}</li>`).join("");

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#F7ECDC;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#FBF6EC;border-radius:16px;overflow:hidden;border:1px solid #ECD9BC;">
        <tr><td style="background:#E8703B;height:6px;"></td></tr>
        <tr><td style="padding:32px 32px 8px 32px;">
          <h1 style="font-size:22px;margin:0 0 12px 0;color:#1a1a1a;">Welcome to The Loyalty Loop, ${greeting}!</h1>
          <p style="font-size:14px;line-height:1.6;color:#4a4a4a;margin:0 0 16px 0;">
            Thanks for signing up to run a shop on The Loyalty Loop. Attached to this email are the legal documents
            that apply to your account and, once you finish setting up your shop, to running a loyalty programme
            through the platform:
          </p>
          <ul style="font-size:14px;line-height:1.6;color:#1a1a1a;padding-left:20px;margin:0 0 20px 0;">
            ${listHtml}
          </ul>
          <p style="font-size:14px;line-height:1.6;color:#4a4a4a;margin:0 0 8px 0;">
            You can also find these any time in the footer of the site. Confirm your email to finish signing in and
            set up your first shop — it goes live the moment you're done, no waiting for approval.
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px 32px 32px;font-size:12px;color:#8a7e72;">
          You're receiving this because you signed up for a business account at The Loyalty Loop.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [email],
        subject: "Welcome to The Loyalty Loop — your legal documents",
        html,
        attachments,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error(errText);
      return new Response(JSON.stringify({ sent: false, reason: "Email provider rejected the message", debug: errText, fromUsed: RESEND_FROM_EMAIL }), { status: 502, headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ sent: true }), { headers: jsonHeaders });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "internal error" }), { status: 500, headers: jsonHeaders });
  }
});
