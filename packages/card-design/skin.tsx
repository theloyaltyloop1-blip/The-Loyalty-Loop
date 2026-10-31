import { createContext, useContext, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Material, typeface } from "./LoyaltyCard";
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
    panel: dark ? "rgba(255, 255, 255, 0.09)" : "rgba(255, 255, 255, 0.55)",
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

// The shop's colour and texture behind the whole page.
export function ShopBackdrop({ skin }: { skin: ShopSkin }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: skin.bg }]}
      onLayout={(e) => setSize({ w: Math.round(e.nativeEvent.layout.width), h: Math.round(e.nativeEvent.layout.height) })}
    >
      {size.w > 0 && skin.design.background !== "photo" ? <Material d={skin.design} w={size.w} h={size.h} /> : null}
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
