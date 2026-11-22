import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "npm:jose@5";
import { ensureLoyaltyClass, shopLoyaltyClass } from "../_shared/wallet-images.ts";
import { loadWalletExtras, loadWalletTiers, walletProgress } from "../_shared/wallet-progress.ts";

// Generates a "Save to Google Wallet" link for a customer's loyalty card at
// a given business. The loyalty class is created/updated via a real,
// synchronous REST call before every save — see ensureLoyaltyClass in _shared/wallet-images.ts for
// why that's required rather than just embedding it in the save JWT. Only
// the customer-specific loyalty object goes in the signed JWT.
//
// Requires the GOOGLE_WALLET_SERVICE_ACCOUNT_KEY secret: the full JSON key
// downloaded for the wallet-issuer service account in Cloud Console, which
// must also be registered as a "Developer" user in the Google Pay & Wallet
// Console for the issuer account that owns GOOGLE_WALLET_ISSUER_ID.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WALLET_KEY_JSON = Deno.env.get("GOOGLE_WALLET_SERVICE_ACCOUNT_KEY");
const ISSUER_ID = Deno.env.get("GOOGLE_WALLET_ISSUER_ID") ?? "3388000000023187932";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.the-loyalty-loop.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

// Setting reviewStatus: "approved" inline inside a savetowallet JWT does NOT
// make Google treat the class as approved at the moment it validates the
// accompanying object in that same request — confirmed directly against
// Google's own live API via the Wallet Console's "Make API Call" tool,
// which returned "Wallet Object Class {...} not approved" for a
// freshly-JWT-declared class, while the identical object payload saved fine
// against a class that already existed as APPROVED. Classes must be
// created (and thus actually approved) via a real, synchronous REST call
// before an object can reference them — only the object goes in the JWT.
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
      return new Response(JSON.stringify({ error: "Google Wallet is not configured" }), { status: 500, headers: jsonHeaders });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing authorization" }), { status: 401, headers: jsonHeaders });
    }

    const { business_id } = await req.json().catch(() => ({}));
    if (!business_id) {
      return new Response(JSON.stringify({ error: "business_id is required" }), { status: 400, headers: jsonHeaders });
    }

    // Client scoped to the caller's own JWT — RLS ensures they can only read
    // their own membership row and businesses they're allowed to see.
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "invalid session" }), { status: 401, headers: jsonHeaders });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: business, error: bizErr } = await admin
      .from("businesses")
      .select("id,name,brand_color,logo_url,cover_url,card_design,loyalty_type,loyalty_config,reward_model,reward_threshold_pence")
      .eq("id", business_id)
      .maybeSingle();
    if (bizErr) throw bizErr;
    if (!business) {
      return new Response(JSON.stringify({ error: "shop not found" }), { status: 404, headers: jsonHeaders });
    }

    const { data: membership, error: memErr } = await admin
      .from("memberships")
      .select("stamp_count,points_balance,reward_progress_pence,current_tier")
      .eq("user_id", user.id)
      .eq("business_id", business_id)
      .maybeSingle();
    if (memErr) throw memErr;
    if (!membership) {
      return new Response(JSON.stringify({ error: "join this shop's loyalty card first" }), { status: 400, headers: jsonHeaders });
    }

    const membershipExtras = await loadWalletExtras(admin, business.reward_model, user.id, business.id);
  const progress = walletProgress(business, { ...membership, ...membershipExtras }, await loadWalletTiers(admin, business.id, business.reward_model), business.name);

    const classId = `${ISSUER_ID}.biz_${business.id.replace(/-/g, "")}`;
    const objectId = `${ISSUER_ID}.mem_${business.id.replace(/-/g, "")}_${user.id.replace(/-/g, "")}`;
    const firstName = (user.user_metadata as Record<string, unknown> | null)?.first_name as string | undefined;

    // Branding (shop name, colour, padded logo, hero image) comes from the shop's
    // own design and lives on the shop's own class. See _shared/wallet-branding.ts.
    const loyaltyClass = await shopLoyaltyClass(admin, business, classId);

    const loyaltyObject = {
      id: objectId,
      classId,
      state: "active",
      accountId: user.id,
      accountName: firstName || "Member",
      loyaltyPoints: {
        label: progress.label,
        balance: { string: progress.value },
      },
      textModulesData: [
        { header: "Goal", body: progress.goal, id: "goal" },
      ],
      barcode: {
        type: "QR_CODE",
        value: `loyaltyloop:customer:${user.id}`,
      },
    };

    const key = JSON.parse(WALLET_KEY_JSON) as { client_email: string; private_key: string };

    const accessToken = await getAccessToken(key);
    await ensureLoyaltyClass(accessToken, classId, loyaltyClass);

    const privateKey = await importPKCS8(key.private_key, "RS256");

    const jwt = await new SignJWT({
      iss: key.client_email,
      aud: "google",
      typ: "savetowallet",
      iat: Math.floor(Date.now() / 1000),
      origins: [],
      payload: {
        loyaltyObjects: [loyaltyObject],
      },
    } as unknown as Record<string, unknown>)
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .sign(privateKey);

    return new Response(JSON.stringify({ saveUrl: `https://pay.google.com/gp/v/save/${jwt}` }), { headers: jsonHeaders });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "internal error" }), { status: 500, headers: jsonHeaders });
  }
});
