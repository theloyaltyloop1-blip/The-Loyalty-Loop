import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "npm:jose@5";

// Generates a "Save to Google Wallet" link for a customer's loyalty card at
// a given business. The loyalty class is created/updated via a real,
// synchronous REST call before every save — see ensureLoyaltyClass below for
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

// Google Wallet masks programLogo into a circle and requires it to be
// roughly square (min 660x660, 1:1) — a wide wordmark-style logo (which
// merchants naturally upload, since the same `logos` bucket is used as a
// general-purpose brand logo elsewhere in the app) makes Google's backend
// reject the whole pass with a generic "something went wrong" in the Wallet
// app. Sniff the image's real pixel dimensions from its header bytes (no
// decoding needed) so non-square logos can be routed to wideProgramLogo
// instead, which is built for exactly this shape.
async function sniffImageDimensions(url: string): Promise<{ width: number; height: number } | null> {
  const res = await fetch(url, { headers: { Range: "bytes=0-65535" } });
  if (!res.ok && res.status !== 206) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // PNG: 8-byte signature, then IHDR chunk with width/height as two
  // big-endian uint32s at bytes 16-23.
  if (bytes.length >= 24 && view.getUint32(0) === 0x89504e47) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  // JPEG: walk the marker segments looking for an SOFn (start of frame)
  // marker, which carries height/width as two big-endian uint16s.
  if (bytes.length >= 4 && view.getUint16(0) === 0xffd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSOF) {
        return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
      }
      offset += 2 + view.getUint16(offset + 2);
    }
  }

  return null;
}

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

// Makes sure the loyalty class exists and is up to date before any object
// is created against it — inserting it the first time a business's pass is
// requested, patching it on later requests to keep name/logo/color in sync.
async function ensureLoyaltyClass(accessToken: string, classId: string, loyaltyClass: Record<string, unknown>) {
  const base = "https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass";
  const getRes = await fetch(`${base}/${classId}`, { headers: { Authorization: `Bearer ${accessToken}` } });

  if (getRes.status === 200) {
    // Never re-send reviewStatus on an update — the class may already have
    // cleared review, and re-declaring it (approved or under-review) risks
    // exactly the kind of rejection this function exists to avoid.
    const { reviewStatus: _reviewStatus, ...patchableFields } = loyaltyClass as Record<string, unknown> & { reviewStatus?: string };
    const patchRes = await fetch(`${base}/${classId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(patchableFields),
    });
    if (!patchRes.ok) console.error("loyalty class patch failed", patchRes.status, await patchRes.text());
    return;
  }

  const insertRes = await fetch(base, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(loyaltyClass),
  });
  if (!insertRes.ok) throw new Error(`loyalty class insert failed: ${insertRes.status} ${await insertRes.text()}`);
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

    // programLogo is required by the Wallet API and must be roughly square —
    // fall back to the platform's own (square) logo when the shop hasn't
    // uploaded one, or when its logo turns out to be a wide/wordmark shape
    // Google would reject. A wide logo still gets shown via wideProgramLogo.
    const platformLogoUri = "https://www.the-loyalty-loop.com/logo-for-emails.png";
    let programLogoUri = business.logo_url || platformLogoUri;
    let wideLogoUri: string | null = null;

    if (business.logo_url) {
      try {
        const dims = await sniffImageDimensions(business.logo_url);
        if (dims && dims.width > 0 && dims.height > 0) {
          const ratio = dims.width / dims.height;
          if (ratio < 0.8 || ratio > 1.25) {
            programLogoUri = platformLogoUri;
            wideLogoUri = business.logo_url;
          }
        }
      } catch (e) {
        console.error("logo dimension sniff failed, using logo as-is", e);
      }
    }

    // Google rejects a self-declared "approved" review status on insert
    // ("Invalid review status \"APPROVED\". Use \"UNDER_REVIEW\" instead.") —
    // confirmed directly against the live API. Approved issuers' classes
    // still start "under review" but clear automated review immediately, so
    // this doesn't add any real delay for objects created right after.
    const loyaltyClass = {
      id: classId,
      issuerName: business.name,
      programName: `${unitLabel === "Points" ? "Points" : unitLabel === "Visits" ? "Visits" : "Stamp"} Card`,
      reviewStatus: "UNDER_REVIEW",
      hexBackgroundColor: business.brand_color || "#E8703B",
      programLogo: { sourceUri: { uri: programLogoUri }, contentDescription: { defaultValue: { language: "en", value: `${business.name} logo` } } },
      ...(wideLogoUri
        ? { wideProgramLogo: { sourceUri: { uri: wideLogoUri }, contentDescription: { defaultValue: { language: "en", value: `${business.name} logo` } } } }
        : {}),
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
