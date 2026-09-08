import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import forge from "npm:node-forge@1";
import { ICON_1X, ICON_2X, ICON_3X, LOGO_1X, LOGO_2X, LOGO_3X } from "./pass-images.ts";

// Generates a signed Apple Wallet (.pkpass) file for a customer's loyalty
// card at a given business. Unlike Google Wallet (a signed JWT Google's own
// servers resolve), a .pkpass is a real ZIP archive of JSON + images that we
// build and cryptographically sign ourselves with a Pass Type ID certificate
// issued by Apple — see the "Apple Wallet pass setup" memory for how that
// certificate was generated and where its 2027-10-08 expiry is tracked.
//
// v1 scope: a snapshot pass (balance is correct at the moment it's added,
// like Google Wallet before update-wallet-pass existed). No push-based live
// updates yet — that needs a full PassKit web service + APNs, deliberately
// deferred.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PASS_TYPE_ID = Deno.env.get("APPLE_PASS_TYPE_ID");
const TEAM_ID = Deno.env.get("APPLE_PASS_TEAM_ID");
const CERT_PEM = Deno.env.get("APPLE_PASS_CERT_PEM");
const KEY_PEM = Deno.env.get("APPLE_PASS_KEY_PEM");
const WWDR_PEM = Deno.env.get("APPLE_WWDR_PEM");

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

function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return "rgb(232, 112, 59)";
  return `rgb(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255})`;
}

// --- Minimal ZIP (stored, uncompressed) writer -----------------------------
// .pkpass files are just ordinary ZIP archives. No compression is required
// by the spec, so "stored" entries keep this dependency-free.

function crc32(data: Uint8Array): number {
  let c: number;
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = (crc ^ data[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0, true); // flags
    lv.setUint16(8, 0, true); // method: stored
    lv.setUint16(10, 0, true); // mod time
    lv.setUint16(12, 0x21, true); // mod date (arbitrary valid DOS date)
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    localParts.push(local, file.data);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);

    offset += local.length + file.data.length;
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const part of centralParts) centralSize += part.length;

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralStart, true);
  ev.setUint16(20, 0, true);

  const total = offset + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const part of [...localParts, ...centralParts, eocd]) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}

function sha1Hex(data: Uint8Array): string {
  const md = forge.md.sha1.create();
  md.update(forge.util.createBuffer(data).data);
  return md.digest().toHex();
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function signManifest(manifestBytes: Uint8Array): Uint8Array {
  const cert = forge.pki.certificateFromPem(CERT_PEM!);
  const wwdr = forge.pki.certificateFromPem(WWDR_PEM!);
  const key = forge.pki.privateKeyFromPem(KEY_PEM!);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifestBytes);
  p7.addCertificate(cert);
  p7.addCertificate(wwdr);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha1,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
    ],
  });
  p7.sign({ detached: true });

  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  const bytes = new Uint8Array(der.length);
  for (let i = 0; i < der.length; i++) bytes[i] = der.charCodeAt(i) & 0xff;
  return bytes;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  try {
    if (!PASS_TYPE_ID || !TEAM_ID || !CERT_PEM || !KEY_PEM || !WWDR_PEM) {
      return new Response(JSON.stringify({ error: "Apple Wallet is not configured" }), { status: 500, headers: jsonHeaders });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing authorization" }), { status: 401, headers: jsonHeaders });
    }

    const { business_id } = await req.json().catch(() => ({}));
    if (!business_id) {
      return new Response(JSON.stringify({ error: "business_id is required" }), { status: 400, headers: jsonHeaders });
    }

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
      .select("id,name,brand_color,loyalty_type,loyalty_config")
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

    const passJson = {
      formatVersion: 1,
      passTypeIdentifier: PASS_TYPE_ID,
      teamIdentifier: TEAM_ID,
      serialNumber: `${business.id}-${user.id}`,
      description: `${business.name} loyalty card`,
      organizationName: "The Loyalty Loop",
      logoText: business.name,
      backgroundColor: hexToRgb(business.brand_color || "#E8703B"),
      foregroundColor: "rgb(255, 255, 255)",
      labelColor: "rgb(255, 255, 255)",
      storeCard: {
        primaryFields: [{ key: "balance", label: unitLabel, value: String(value) }],
        secondaryFields: [
          { key: "goal", label: "Goal", value: `${stampsRequired} ${unitLabel.toLowerCase()} to unlock your reward` },
        ],
        backFields: [
          { key: "about", label: "About", value: `Show this pass's QR code at ${business.name} to collect ${unitLabel.toLowerCase()}.` },
        ],
      },
      barcodes: [
        { message: `loyaltyloop:customer:${user.id}`, format: "PKBarcodeFormatQR", messageEncoding: "iso-8859-1" },
      ],
    };

    const encoder = new TextEncoder();
    const files: Record<string, Uint8Array> = {
      "pass.json": encoder.encode(JSON.stringify(passJson)),
      "icon.png": base64ToBytes(ICON_1X),
      "icon@2x.png": base64ToBytes(ICON_2X),
      "icon@3x.png": base64ToBytes(ICON_3X),
      "logo.png": base64ToBytes(LOGO_1X),
      "logo@2x.png": base64ToBytes(LOGO_2X),
      "logo@3x.png": base64ToBytes(LOGO_3X),
    };

    const manifest: Record<string, string> = {};
    for (const [name, data] of Object.entries(files)) manifest[name] = sha1Hex(data);
    const manifestBytes = encoder.encode(JSON.stringify(manifest));

    const signatureBytes = signManifest(manifestBytes);

    const zipBytes = buildZip([
      ...Object.entries(files).map(([name, data]) => ({ name, data })),
      { name: "manifest.json", data: manifestBytes },
      { name: "signature", data: signatureBytes },
    ]);

    return new Response(zipBytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${business.name.replace(/[^a-z0-9]+/gi, "-")}.pkpass"`,
      },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "internal error" }), { status: 500, headers: jsonHeaders });
  }
});
