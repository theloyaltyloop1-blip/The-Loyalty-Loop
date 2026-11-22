// Pure helpers for the AI "Design it for me" card. No I/O, so they run under node tests.
// The option lists mirror packages/card-design/model.ts (a test keeps them in sync).
// The model only ever picks from these lists; everything else is rejected or replaced.
import { finalise, isHex } from "./card-colour.ts";

export const BACKGROUNDS = ["solid", "gradient", "kraft", "chalkboard", "marble", "wood", "roast", "pinstripe", "paper", "photo"] as const;
export const ICONS = ["coffee", "scissors", "paw", "donut", "star", "logo"] as const;
export const TYPEFACES = ["modern", "classic", "handwritten", "retro"] as const;
export const LAYOUTS = ["grid", "ring", "row", "jar", "bar"] as const;
export const ENTRANCES = ["none", "stamp", "flip"] as const;
export const POSITIONS = ["left", "center", "right"] as const;

export type CardDesign = {
  version: 1;
  background: (typeof BACKGROUNDS)[number];
  color: string;
  secondary: string;
  icon: (typeof ICONS)[number];
  font: (typeof TYPEFACES)[number];
  layout: (typeof LAYOUTS)[number];
  entrance: (typeof ENTRANCES)[number];
  logoPosition: (typeof POSITIONS)[number];
  photo: string | null;
};
export type DesignContext = {
  category?: string | null;
  hasLogo: boolean;
  coverUrl: string | null; // already checked to be in our own bucket
  stamps: boolean; // stamp-style programme (grid/row layouts only make sense for stamps)
};
type Preset = Omit<CardDesign, "photo" | "color" | "secondary"> & { color?: string; secondary?: string };

// Category presets (same spirit as TEMPLATES in model.ts).
export function templateFor(category: string | null | undefined): Preset {
  const c = (category || "").toLowerCase();
  const base = { version: 1 as const, entrance: "stamp" as const, logoPosition: "left" as const };
  if (/caf|coffee|tea/.test(c)) return { ...base, background: "roast", color: "#3B2A20", secondary: "#CE925B", icon: "coffee", font: "classic", layout: "row" };
  if (/barber|hair|salon|beauty|nail/.test(c)) return { ...base, background: "pinstripe", color: "#121212", secondary: "#D3AC24", icon: "scissors", font: "retro", layout: "row" };
  if (/bak|cake|dessert|patisser|sweet/.test(c)) return { ...base, background: "paper", color: "#F7ECD8", secondary: "#C26912", icon: "donut", font: "handwritten", layout: "ring" };
  if (/gym|fitness|sport|yoga|train/.test(c)) return { ...base, background: "solid", color: "#0C1C2A", secondary: "#FF6927", icon: "star", font: "modern", layout: "bar", entrance: "flip" };
  if (/pet|dog|groom|vet/.test(c)) return { ...base, background: "solid", icon: "paw", font: "modern", layout: "grid" };
  return { ...base, background: "solid", icon: "star", font: "modern", layout: "grid" };
}

const pick = <T extends string>(v: unknown, list: readonly T[]): T | null => (list.includes(v as T) ? (v as T) : null);

/** Make a design safe: known values only, contrast-fixed colours, layout fits the programme. */
export function finaliseDesign(raw: Record<string, unknown>, ctx: DesignContext): CardDesign {
  const tpl = templateFor(ctx.category);
  let background = pick(raw.background, BACKGROUNDS) ?? tpl.background;
  let photo: string | null = null;
  if (background === "photo") {
    if (ctx.coverUrl) photo = ctx.coverUrl;
    else background = "solid";
  }
  const wanted = isHex(raw.color) ? raw.color : tpl.color ?? "#234C40";
  const c = finalise(wanted, isHex(raw.secondary) ? raw.secondary : tpl.secondary);
  let icon = pick(raw.icon, ICONS) ?? tpl.icon;
  if (icon === "logo" && !ctx.hasLogo) icon = tpl.icon === "logo" ? "star" : tpl.icon;
  let layout = pick(raw.layout, LAYOUTS) ?? tpl.layout;
  if (!ctx.stamps && (layout === "grid" || layout === "row")) layout = "ring"; // same rule as designForProgress
  return {
    version: 1,
    background,
    color: c.background,
    secondary: c.secondary,
    icon,
    font: pick(raw.font, TYPEFACES) ?? tpl.font,
    layout,
    entrance: pick(raw.entrance, ENTRANCES) ?? tpl.entrance,
    logoPosition: pick(raw.logoPosition, POSITIONS) ?? tpl.logoPosition,
    photo,
  };
}

/** Parse the model answer. Null if it is not a JSON object with design fields. Unknown keys dropped, bad values replaced. */
export function parseAiDesign(text: string, ctx: DesignContext): CardDesign | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let o: unknown;
  try { o = JSON.parse(m[0]); } catch { return null; }
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const r = o as Record<string, unknown>;
  if (!["background", "color", "icon", "font", "layout"].some((k) => k in r)) return null;
  return finaliseDesign(r, ctx);
}

/** Deterministic fallback: category template; brand colour from the existing colour logic for generic shops. */
export function fallbackDesign(ctx: DesignContext, colour?: { background: string; secondary: string }): CardDesign {
  const tpl = templateFor(ctx.category);
  const generic = tpl.color === undefined; // only generic/pet shops take the logo colour; themed presets keep theirs
  return finaliseDesign({ ...tpl, ...(generic && colour ? { color: colour.background, secondary: colour.secondary } : {}) }, { ...ctx, coverUrl: null });
}
