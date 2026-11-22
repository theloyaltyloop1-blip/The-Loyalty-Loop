import { createContext, useContext, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { withScheme } from "@loyalty-loop/design-tokens";
import { typeface } from "./LoyaltyCard";
import {
  cardAccent,
  cardInk,
  defaultDesignFor,
  foreground,
  normalizeDesign,
  type CardDesign,
} from "./model";

// A shop's whole page takes on its card design, the way a wallet pass does:
// its colour and texture fill the screen, text uses the card's ink and font,
// panels are tints of the shop colour and buttons use its accent.
export type ShopSkin = {
  design: CardDesign;
  bg: string;
  ink: string;
  muted: string;
  panel: string;
  panelBorder: string;
  accent: string;
  onAccent: string;
  dark: boolean;
  font: string;
};

type SkinShop = { card_design?: unknown; category?: string | null; brand_color?: string | null };

const rgba = (hex: string, alpha: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

export function shopSkin(shop: SkinShop): ShopSkin {
  const design = normalizeDesign(shop.card_design ?? defaultDesignFor(shop.category, shop.brand_color), shop.brand_color);
  const ink = cardInk(design.color);
  const dark = foreground(design.color) === "#FFFFFF";
  const accent = cardAccent(design);
  return {
    design,
    bg: design.color,
    ink,
    muted: rgba(ink, 0.72),
    panel: dark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.06)",
    panelBorder: rgba(ink, 0.14),
    accent,
    onAccent: foreground(accent),
    dark,
    font: typeface(design.font),
  };
}

const SkinContext = createContext<ShopSkin | null>(null);
export const ShopSkinProvider = SkinContext.Provider;
export const useShopSkin = () => useContext(SkinContext);

const mix = (hex: string, to: number, t: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.round(v + (to - v) * t).toString(16).padStart(2, "0");
  return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`;
};

// The shop's colour behind the whole page, as a soft top-to-bottom wash of the same
// colour (lighter at the top, deeper at the bottom) with a faint glow in the accent.
// Derived only from the shop's own colour, so every shop gets its own version.
export function ShopBackdrop({ skin }: { skin: ShopSkin }) {
  const top = mix(skin.bg, 255, skin.dark ? 0.1 : 0.28);
  const bottom = mix(skin.bg, 0, skin.dark ? 0.3 : 0.14);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: skin.bg }]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="pageWash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={top} />
            <Stop offset="1" stopColor={bottom} />
          </LinearGradient>
        </Defs>
        <Rect width={100} height={100} fill="url(#pageWash)" />
        <Circle cx={92} cy={12} r={48} fill={skin.accent} opacity={0.1} />
        <Circle cx={4} cy={70} r={34} fill={skin.accent} opacity={0.07} />
      </Svg>
    </View>
  );
}

const greyish = (color: unknown) => {
  if (typeof color !== "string") return false;
  const m = color.match(/^#([0-9a-f]{6})$/i);
  let r: number, g: number, b: number, a = 1;
  if (m) {
    const n = parseInt(m[1], 16);
    [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
  } else {
    const p = color.match(/rgba?\(([^)]+)\)/);
    if (!p) return false;
    [r, g, b, a = 1] = p[1].split(",").map(Number);
  }
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  const level = (r + g + b) / 3;
  return a < 0.9 || (spread < 30 && level > 60 && level < 200);
};

// Recolours a screen's existing styles for the shop's skin. Text takes the
// ink (grey text the muted ink), filled boxes become panels, buttons take the
// accent. Keys in `keep` stay as they are, `clear` keys lose their background.
export function skinStyles<T extends Record<string, any>>(
  styles: T,
  skin: ShopSkin | null,
  { keep = [], clear = [] }: { keep?: string[]; clear?: string[] } = {},
): T {
  if (!skin) return styles;
  // The shop's own design replaces the app's colours, so read the base styles in light:
  // the page looks the same whether the app is in light or dark mode.
  return withScheme("light", () => skinStylesLight(styles, skin, { keep, clear }));
}

function skinStylesLight<T extends Record<string, any>>(
  styles: T,
  skin: ShopSkin,
  { keep = [], clear = [] }: { keep?: string[]; clear?: string[] },
): T {
  const out: Record<string, any> = {};
  for (const key of Object.keys(styles)) {
    const st = StyleSheet.flatten(styles[key]) || {};
    if (keep.includes(key)) { out[key] = styles[key]; continue; }
    const o: Record<string, any> = {};
    const isButton = /button$|cta$/i.test(key) && st.backgroundColor;
    const isButtonText = /buttontext$|ctatext$/i.test(key);
    const isText = "fontSize" in st || "fontWeight" in st || ("color" in st && !("backgroundColor" in st));
    if (clear.includes(key)) o.backgroundColor = "transparent";
    else if (isButton) Object.assign(o, { backgroundColor: skin.accent, borderColor: skin.accent });
    else if (isButtonText) o.color = skin.onAccent;
    else if (isText) {
      o.color = greyish(st.color) ? skin.muted : skin.ink;
      if ((st.fontSize ?? 0) >= 19) o.fontFamily = skin.font;
    }
    if (!clear.includes(key) && !isButton && !isText && st.backgroundColor && st.backgroundColor !== "transparent") o.backgroundColor = skin.panel;
    if (!isButton && st.borderColor) o.borderColor = skin.panelBorder;
    if (!isButton && st.shadowOpacity) o.shadowOpacity = 0;
    out[key] = Object.keys(o).length ? [styles[key], o] : styles[key];
  }
  return out as T;
}

export function useSkinStyles<T extends Record<string, any>>(styles: T, opts?: { keep?: string[]; clear?: string[] }): T {
  const skin = useShopSkin();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => skinStyles(styles, skin, opts), [styles, skin]);
}

// Lifts the card off a page painted in the same colour, like a pass on a wallet page.
export const cardFrame = (skin: ShopSkin) => ({
  borderRadius: 25,
  borderWidth: 1,
  borderColor: skin.dark ? "rgba(255, 255, 255, 0.22)" : "rgba(0, 0, 0, 0.14)",
  shadowColor: "#000000",
  shadowOpacity: skin.dark ? 0.45 : 0.18,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 10 },
  elevation: 8,
  backgroundColor: skin.bg,
});
