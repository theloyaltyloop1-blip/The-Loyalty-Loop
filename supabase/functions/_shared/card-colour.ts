// Pure helpers for the AI card-colour picker. No I/O, so they run under node tests.
// The card background is `card_design.color`; card text colour is derived at render
// time from it (cardInk in packages/card-design), so we return a text colour that
// is guaranteed readable on the chosen background.

export const FALLBACK_COLOUR = "#234C40";
export type CardColour = { background: string; secondary: string; text: string };
export type ColourSource = "ai" | "extracted" | "default";

const HEX = /^#[0-9A-Fa-f]{6}$/;
export const isHex = (v: unknown): v is string => typeof v === "string" && HEX.test(v);

export function hexToRgb(h: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
export function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}
function lum(h: string): number {
  const [r, g, b] = hexToRgb(h).map((x) => {
    const n = x / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}
export function contrast(a: string, b: string): number {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

/** Black or white, whichever reads better. */
export function readableText(bg: string): string {
  return contrast(bg, "#FFFFFF") >= contrast(bg, "#000000") ? "#FFFFFF" : "#000000";
}

/** Clamp washed-out / pitch-black colours and nudge lightness until text on it reaches 4.5:1. */
export function fixBackground(bg: string): string {
  const [r, g, b] = hexToRgb(bg);
  const [h, s, l0] = rgbToHsl(r, g, b);
  let l = Math.max(0.16, Math.min(0.84, l0));
  let out = hslToHex(h, s, l);
  for (let i = 0; i < 40 && contrast(out, readableText(out)) < 4.5; i++) {
    l += l < 0.5 ? -0.02 : 0.02;
    out = hslToHex(h, s, Math.max(0.05, Math.min(0.95, l)));
  }
  return out;
}

function secondaryFor(bg: string, candidate?: string): string {
  if (candidate && contrast(bg, candidate) >= 3 && candidate.toUpperCase() !== bg.toUpperCase()) return candidate.toUpperCase();
  const [r, g, b] = hexToRgb(bg);
  const [h, s, l] = rgbToHsl(r, g, b);
  const dark = l < 0.5;
  let out = hslToHex(h, Math.min(1, s * 0.8), dark ? 0.78 : 0.28);
  for (let i = 1; i <= 10 && contrast(bg, out) < 3; i++) out = hslToHex(h, Math.min(1, s * 0.8), dark ? 0.78 + i * 0.02 : 0.28 - i * 0.02);
  return out;
}

/** Finalise a proposed pair into a safe, contrast-checked colour set. */
export function finalise(background: string, secondary?: string): CardColour {
  const bg = fixBackground(background);
  return { background: bg, secondary: secondaryFor(bg, isHex(secondary) ? secondary : undefined), text: readableText(bg) };
}

/** Validate a model answer. Returns null if it is not exactly the format we asked for. */
export function parseAiColour(raw: string): CardColour | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let o: unknown;
  try { o = JSON.parse(match[0]); } catch { return null; }
  if (!o || typeof o !== "object") return null;
  const { background, secondary } = o as Record<string, unknown>;
  if (!isHex(background)) return null;
  return finalise(background, isHex(secondary) ? secondary : undefined);
}

/**
 * Deterministic fallback. `rgba` is a flat RGBA pixel buffer. Buckets pixels into a
 * 4-bit-per-channel histogram, ignores transparent, near-white and near-grey pixels,
 * and scores buckets by pixel count weighted toward saturated colours.
 */
export function dominantColour(rgba: ArrayLike<number>): CardColour {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  const step = Math.max(1, Math.floor(rgba.length / 4 / 20000)) * 4;
  for (let i = 0; i + 3 < rgba.length; i += step) {
    if (rgba[i + 3] < 128) continue;
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    const [, s, l] = rgbToHsl(r, g, b);
    if (l > 0.93 || l < 0.04) continue;
    if (s < 0.12 && (l > 0.8 || l < 0.15)) continue;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += r; e.g += g; e.b += b;
    buckets.set(key, e);
  }
  const ranked = [...buckets.values()]
    .map((e) => {
      const r = e.r / e.n, g = e.g / e.n, b = e.b / e.n;
      return { hex: rgbToHex(r, g, b), score: e.n * (0.35 + rgbToHsl(r, g, b)[1]) };
    })
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) return finalise(FALLBACK_COLOUR);
  const main = ranked[0].hex;
  const second = ranked.find((c) => c.hex !== main && contrast(main, c.hex) >= 3)?.hex;
  return finalise(main, second);
}
