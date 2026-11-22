// Deno-only: builds and stores the shop-branded images a Google Wallet class needs,
// then returns the finished LoyaltyClass fields. Decoding uses the same libraries
// as suggest-card-colour (PNG and JPEG; WebP and GIF cannot be decoded here, so
// those fall back to the original URL, which Google accepts but will crop).
// deno-lint-ignore-file no-explicit-any
import UPNG from "npm:upng-js@2.1.0";
import jpeg from "npm:jpeg-js@0.4.4";
import {
  brandHash, buildLoyaltyClass, heroFromPhoto, heroSource, paddedLogo, walletColour,
  type Rgba, type WalletShop,
} from "./wallet-branding.ts";

const PLATFORM_LOGO = "https://www.the-loyalty-loop.com/logo-mark.png";
const MAX_BYTES = 5 * 1024 * 1024;

async function fetchRgba(url: string): Promise<Rgba | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > MAX_BYTES) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.length > 24 && view.getUint32(0) === 0x89504e47) {
      const png = UPNG.decode(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      const rgba = new Uint8Array(UPNG.toRGBA8(png)[0]);
      return { width: png.width, height: png.height, data: rgba };
    }
    if (bytes.length > 4 && view.getUint16(0) === 0xffd8) {
      const img = jpeg.decode(bytes, { useTArray: true, maxResolutionInMP: 16 });
      return { width: img.width, height: img.height, data: img.data };
    }
  } catch (e) {
    console.error("wallet image decode failed", url, e);
  }
  return null; // webp / gif / unreachable
}

function encodePng(img: Rgba): Uint8Array {
  return new Uint8Array(UPNG.encode([img.data.buffer.slice(img.data.byteOffset, img.data.byteOffset + img.data.byteLength)], img.width, img.height, 0));
}

/** Uploads a generated PNG once (name carries the input hash), clearing older wallet-* files for the shop. */
async function storeImage(admin: any, shopId: string, kind: string, hash: string, build: () => Rgba): Promise<string | null> {
  const name = `wallet-${kind}-${hash}.png`;
  const path = `${shopId}/${name}`;
  const { data: pub } = admin.storage.from("covers").getPublicUrl(path);
  const publicUrl: string = pub.publicUrl;
  const { data: existing } = await admin.storage.from("covers").list(shopId, { search: `wallet-${kind}-` });
  if ((existing ?? []).some((f: { name: string }) => f.name === name)) return publicUrl;
  const { error } = await admin.storage.from("covers").upload(path, encodePng(build()), { contentType: "image/png", upsert: true });
  if (error) { console.error("wallet image upload failed", kind, error.message); return null; }
  const stale = (existing ?? []).map((f: { name: string }) => f.name).filter((n: string) => n !== name).map((n: string) => `${shopId}/${n}`);
  if (stale.length) await admin.storage.from("covers").remove(stale);
  return publicUrl;
}

/** Everything the shop's LoyaltyClass should say, with generated images stored. Never throws; degrades to the original images. */
export async function shopLoyaltyClass(admin: any, shop: WalletShop, classId: string): Promise<Record<string, unknown>> {
  const colour = walletColour(shop);
  let programLogoUri = PLATFORM_LOGO;
  let wideLogoUri: string | null = null;
  let heroUri: string | null = null;

  if (shop.logo_url) {
    const logo = await fetchRgba(shop.logo_url);
    if (logo) {
      const ratio = logo.width / logo.height;
      if (ratio > 1.25 || ratio < 0.8) wideLogoUri = shop.logo_url;
      // Always padded: Wallet crops to a circle, so even a square logo loses its corners.
      programLogoUri =
        (await storeImage(admin, shop.id, "logo", brandHash(shop.logo_url, colour), () => paddedLogo(logo, colour))) ?? shop.logo_url;
    } else {
      programLogoUri = shop.logo_url; // webp/gif: used as-is (cannot be padded here)
    }
  }

  const hero = heroSource(shop);
  if (hero) {
    const photo = await fetchRgba(hero);
    heroUri = photo
      ? (await storeImage(admin, shop.id, "hero", brandHash(hero), () => heroFromPhoto(photo))) ?? hero
      : hero;
  }

  return buildLoyaltyClass({ shop, classId, programLogoUri, wideLogoUri, heroUri });
}

/** Inserts the class the first time, patches it afterwards so every saved pass picks up branding changes. */
export async function ensureLoyaltyClass(accessToken: string, classId: string, loyaltyClass: Record<string, unknown>, insertIfMissing = true) {
  const base = "https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass";
  const auth = { Authorization: `Bearer ${accessToken}` };
  const getRes = await fetch(`${base}/${classId}`, { headers: auth });
  if (getRes.status === 200) {
    // Never re-send reviewStatus on an update: the class may already have cleared review.
    const patchRes = await fetch(`${base}/${classId}`, {
      method: "PATCH",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify(loyaltyClass),
    });
    if (!patchRes.ok) console.error("loyalty class patch failed", patchRes.status, await patchRes.text());
    return;
  }
  if (!insertIfMissing) return;
  const insertRes = await fetch(base, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    // Google rejects a self-declared APPROVED status; approved issuers clear review immediately.
    body: JSON.stringify({ ...loyaltyClass, reviewStatus: "UNDER_REVIEW" }),
  });
  if (!insertRes.ok) throw new Error(`loyalty class insert failed: ${insertRes.status} ${await insertRes.text()}`);
}
