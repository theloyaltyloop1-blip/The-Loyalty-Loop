export const BACKGROUNDS = [
  "solid",
  "gradient",
  "kraft",
  "chalkboard",
  "marble",
  "wood",
  "roast",
  "pinstripe",
  "paper",
  "photo",
] as const;
export const ICONS = [
  "coffee",
  "scissors",
  "paw",
  "donut",
  "star",
  "logo",
] as const;
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
export const DEFAULT_DESIGN: CardDesign = {
  version: 1,
  background: "solid",
  color: "#234C40",
  secondary: "#9ABBA3",
  icon: "coffee",
  font: "modern",
  layout: "grid",
  entrance: "stamp",
  logoPosition: "left",
  photo: null,
};
export const TEMPLATES: { name: string; design: CardDesign }[] = [
  {
    name: "Coffee house",
    design: {
      ...DEFAULT_DESIGN,
      background: "roast",
      color: "#3B2A20",
      secondary: "#CE925B",
      icon: "coffee",
      font: "classic",
      layout: "row",
    },
  },
  {
    name: "The barbershop",
    design: {
      ...DEFAULT_DESIGN,
      background: "pinstripe",
      color: "#121212",
      secondary: "#D3AC24",
      icon: "scissors",
      font: "retro",
      layout: "row",
      entrance: "stamp",
    },
  },
  {
    name: "Freshly baked",
    design: {
      ...DEFAULT_DESIGN,
      background: "paper",
      color: "#F7ECD8",
      secondary: "#C26912",
      icon: "donut",
      font: "handwritten",
      layout: "ring",
    },
  },
  {
    name: "Training club",
    design: {
      ...DEFAULT_DESIGN,
      color: "#0C1C2A",
      secondary: "#FF6927",
      icon: "star",
      font: "modern",
      layout: "bar",
      entrance: "flip",
    },
  },
];
// Shops that haven't designed a card yet still get one, chosen from their
// category, so every card in the shopper app is a designed card.
export function defaultDesignFor(category?: string | null, brand?: string | null): CardDesign {
  const c = (category || "").toLowerCase();
  const pick = (name: string) => TEMPLATES.find((t) => t.name === name)!.design;
  if (/caf|coffee|tea/.test(c)) return pick("Coffee house");
  if (/barber|hair|salon|beauty|nail/.test(c)) return pick("The barbershop");
  if (/bak|cake|dessert|patisser|sweet/.test(c)) return pick("Freshly baked");
  if (/gym|fitness|sport|yoga|train/.test(c)) return pick("Training club");
  return { ...DEFAULT_DESIGN, color: hex(brand, DEFAULT_DESIGN.color), secondary: "#F2C46D", icon: "star" };
}
const hex = (v: unknown, fallback: string) =>
  typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
function one<T extends string>(
  v: unknown,
  values: readonly T[],
  fallback: T,
): T {
  return values.includes(v as T) ? (v as T) : fallback;
}
export function normalizeDesign(
  value: unknown,
  brand?: string | null,
): CardDesign {
  const d =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    version: 1,
    background: one(d.background, BACKGROUNDS, "solid"),
    color: hex(d.color, hex(brand, DEFAULT_DESIGN.color)),
    secondary: hex(d.secondary, DEFAULT_DESIGN.secondary),
    icon: one(d.icon, ICONS, "coffee"),
    font: one(d.font, TYPEFACES, "modern"),
    layout: one(d.layout, LAYOUTS, "grid"),
    entrance: one(d.entrance, ENTRANCES, "stamp"),
    logoPosition: one(d.logoPosition, POSITIONS, "left"),
    photo:
      typeof d.photo === "string" &&
      /^https:\/\//.test(d.photo) &&
      d.photo.length <= 2048
        ? d.photo
        : null,
  };
}
function luminance(color: string) {
  const rgb = color
    .slice(1)
    .match(/../g)!
    .map((v) => {
      const n = parseInt(v, 16) / 255;
      return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
// Text always lives on an opaque colour panel, even with photos and gradients.
export function foreground(color: string) {
  return luminance(hex(color, DEFAULT_DESIGN.color)) > 0.179
    ? "#000000"
    : "#FFFFFF";
}
export function cardProgress(value: number, target: number) {
  const total = Number.isFinite(target) && target > 0 ? target : 1;
  const current = Number.isFinite(value) ? Math.max(0, value) : 0;
  return {
    fraction: Math.min(1, current / total),
    slots: Math.min(20, Math.max(1, Math.ceil(total))),
    current,
    total,
  };
}
export function checkPhoto(
  width: number,
  height: number,
  bytes: number,
  mime: string,
) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime))
    throw new Error("Choose a JPEG, PNG or WebP photo.");
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > 5 * 1024 * 1024)
    throw new Error("Choose a photo smaller than 5 MB.");
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 640 ||
    height < 360 ||
    width > 12000 ||
    height > 12000
  )
    throw new Error(
      "Choose a clear photo at least 640 × 360 pixels and no larger than 12,000 pixels.",
    );
}

export function contrast(a: string, b: string) {
  const lum = (c: string) => {
    const v = c
      .slice(1)
      .match(/../g)!
      .map((x) => {
        const n = parseInt(x, 16) / 255;
        return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
      });
    return v[0] * 0.2126 + v[1] * 0.7152 + v[2] * 0.0722;
  };
  const x = lum(a),
    y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function cardInk(color: string) {
  const base = foreground(color);
  const preferred = base === "#FFFFFF" ? "#F4E9D7" : "#633719";
  return contrast(color, preferred) >= 4.5 ? preferred : base;
}
export function cardAccent(d: CardDesign) {
  return contrast(d.color, d.secondary) >= 3
    ? d.secondary
    : foreground(d.color);
}

export function designForProgress(
  design: CardDesign,
  stamps: boolean,
): CardDesign {
  return !stamps && (design.layout === "grid" || design.layout === "row")
    ? { ...design, layout: "ring" }
    : design;
}

// Bound decoration opacity so even overlapping light/dark texture lines preserve text contrast.
export function materialOpacity(color: string) { const ink = cardInk(color); const blend = (end: number, alpha: number) => '#' + color.slice(1).match(/../g)!.map(v => Math.round(parseInt(v,16)*(1-alpha)+end*alpha).toString(16).padStart(2,'0')).join(''); let opacity=1; while(opacity>0 && Math.min(contrast(blend(0,.65*opacity),ink),contrast(blend(255,.65*opacity),ink))<4.5) opacity=Math.max(0,opacity-.01); return opacity; }
