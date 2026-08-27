import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "npm:jose@5";

// Pushes a customer's current stamp/points balance to their already-saved
// Google Wallet pass. create-wallet-pass only writes the loyalty object once,
// at save time — Google Wallet doesn't poll for changes, so without this the
// pass in someone's wallet just goes stale after every subsequent stamp or
// reward. Called fire-and-forget by the owner/staff app right after awarding
// progress or redeeming a reward, the same way send-user-push is.
//
// If the customer never added the pass to begin with, the PATCH 404s and
// this is a silent no-op — nothing to update.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WALLET_KEY_JSON = Deno.env.get("GOOGLE_WALLET_SERVICE_ACCOUNT_KEY");
const ISSUER_ID = Deno.env.get("GOOGLE_WALLET_ISSUER_ID") ?? "3388000000023187932";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function loyaltyUnitLabel(loyaltyType: string | null | undefined) {
  if (loyaltyType === "points") return "Points";
  if (loyaltyType === "tiered") return "Visits";
  return "Stamps";
}

async function getAccessToken(key: { client_email: string; private_key: string }): Promise<string> {
  const privateKey = await importPKCS8(key.private_key, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/wallet_object.issuer",
    aud: "https://oauth2.googleapis.com/token",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(key.client_email)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`Google OAuth token exchange failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  try {
    if (!WALLET_KEY_JSON) {
      return new Response(JSON.stringify({ updated: false, reason: "Google Wallet is not configured" }), { headers: jsonHeaders });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing authorization" }), { status: 401, headers: jsonHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const businessId = typeof body.business_id === "string" ? body.business_id : "";
    const userId = typeof body.user_id === "string" ? body.user_id : "";
    if (!businessId || !userId) {
      return new Response(JSON.stringify({ error: "business_id and user_id are required" }), { status: 400, headers: jsonHeaders });
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerErr } = await userClient.auth.getUser();
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: "invalid session" }), { status: 401, headers: jsonHeaders });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const [{ data: business }, { data: staff }] = await Promise.all([
      admin.from("businesses").select("owner_id,loyalty_type,loyalty_config").eq("id", businessId).maybeSingle(),
      admin.from("staff_members").select("id").eq("business_id", businessId).eq("user_id", caller.id).eq("status", "active").maybeSingle(),
    ]);
    if (!business || (business.owner_id !== caller.id && !staff)) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: jsonHeaders });
    }

    const { data: membership } = await admin
      .from("memberships")
      .select("stamp_count,points_balance")
      .eq("user_id", userId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ updated: false, reason: "no membership" }), { headers: jsonHeaders });
    }

    const stampsRequired = (business.loyalty_config as { stamps_required?: number } | null)?.stamps_required ?? 10;
    const unitLabel = loyaltyUnitLabel(business.loyalty_type);
    const value = business.loyalty_type === "points" ? membership.points_balance : membership.stamp_count;

    const objectId = `${ISSUER_ID}.mem_${businessId.replace(/-/g, "")}_${userId.replace(/-/g, "")}`;

    const key = JSON.parse(WALLET_KEY_JSON) as { client_email: string; private_key: string };
    const accessToken = await getAccessToken(key);

    const patchRes = await fetch(`https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${objectId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        loyaltyPoints: { label: unitLabel, balance: { string: String(value) } },
        textModulesData: [
          { header: "Goal", body: `${stampsRequired} ${unitLabel.toLowerCase()} to unlock your reward`, id: "goal" },
        ],
      }),
    });

    if (patchRes.status === 404) {
      return new Response(JSON.stringify({ updated: false, reason: "pass not saved yet" }), { headers: jsonHeaders });
    }
    if (!patchRes.ok) {
      const errorText = await patchRes.text();
      console.error("wallet object patch failed", patchRes.status, errorText);
      return new Response(JSON.stringify({ updated: false, reason: "wallet update rejected" }), { headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ updated: true }), { headers: jsonHeaders });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "internal error" }), { status: 500, headers: jsonHeaders });
  }
});
