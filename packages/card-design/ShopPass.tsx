import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { StampIcon } from "./LoyaltyCard";
import type { ShopSkin } from "./skin";

// The top of a shop page, laid out like a Google Wallet pass in three planes:
// the shop name poster-sized at the back, the round logo overlapping its lower
// edge in the middle, and the code tile / join button lifted on top. Type is
// either huge (name, count) or tiny caps (labels), nothing in between.
export type PassField = { label: string; value: string };

export function ShopPass({
  skin,
  shop,
  eyebrow,
  stamps,
  count,
  progress,
  progressLabel,
  code,
  fields,
  action,
  topBar,
  wrapStamp,
}: {
  skin: ShopSkin;
  shop: { name: string; logo_url?: string | null; cover_url?: string | null };
  eyebrow: string;
  stamps: { filled: number; total: number } | null;
  /** The big number on a member's card ("3" of "/6"); hidden when null. */
  count?: { value: string; of: string } | null;
  progress: number | null;
  progressLabel: string | null;
  code: ReactNode;
  fields: PassField[];
  action?: ReactNode;
  topBar: ReactNode;
  /** Lets the app animate a stamp (e.g. a freshly earned one). This package
   * stays animation-free so the website and both apps can share it. */
  wrapStamp?: (index: number, stamp: ReactNode) => ReactNode;
}) {
  const d = skin.design;
  const ink = skin.ink;
  return (
    <View style={{ backgroundColor: skin.bg }}>
      <View style={s.topBar}>{topBar}</View>
      <View style={s.centre}>
        <Text style={[s.eyebrow, { color: ink }]} numberOfLines={1}>{eyebrow}</Text>
        {/* Back plane: the name, poster-sized. */}
        <Text accessibilityRole="header" style={[s.title, { color: ink, fontFamily: skin.font }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.45}>{shop.name}</Text>
        {/* Middle plane: the logo, ringed in the page colour so it reads as cut out over the name. */}
        <View style={[s.logo, { borderColor: skin.bg }]}>
          {shop.logo_url ? (
            <Image source={{ uri: shop.logo_url }} style={s.logoImage} />
          ) : (
            <Text style={[s.logoLetter, { color: skin.dark ? d.color : skin.ink, fontFamily: skin.font }]}>{shop.name.charAt(0).toUpperCase()}</Text>
          )}
        </View>

        {count ? (
          <View style={s.countRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text style={[s.countValue, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit>{count.value}</Text>
            <Text style={[s.countOf, { color: ink }]} numberOfLines={1}>{count.of}</Text>
          </View>
        ) : null}
        {stamps ? (
          <View style={s.stampRow} accessibilityLabel={progressLabel ?? undefined}>
            {Array.from({ length: stamps.total }, (_, i) => {
              const filled = i < stamps.filled;
              const stamp = (
                <View style={[s.stamp, { borderColor: filled ? skin.accent : skin.panelBorder, backgroundColor: filled ? skin.accent : "transparent" }]}>
                  {filled ? <StampIcon icon={d.icon} color={skin.onAccent} size={22} /> : null}
                </View>
              );
              return <View key={i}>{wrapStamp ? wrapStamp(i, stamp) : stamp}</View>;
            })}
          </View>
        ) : progress !== null ? (
          <View style={[s.track, { backgroundColor: skin.panelBorder }]} accessibilityRole="progressbar">
            <View style={[s.fill, { width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`, backgroundColor: skin.accent }]} />
          </View>
        ) : null}
        {progressLabel ? <Text style={[s.progressLabel, count && s.progressLabelBig, { color: ink }]}>{progressLabel}</Text> : null}

        {code ? <View style={s.codeTile}>{code}</View> : null}
        {action}
      </View>

      {fields.length ? (
        <View style={s.fields}>
          {fields.map((f, i) => (
            <View key={f.label} style={[s.field, i % 2 === 1 && s.fieldRight]}>
              <Text style={[s.fieldLabel, { color: ink }]}>{f.label}</Text>
              <Text style={[s.fieldValue, { color: ink }, i % 2 === 1 && { textAlign: "right" }]} numberOfLines={2}>{f.value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {shop.cover_url ? <Image source={{ uri: shop.cover_url }} style={s.cover} resizeMode="cover" /> : null}
    </View>
  );
}

// A soft row in the shop's colour, like Wallet's "View pass photo".
export function PassRow({ skin, icon, label, onPress, right }: { skin: ShopSkin; icon?: ReactNode; label: string; onPress?: () => void; right?: ReactNode }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={!onPress} style={({ pressed }) => [s.row, { backgroundColor: skin.panel }, pressed && { opacity: 0.8 }]}>
      {icon}
      <Text style={[s.rowLabel, { color: skin.ink }]} numberOfLines={2}>{label}</Text>
      {right}
    </Pressable>
  );
}

const s = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 4, minHeight: 52 },
  centre: { alignItems: "center", paddingHorizontal: 24 },
  logo: { width: 96, height: 96, borderRadius: 48, borderWidth: 5, marginTop: -30, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  logoImage: { width: "100%", height: "100%" },
  logoLetter: { fontSize: 40, fontWeight: "800" },
  eyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 1.8, textTransform: "uppercase", marginTop: 4, opacity: 0.75 },
  title: { fontSize: 76, lineHeight: 74, fontWeight: "800", textAlign: "center", textTransform: "uppercase", marginTop: 10, letterSpacing: -2, alignSelf: "stretch", includeFontPadding: false },
  countRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", marginTop: 18, maxWidth: "100%" },
  countValue: { fontFamily: "Inter_800ExtraBold", fontSize: 132, lineHeight: 132, letterSpacing: -8, includeFontPadding: false, fontVariant: ["tabular-nums"] },
  countOf: { fontFamily: "Inter_700Bold", fontSize: 44, lineHeight: 58, letterSpacing: -2, opacity: 0.5, marginLeft: 4, includeFontPadding: false, fontVariant: ["tabular-nums"] },
  stampRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 22, maxWidth: 342 },
  stamp: { width: 44, height: 44, borderRadius: 14, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  track: { height: 14, borderRadius: 7, alignSelf: "stretch", marginTop: 24, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 7 },
  progressLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase", marginTop: 14, textAlign: "center", opacity: 0.85 },
  progressLabelBig: { fontSize: 12, lineHeight: 17, marginTop: 16, maxWidth: 300 },
  // Top plane: the code floats above the pass.
  codeTile: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 22, marginTop: 26, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 22, shadowOffset: { width: 0, height: 14 }, elevation: 10 },
  fields: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 24, paddingTop: 30, paddingBottom: 26, rowGap: 22 },
  field: { width: "50%", paddingRight: 8 },
  fieldRight: { alignItems: "flex-end", paddingRight: 0, paddingLeft: 8 },
  fieldLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 1.4, textTransform: "uppercase", opacity: 0.7 },
  fieldValue: { fontSize: 20, fontWeight: "800", letterSpacing: -0.3, marginTop: 4 },
  cover: { width: "100%", height: 240 },
  row: { flexDirection: "row", alignItems: "center", gap: 16, minHeight: 64, paddingHorizontal: 20, borderRadius: 22 },
  rowLabel: { flex: 1, fontSize: 17, fontWeight: "600" },
});
