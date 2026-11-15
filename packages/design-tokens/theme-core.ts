/**
 * Theme core shared by both phone apps (2026-11-15). Pure TypeScript: no React,
 * no react-native, so it can be tested in plain Node.
 *
 * How dark mode reaches ~1,000 colour uses without rewriting every screen:
 *  - `colors` is a live view of the active palette. Reading `colors.card` at
 *    render time gives the right colour for the current scheme.
 *  - `themed(() => StyleSheet.create({...}))` builds a StyleSheet once per scheme
 *    and returns a proxy, so `styles.card` always reads the active one.
 *  - `schemeColor('#FDECCD', 'bg')` is for one-off literals: it returns the literal
 *    untouched in light mode (so light never changes) and a dark equivalent in
 *    dark mode: pastel tiles become deep tints of the same hue, dark text turns
 *    light, bright fills (amber, teal, green) stay as they are.
 * The scheme is switched by each app's ThemeProvider, which re-renders the tree.
 */
import { darkColors, lightColors, type ColorScheme } from './palettes';

let active: ColorScheme = 'light';
const listeners = new Set<() => void>();

export function getActiveScheme(): ColorScheme {
  return active;
}

export function setActiveScheme(scheme: ColorScheme) {
  if (scheme === active) return;
  active = scheme;
  listeners.forEach((listener) => listener());
}

/**
 * Run `fn` with a fixed scheme, then restore. Used where a screen must keep its
 * light look in dark mode (a shop page wearing the shop's own design reads its
 * base styles in light and overrides them).
 */
export function withScheme<T>(scheme: ColorScheme, fn: () => T): T {
  const previous = active;
  active = scheme;
  try {
    return fn();
  } finally {
    active = previous;
  }
}

export function subscribeScheme(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

type Palette = Record<keyof typeof lightColors, string>;
const palettes: Record<ColorScheme, Palette> = { light: lightColors, dark: darkColors };

/** The active palette. Same keys as lightColors; values follow the current scheme. */
export const colors: Palette = new Proxy({} as Palette, {
  get: (_target, key) => (palettes[active] as Record<string | symbol, string>)[key],
  has: (_target, key) => key in palettes[active],
  ownKeys: () => Reflect.ownKeys(palettes[active]),
  getOwnPropertyDescriptor: (_target, key) => {
    const value = (palettes[active] as Record<string | symbol, string>)[key];
    return value === undefined ? undefined : { value, enumerable: true, configurable: true, writable: false };
  },
});

/** Build a value (normally a StyleSheet) once per scheme and read it through a proxy. */
export function themed<T extends object>(factory: () => T): T {
  const cache: Partial<Record<ColorScheme, T>> = {};
  const current = () => (cache[active] ??= factory());
  return new Proxy({} as T, {
    get: (_target, key) => (current() as Record<string | symbol, unknown>)[key],
    has: (_target, key) => key in current(),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor: (_target, key) => {
      const value = (current() as Record<string | symbol, unknown>)[key];
      return value === undefined ? undefined : { value, enumerable: true, configurable: true, writable: false };
    },
  });
}

export type ToneRole = 'bg' | 'fg' | 'border';

// ---- colour maths ----------------------------------------------------------

function parseHex(input: string): [number, number, number] | null {
  const hex = input.trim().replace('#', '');
  if (hex.length === 3 || hex.length === 4) {
    const [r, g, b] = [hex[0], hex[1], hex[2]].map((ch) => parseInt(ch + ch, 16));
    return [r, g, b];
  }
  if (hex.length === 6 || hex.length === 8) {
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
  }
  return null;
}

function toHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function fromHsl(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return '#' + rgb.map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Colours whose dark equivalent is a design decision, not a formula. Keys are upper-case, 6 digits. */
const OVERRIDES: Record<ToneRole, Record<string, string>> = {
  bg: {
    '#FFFFFF': darkColors.card,
    '#FCFCFA': darkColors.card,
    '#F4F1EA': darkColors.background,
    '#F4F1EB': darkColors.background,
    '#F6F5F0': '#1B1B1F',
    '#F8F5EE': '#1B1B1F',
    '#EFEBE3': darkColors.fill,
    '#2B3A67': darkColors.primary,
    '#1F2A4D': '#3E53A3',
    '#1A2138': '#3B4F94',
    '#0B0F1C': '#0B0F1C',
    '#111111': '#0A0A0C',
    '#000000': '#000000',
  },
  border: {
    '#FFFFFF': 'rgba(255,255,255,0.35)',
    '#E2DDD3': darkColors.border,
    '#2B3A67': '#5F78D4',
  },
  fg: {
    '#000000': darkColors.text,
    '#1A2138': darkColors.ink,
    '#2B3A67': darkColors.primaryText,
    '#1F2A4D': darkColors.primaryText,
    '#6F6B64': darkColors.muted,
    '#8A857C': '#8E8981',
    '#111111': darkColors.text,
  },
};

function darkBg(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const [h, s, l] = toHsl(rgb);
  if (l >= 0.78) {
    // Pale tile or wash: a deep tint of the same hue, so the tile stays coloured.
    return fromHsl(h, clamp(s, 0, 0.45) * 0.85, clamp(0.13 + (1 - l) * 0.5, 0.13, 0.25));
  }
  if (l < 0.3) {
    // A dark panel that would vanish on a near-black page: lift it a little.
    return fromHsl(h, s, clamp(l + 0.1, 0.2, 0.34));
  }
  return hex; // mid and bright fills (amber, teal, green, orange) are kept
}

function darkFg(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const [h, s, l] = toHsl(rgb);
  if (l <= 0.5) {
    // Dark text for a light page becomes light text for a dark one, same hue.
    return fromHsl(h, clamp(s, 0, 0.7), clamp(0.74 + (0.5 - l) * 0.2, 0.7, 0.84));
  }
  return hex;
}

function darkBorder(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const [h, s, l] = toHsl(rgb);
  if (l >= 0.7) return fromHsl(h, clamp(s, 0, 0.3) * 0.8, 0.26);
  if (l < 0.3) return fromHsl(h, s, clamp(l + 0.25, 0.4, 0.55));
  return hex;
}

const toneCache = new Map<string, string>();

/** rgba() strings: dark inks used as hairlines and soft fills flip to white-based ones; scrims stay. */
function darkRgba(input: string, role: ToneRole): string {
  const m = input.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (!m) return input;
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const a = m[4] === undefined ? 1 : Number(m[4]);
  const [, , l] = toHsl([r, g, b]);
  if (l > 0.3) return input; // light tints and white overlays are fine on dark
  if (role === 'bg' && a > 0.2) return input; // scrims and shades behind modals
  const tinted = Math.max(r, g, b) - Math.min(r, g, b) > 20;
  return tinted ? `rgba(157,176,242,${a})` : `rgba(255,255,255,${a})`;
}

/**
 * A literal colour for the active scheme. In light mode the literal is returned
 * unchanged. `role` says what the colour paints: 'bg' (fills), 'fg' (text and
 * icons) or 'border'. Add an entry to OVERRIDES when the formula picks badly.
 */
export function schemeColor(hex: string, role: ToneRole = 'bg'): string {
  if (active === 'light') return hex;
  const key = role + hex;
  const cached = toneCache.get(key);
  if (cached) return cached;
  if (hex.startsWith('rgb')) {
    const out = darkRgba(hex, role);
    toneCache.set(key, out);
    return out;
  }
  const rgb = parseHex(hex);
  if (!rgb || hex.length === 5 || hex.length === 9) {
    toneCache.set(key, hex);
    return hex;
  }
  const six = '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  const override = OVERRIDES[role][six];
  const out = override ?? (role === 'bg' ? darkBg(six) : role === 'fg' ? darkFg(six) : darkBorder(six));
  toneCache.set(key, out);
  return out;
}
