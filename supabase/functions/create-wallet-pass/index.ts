import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "npm:jose@5";

// Generates a "Save to Google Wallet" link for a customer's loyalty card at
// a given business. Builds the loyalty class + object payloads inline in a
// signed JWT (Google creates/updates them on save) rather than pre-creating
// them via separate REST calls — simpler and avoids a class/object existing
// out of sync with the JWT.
//
// Requires the GOOGLE_WALLET_SERVICE_ACCOUNT_KEY secret: the full JSON key
// downloaded for the wallet-issuer service account in Cloud Console, which
// must also be registered as a "Developer" user in the Google Pay & Wallet
// Console for the issuer account that owns GOOGLE_WALLET_ISSUER_ID.
//
// The wallet-issuer account has publishing access (approved by Google on
// 2026-08-13), so classes are created as "approved" and work for any real
// customer — not just accounts registered as demo-mode testers.

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
      .select("id,name,brand_color,logo_url,loyalty_type,loyalty_config")
      .eq("id", business_id)
      .maybeSingle();
    if (bizErr) throw bizErr;
    if (!business) {
      return new Response(JSON.stringify({ error: "shop not found" }), { status: 404, headers: jsonHeaders });
    }

    const { data: membership, error: memErr } = await admin
      .from("memberships")
      .select("stamp_count,points_balance")
      .eq("user_id", user.id)
      .eq("business_id", business_id)
      .maybeSingle();
    if (memErr) throw memErr;
    if (!membership) {
      return new Response(JSON.stringify({ error: "join this shop's loyalty card first" }), { status: 400, headers: jsonHeaders });
    }

    const stampsRequired = (business.loyalty_config as { stamps_required?: number } | null)?.stamps_required ?? 10;
    const unitLabel = loyaltyUnitLabel(business.loyalty_type);
    const value = business.loyalty_type === "points" ? membership.points_balance : membership.stamp_count;

    const classId = `${ISSUER_ID}.biz_${business.id.replace(/-/g, "")}`;
    const objectId = `${ISSUER_ID}.mem_${business.id.replace(/-/g, "")}_${user.id.replace(/-/g, "")}`;
    const firstName = (user.user_metadata as Record<string, unknown> | null)?.first_name as string | undefined;

    // programLogo is required by the Wallet API — a class can't be created
    // without one, so fall back to the platform's own logo when the shop
    // hasn't uploaded a logo of their own.
    const logoUri = business.logo_url || "https://www.the-loyalty-loop.com/logo-for-emails.png";

    const loyaltyClass = {
      id: classId,
      issuerName: business.name,
      programName: `${unitLabel === "Points" ? "Points" : unitLabel === "Visits" ? "Visits" : "Stamp"} Card`,
      reviewStatus: "approved",
      hexBackgroundColor: business.brand_color || "#E8703B",
      programLogo: { sourceUri: { uri: logoUri }, contentDescription: { defaultValue: { language: "en", value: `${business.name} logo` } } },
    };

    const loyaltyObject = {
      id: objectId,
      classId,
      state: "active",
      accountId: user.id,
      accountName: firstName || "Loyalty Loop member",
      loyaltyPoints: {
        label: unitLabel,
        balance: { string: String(value) },
      },
      textModulesData: [
        { header: "Goal", body: `${stampsRequired} ${unitLabel.toLowerCase()} to unlock your reward`, id: "goal" },
      ],
      barcode: {
        type: "QR_CODE",
        value: `loyaltyloop:customer:${user.id}`,
      },
    };

    const key = JSON.parse(WALLET_KEY_JSON) as { client_email: string; private_key: string };
    const privateKey = await importPKCS8(key.private_key, "RS256");

    const jwt = await new SignJWT({
      iss: key.client_email,
      aud: "google",
      typ: "savetowallet",
      iat: Math.floor(Date.now() / 1000),
      origins: [],
      payload: {
        loyaltyClasses: [loyaltyClass],
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
