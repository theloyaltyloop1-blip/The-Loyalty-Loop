import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { StampIcon } from "./LoyaltyCard";
import type { ShopSkin } from "./skin";

// The top of a shop page, laid out like a Google Wallet pass: one flat colour,
// a round logo, the shop name large in its card font, the stamps, the code on
// a white tile, then label/value details and the shop's photo as a band.
export type PassField = { label: string; value: string };

export function ShopPass({
  skin,
  shop,
  eyebrow,
  stamps,
  progress,
  progressLabel,
  code,
  fields,
  action,
  topBar,
}: {
  skin: ShopSkin;
  shop: { name: string; logo_url?: string | null; cover_url?: string | null };
  eyebrow: string;
  stamps: { filled: number; total: number } | null;
  progress: number | null;
  progressLabel: string | null;
  code: ReactNode;
  fields: PassField[];
  action?: ReactNode;
  topBar: ReactNode;
}) {
  const d = skin.design;
  const ink = skin.ink;
  return (
    <View style={{ backgroundColor: skin.bg }}>
      <View style={s.topBar}>{topBar}</View>
      <View style={s.centre}>
        <View style={s.logo}>
          {shop.logo_url ? (
            <Image source={{ uri: shop.logo_url }} style={s.logoImage} />
          ) : (
            <Text style={[s.logoLetter, { color: skin.dark ? d.color : skin.ink, fontFamily: skin.font }]}>{shop.name.charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <Text style={[s.eyebrow, { color: ink }]} numberOfLines={1}>{eyebrow}</Text>
        <Text style={[s.title, { color: ink, fontFamily: skin.font }]} numberOfLines={2} adjustsFontSizeToFit>{shop.name}</Text>

        {stamps ? (
          <View style={s.stampRow} accessibilityLabel={progressLabel ?? undefined}>
            {Array.from({ length: stamps.total }, (_, i) => {
              const filled = i < stamps.filled;
              return (
                <View key={i} style={[s.stamp, { borderColor: filled ? skin.accent : skin.panelBorder, backgroundColor: filled ? skin.accent : "transparent" }]}>
                  {filled ? <StampIcon icon={d.icon} color={skin.onAccent} size={16} /> : null}
                </View>
              );
            })}
          </View>
        ) : progress !== null ? (
          <View style={[s.track, { backgroundColor: skin.panelBorder }]} accessibilityRole="progressbar">
            <View style={[s.fill, { width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`, backgroundColor: skin.accent }]} />
          </View>
        ) : null}
        {progressLabel ? <Text style={[s.progressLabel, { color: ink }]}>{progressLabel}</Text> : null}

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
  logo: { width: 92, height: 92, borderRadius: 46, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  logoImage: { width: "100%", height: "100%" },
  logoLetter: { fontSize: 40, fontWeight: "800" },
  eyebrow: { fontSize: 16, fontWeight: "500", marginTop: 16, opacity: 0.9 },
  title: { fontSize: 44, lineHeight: 50, fontWeight: "800", textAlign: "center", marginTop: 6, letterSpacing: -0.5 },
  stampRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 22, maxWidth: 342 },
  stamp: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  track: { height: 8, borderRadius: 4, alignSelf: "stretch", marginTop: 24, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  progressLabel: { fontSize: 15, fontWeight: "600", marginTop: 12, textAlign: "center" },
  codeTile: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 22, marginTop: 26, alignItems: "center" },
  fields: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 24, paddingTop: 30, paddingBottom: 26, rowGap: 22 },
  field: { width: "50%", paddingRight: 8 },
  fieldRight: { alignItems: "flex-end", paddingRight: 0, paddingLeft: 8 },
  fieldLabel: { fontSize: 14, opacity: 0.85 },
  fieldValue: { fontSize: 18, fontWeight: "700", marginTop: 3 },
  cover: { width: "100%", height: 240 },
  row: { flexDirection: "row", alignItems: "center", gap: 16, minHeight: 64, paddingHorizontal: 20, borderRadius: 22 },
  rowLabel: { flex: 1, fontSize: 17, fontWeight: "600" },
});
