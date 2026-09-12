// Renders a branded shop pin as a PNG for the shopper app's Google map.
//
// Why this exists: on Android, react-native-maps sizes custom marker views
// through a legacy (Paper) shadow-node hook that React Native's New
// Architecture never calls, so view-based markers are snapshotted at a fixed
// 100×100 px and appear cut off. The app therefore asks this function for a
// ready-made bitmap (Marker `image` prop) instead. iOS still draws the pin
// natively. See docs/HANDOFF-DEV-NOTES.md → "Map pins".
//
// GET /map-pin?color=%23e0673a&initials=PE&scale=2.75&logo=https://…
import { initWasm, Resvg } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm";
const FONT_URL = "https://cdn.jsdelivr.net/gh/rsms/inter@v3.19/docs/font-files/Inter-Bold.otf";
const DEFAULT_COLOR = "#e0673a";
const MAX_LOGO_BYTES = 4 * 1024 * 1024;
// Logical pin size in dp; the PNG is this multiplied by `scale`.
const PIN_W = 60;
const PIN_H = 66;

let ready: Promise<Uint8Array | null> | null = null;

/** Initialise the rasteriser once per isolate and fetch the initials font. */
function prepare(): Promise<Uint8Array | null> {
  if (!ready) {
    ready = (async () => {
      await initWasm(fetch(WASM_URL));
      try {
        const res = await fetch(FONT_URL);
        return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
      } catch {
        return null;
      }
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}

/** Download the shop logo and return it as a data URI, or null to fall back to initials. */
async function fetchLogo(url: string): Promise<string | null> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(parsed, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > MAX_LOGO_BYTES) return null;
    const type = sniffImageType(bytes);
    if (!type) return null;
    return `data:${type};base64,${encodeBase64(bytes)}`;
  } catch {
    return null;
  }
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

/** Mirrors the iOS pin drawn in apps/shopper/App.tsx (ShopMarker): brand halo,
 * ground shadow, tail, brand ring with white border, white centre with the
 * logo (or initials). Coordinates are in dp on a 60×66 canvas. */
function pinSvg(color: string, initials: string, logo: string | null, hasFont: boolean): string {
  const centre = logo
    ? `<image xlink:href="${logo}" x="14" y="12" width="32" height="32" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip)"/>`
    : hasFont && initials
    ? `<text x="30" y="33" text-anchor="middle" font-family="Inter" font-weight="700" font-size="${initials.length > 1 ? 13 : 15}" letter-spacing="-0.5" fill="${color}">${escapeXml(initials)}</text>`
    : `<circle cx="30" cy="28" r="6" fill="${color}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${PIN_W}" height="${PIN_H}" viewBox="0 0 ${PIN_W} ${PIN_H}">
  <defs>
    <clipPath id="clip"><circle cx="30" cy="28" r="16"/></clipPath>
    <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.28"/></filter>
  </defs>
  <circle cx="30" cy="28" r="28" fill="${color}" opacity="0.22"/>
  <ellipse cx="30" cy="60.5" rx="8" ry="2.5" fill="#000000" opacity="0.2"/>
  <path d="M23 46 L37 46 L30 57 Z" fill="${color}"/>
  <circle cx="30" cy="28" r="20.5" fill="${color}" stroke="#ffffff" stroke-width="3" filter="url(#shadow)"/>
  <circle cx="30" cy="28" r="16" fill="#ffffff"/>
  ${centre}
</svg>`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const url = new URL(req.url);
  const colorParam = url.searchParams.get("color") ?? "";
  const color = /^#[0-9a-f]{6}$/i.test(colorParam) ? colorParam.toLowerCase() : DEFAULT_COLOR;
  const initials = (url.searchParams.get("initials") ?? "").trim().slice(0, 2).toUpperCase();
  const scaleParam = Number(url.searchParams.get("scale"));
  const scale = Number.isFinite(scaleParam) && scaleParam > 0 ? Math.min(4, Math.max(1, scaleParam)) : 3;
  const logoUrl = url.searchParams.get("logo");

  try {
    const [font, logo] = await Promise.all([prepare(), logoUrl ? fetchLogo(logoUrl) : Promise.resolve(null)]);
    const resvg = new Resvg(pinSvg(color, initials, logo, font != null), {
      fitTo: { mode: "width", value: Math.round(PIN_W * scale) },
      font: font ? { fontBuffers: [font], defaultFontFamily: "Inter", loadSystemFonts: false } : { loadSystemFonts: false },
    });
    const png = resvg.render().asPng();
    return new Response(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("map-pin render failed", error);
    return new Response("Could not render pin", { status: 500 });
  }
});
