// Shop branding for Google Wallet passes. Pure helpers (no network, no image
// libraries) so they run under node tests; the Deno-only decode/upload lives in
// wallet-images.ts.
//
// Google rules this follows:
//  - A LoyaltyClass is shared by every object of that class, so branding (issuer,
//    programme name, logo, colour, hero image) is set once per shop, on that
//    shop's own class (biz_<id>), and patched whenever the shop's design changes.
//  - programLogo is cropped to a circle (1:1, at least 660x660, public HTTPS).
//    A wide or edge-to-edge logo loses its edges, so we make a padded square.
//  - heroImage is shown at roughly 3:1 (1032x336 recommended, public HTTPS).
import { FALLBACK_COLOUR, hexToRgb, isHex } from "./card-colour.ts";

export type WalletShop = {
  id: string;
  name: string;
  brand_color?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
  card_design?: { color?: unknown; secondary?: unknown; photo?: unknown } | null;
};

export type Rgba = { width: number; height: number; data: Uint8Array | Uint8ClampedArray };

export const LOGO_SIZE = 660;
export const HERO_W = 1032;
export const HERO_H = 336;
/** Logo must sit inside the inscribed circle: side <= size * 0.707. 0.6 leaves a margin. */
export const LOGO_FILL = 0.6;

/** The shop's own colour: designed card colour first, then brand colour. */
export function walletColour(shop: WalletShop): string {
  const designed = shop.card_design?.color;
  if (isHex(designed)) return designed;
  if (isHex(shop.brand_color)) return shop.brand_color;
  return FALLBACK_COLOUR;
}

/** Hero source: the designed card image, then the cover photo (https only). */
export function heroSource(shop: WalletShop): string | null {
  const candidates = [shop.card_design?.photo, shop.cover_url];
  for (const c of candidates) if (typeof c === "string" && /^https:\/\//.test(c)) return c;
  return null;
}

/** Small stable hash (FNV-1a) used to name generated images, so they are only rebuilt when an input changes. */
export function brandHash(...parts: (string | null | undefined)[]): string {
  let h = 0x811c9dc5;
  for (const ch of parts.map((p) => p ?? "").join("|")) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** Bilinear resample of an RGBA image to w x h. */
export function resize(src: Rgba, w: number, h: number): Rgba {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(src.height - 1, Math.max(0, ((y + 0.5) * src.height) / h - 0.5));
    const y0 = Math.floor(sy), y1 = Math.min(src.height - 1, y0 + 1), fy = sy - y0;
    for (let x = 0; x < w; x++) {
      const sx = Math.min(src.width - 1, Math.max(0, ((x + 0.5) * src.width) / w - 0.5));
      const x0 = Math.floor(sx), x1 = Math.min(src.width - 1, x0 + 1), fx = sx - x0;
      for (let c = 0; c < 4; c++) {
        const a = src.data[(y0 * src.width + x0) * 4 + c], b = src.data[(y0 * src.width + x1) * 4 + c];
        const d = src.data[(y1 * src.width + x0) * 4 + c], e = src.data[(y1 * src.width + x1) * 4 + c];
        out[(y * w + x) * 4 + c] = Math.round((a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy);
      }
    }
  }
  return { width: w, height: h, data: out };
}

function fill(w: number, h: number, hex: string): Uint8Array {
  const [r, g, b] = hexToRgb(hex);
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255; }
  return data;
}

function over(dst: Uint8Array, dw: number, src: Rgba, ox: number, oy: number) {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const s = (y * src.width + x) * 4, d = ((oy + y) * dw + ox + x) * 4;
      const a = src.data[s + 3] / 255;
      for (let c = 0; c < 3; c++) dst[d + c] = Math.round(src.data[s + c] * a + dst[d + c] * (1 - a));
      dst[d + 3] = 255;
    }
  }
}

/** Average luminance (0..1) of the visible pixels; light logos need a coloured tile to show up. */
export function logoLuminance(img: Rgba): number {
  let sum = 0, n = 0;
  for (let i = 0; i < img.width * img.height; i++) {
    const a = img.data[i * 4 + 3];
    if (a < 128) continue;
    sum += (0.2126 * img.data[i * 4] + 0.7152 * img.data[i * 4 + 1] + 0.0722 * img.data[i * 4 + 2]) / 255;
    n++;
  }
  return n ? sum / n : 0;
}

/** Logo contained (never cropped) in a padded square: Wallet's circular crop then only trims empty tile. */
export function paddedLogo(logo: Rgba, shopColour: string, size = LOGO_SIZE): Rgba {
  const box = Math.round(size * LOGO_FILL);
  const scale = Math.min(box / logo.width, box / logo.height);
  const w = Math.max(1, Math.round(logo.width * scale)), h = Math.max(1, Math.round(logo.height * scale));
  const tile = logoLuminance(logo) > 0.8 ? shopColour : "#FFFFFF";
  const data = fill(size, size, tile);
  over(data, size, resize(logo, w, h), Math.floor((size - w) / 2), Math.floor((size - h) / 2));
  return { width: size, height: size, data };
}

/** Photo scaled to fill the hero (centre crop, no stretching). */
export function heroFromPhoto(photo: Rgba, w = HERO_W, h = HERO_H): Rgba {
  const scale = Math.max(w / photo.width, h / photo.height);
  const sw = Math.max(w, Math.round(photo.width * scale)), sh = Math.max(h, Math.round(photo.height * scale));
  const scaled = resize(photo, sw, sh);
  const ox = Math.floor((sw - w) / 2), oy = Math.floor((sh - h) / 2);
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    out.set(scaled.data.subarray(((y + oy) * sw + ox) * 4, ((y + oy) * sw + ox + w) * 4), y * w * 4);
  }
  return { width: w, height: h, data: out };
}

const text = (value: string) => ({ defaultValue: { language: "en", value } });
const image = (uri: string, alt: string) => ({ sourceUri: { uri }, contentDescription: text(alt) });

export type ClassInputs = {
  shop: WalletShop;
  classId: string;
  /** Square padded logo, or the shop's logo if it is already roughly square, or the platform fallback. */
  programLogoUri: string;
  /** Original wide logo, only when the logo is not square. */
  wideLogoUri?: string | null;
  heroUri?: string | null;
};

/** The shop-branded LoyaltyClass. reviewStatus is added by the caller (insert only). */
export function buildLoyaltyClass(i: ClassInputs): Record<string, unknown> {
  const name = i.shop.name;
  return {
    id: i.classId,
    issuerName: name,
    programName: name,
    hexBackgroundColor: walletColour(i.shop),
    programLogo: image(i.programLogoUri, `${name} logo`),
    ...(i.wideLogoUri ? { wideProgramLogo: image(i.wideLogoUri, `${name} logo`) } : {}),
    ...(i.heroUri ? { heroImage: image(i.heroUri, `${name} loyalty card`) } : {}),
  };
}
