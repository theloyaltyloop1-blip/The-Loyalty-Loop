import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { LoyaltyCard } from "../../../packages/card-design/LoyaltyCard";
import {
  BACKGROUNDS,
  ENTRANCES,
  ICONS,
  LAYOUTS,
  POSITIONS,
  TEMPLATES,
  TYPEFACES,
  checkPhoto,
  normalizeDesign,
  designForProgress,
  type CardDesign,
} from "../../../packages/card-design/model";
import { supabase } from "./supabase";
import { showAlert } from "./components/AppAlert";

type Shop = {
  id: string;
  name: string;
  brand_color?: string;
  logo_url?: string | null;
  card_design?: unknown;
  loyalty_type?: string;
  reward_model?: string;
};
function Choices<T extends string>({
  title,
  values,
  value,
  onChange,
  disabled,
}: {
  title: string;
  values: readonly T[];
  value: T;
  onChange: (v: T) => void;
  disabled: boolean;
}) {
  return (
    <View style={s.group}>
      <Text style={s.label}>{title}</Text>
      <View style={s.choices}>
        {values.map((v) => (
          <Pressable
            key={v}
            accessibilityRole="radio"
            aria-checked={value === v}
            accessibilityState={{ checked: value === v, disabled }}
            disabled={disabled}
            onPress={() => onChange(v)}
            style={[s.chip, value === v && s.selected]}
          >
            <Text style={[s.chipText, value === v && s.selectedText]}>
              {v === "logo"
                ? "Shop logo"
                : v.charAt(0).toUpperCase() + v.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function CardDesigner({
  business,
  onSaved,
  preview = false,
  onStateChange,
}: {
  business: Shop;
  onSaved: () => Promise<void>;
  preview?: boolean;
  onStateChange?: (dirty: boolean, busy: boolean) => void;
}) {
  const stamps =
    business.reward_model !== "spend_threshold" &&
    !["points", "tiered"].includes(business.loyalty_type || "");
  const [draft, setDraft] = useState(() =>
    designForProgress(
      normalizeDesign(business.card_design, business.brand_color),
      stamps,
    ),
  );
  const [saved, setSaved] = useState(
    JSON.stringify(
      designForProgress(
        normalizeDesign(business.card_design, business.brand_color),
        stamps,
      ),
    ),
  );
  const [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [replay, setReplay] = useState(0);
  const pendingUpload = useRef<string | null>(null);
  const mounted = useRef(true);
  const set = <K extends keyof CardDesign>(key: K, value: CardDesign[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const locked = busy || uploading,
    dirty = saved !== JSON.stringify(draft);
  useEffect(() => {
    onStateChange?.(dirty, locked);
  }, [dirty, locked, onStateChange]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const path = pendingUpload.current;
      if (path) void supabase.storage.from("covers").remove([path]);
    };
  }, []);

  async function photo() {
    if (preview)
      return showAlert("Preview mode", "Sign in to upload your own photo.");
    setUploading(true);
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted)
        throw new Error("Allow photo access in Settings, then try again.");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [3, 2],
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024)
        throw new Error("Choose a photo smaller than 5 MB.");
      const bytes = await fetch(asset.uri).then((r) => r.arrayBuffer());
      const mime = asset.mimeType || "";
      checkPhoto(asset.width, asset.height, bytes.byteLength, mime);
      const extension =
        mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
      const path = `${business.id}/card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
      const { error } = await supabase.storage
        .from("covers")
        .upload(path, bytes, { contentType: mime, upsert: false });
      if (error) throw new Error(error.message);
      if (!mounted.current) {
        await supabase.storage.from("covers").remove([path]);
        return;
      }
      const previous = pendingUpload.current;
      pendingUpload.current = path;
      const url = supabase.storage.from("covers").getPublicUrl(path)
        .data.publicUrl;
      setDraft((d) => ({ ...d, photo: url, background: "photo" }));
      if (previous) await supabase.storage.from("covers").remove([previous]);
    } catch (e) {
      showAlert(
        "Could not use this photo",
        e instanceof Error ? e.message : "Try another photo.",
      );
    } finally {
      setUploading(false);
    }
  }
  async function save() {
    if (preview)
      return showAlert(
        "Preview mode",
        "Your preview is ready. Sign in as the owner to save.",
      );
    if (![draft.color, draft.secondary].every((c) => /^#[0-9a-f]{6}$/i.test(c)))
      return showAlert(
        "Check your colours",
        "Use a six-digit hex colour, for example #234C40.",
      );
    if (draft.background === "photo" && !draft.photo)
      return showAlert(
        "Choose a photo",
        "Upload a photo or choose another background.",
      );
    if (draft.icon === "logo" && !business.logo_url)
      return showAlert(
        "Add your shop logo first",
        "Use the Shop logo section below, or choose another stamp icon.",
      );
    setBusy(true);
    try {
      const design = normalizeDesign(draft);
      const { data, error } = await supabase
        .from("businesses")
        .update({ card_design: design })
        .eq("id", business.id)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Only the shop owner can save this design.");
      const unusedUpload = design.photo === null ? pendingUpload.current : null;
      pendingUpload.current = null;
      if (unusedUpload)
        void supabase.storage.from("covers").remove([unusedUpload]);
      setSaved(JSON.stringify(design));
      showAlert(
        "Card design saved",
        "Customers see this design when their app next refreshes.",
      );
      await onSaved().catch(() =>
        showAlert(
          "Design saved",
          "Your design is saved, but the shop view could not refresh. Reopen the page to see it.",
        ),
      );
    } catch (e) {
      showAlert(
        "Could not save your design",
        e instanceof Error
          ? e.message
          : "Please try again. Your draft is still here.",
      );
    } finally {
      setBusy(false);
    }
  }
  function reset() {
    showAlert(
      "Discard your changes?",
      "Return to the last saved card design.",
      [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Discard changes",
          style: "destructive",
          onPress: () => {
            setDraft(JSON.parse(saved));
            const path = pendingUpload.current;
            pendingUpload.current = null;
            if (path) void supabase.storage.from("covers").remove([path]);
          },
        },
      ],
    );
  }
  return (
    <View style={s.root}>
      <Text style={s.title}>Design your card</Text>
      <Text style={s.copy}>
        Make it feel like walking into your shop. Start with a template, then
        make it yours.
      </Text>
      <LoyaltyCard
        key={replay}
        shop={{ ...business, card_design: draft }}
        value={4}
        target={10}
        label={stamps ? "4 of 10 stamps" : "Preview of your progress"}
        reward="Sample progress · your reward rules stay the same"
        stamps={stamps}
        animate
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => setReplay((n) => n + 1)}
        style={s.link}
      >
        <Text style={s.linkText}>Replay opening</Text>
      </Pressable>
      <Text style={s.label}>Start with a template</Text>
      <View style={s.choices}>
        {TEMPLATES.map((t) => (
          <Pressable
            accessibilityRole="button"
            disabled={locked}
            key={t.name}
            accessibilityLabel={t.name}
            onPress={() =>
              setDraft(
                designForProgress({ ...t.design, photo: draft.photo }, stamps),
              )
            }
            style={s.template}
          >
            <View
              style={{
                height: 96,
                width: 124,
                overflow: "hidden",
                borderRadius: 8,
              }}
              pointerEvents="none"
            >
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: 310,
                  transform: [{ scale: 0.4 }],
                  transformOrigin: "top left",
                }}
              >
                <LoyaltyCard
                  shop={{
                    ...business,
                    card_design: designForProgress(t.design, stamps),
                  }}
                  value={4}
                  target={10}
                  label="4 / 10"
                  reward={t.name}
                  stamps={stamps}
                  compact
                />
              </View>
            </View>
            <Text style={s.chipText}>{t.name}</Text>
          </Pressable>
        ))}
      </View>
      <Choices
        title="Background"
        values={BACKGROUNDS}
        value={draft.background}
        onChange={(v) => set("background", v)}
        disabled={locked}
      />
      {draft.background === "photo" && (
        <View style={s.group}>
          <Text style={s.copy}>
            Use a clear photo you own. JPEG, PNG or WebP, 640 × 360 pixels
            minimum, up to 5 MB. Keep it suitable for everyone.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={locked}
            onPress={() => void photo()}
            style={s.chip}
          >
            <Text style={s.chipText}>
              {uploading
                ? "Uploading…"
                : draft.photo
                  ? "Replace photo"
                  : "Choose photo"}
            </Text>
          </Pressable>
          {draft.photo && (
            <Pressable
              accessibilityRole="button"
              disabled={locked}
              onPress={() =>
                setDraft((d) => ({ ...d, photo: null, background: "solid" }))
              }
            >
              <Text style={s.linkText}>Remove photo</Text>
            </Pressable>
          )}
        </View>
      )}
      <View style={s.choices}>
        {(["color", "secondary"] as const).map((key) => (
          <View key={key} style={s.colour}>
            <Text style={s.label}>
              {key === "color" ? "Card colour" : "Gradient colour"}
            </Text>
            <TextInput
              accessibilityLabel={
                key === "color" ? "Card hex colour" : "Gradient hex colour"
              }
              value={draft[key]}
              onChangeText={(v) => set(key, v)}
              editable={!locked}
              maxLength={7}
              autoCapitalize="none"
              autoCorrect={false}
              style={s.input}
            />
          </View>
        ))}
      </View>
      <Text style={s.copy}>
        Text automatically switches between light and dark to stay readable.
      </Text>
      <Choices
        title="Stamp icon"
        values={ICONS}
        value={draft.icon}
        onChange={(v) => set("icon", v)}
        disabled={locked}
      />
      <Choices
        title="Typography"
        values={TYPEFACES}
        value={draft.font}
        onChange={(v) => set("font", v)}
        disabled={locked}
      />
      <Choices
        title="Layout"
        values={stamps ? LAYOUTS : (["ring", "jar", "bar"] as const)}
        value={draft.layout}
        onChange={(v) => set("layout", v)}
        disabled={locked}
      />
      {!stamps && (
        <Text style={s.copy}>
          Your programme uses continuous progress. The ring, filling jar and bar
          show that without inventing stamps.
        </Text>
      )}
      <Choices
        title="Logo position"
        values={POSITIONS}
        value={draft.logoPosition}
        onChange={(v) => set("logoPosition", v)}
        disabled={locked}
      />
      <Choices
        title="When the card opens"
        values={ENTRANCES}
        value={draft.entrance}
        onChange={(v) => set("entrance", v)}
        disabled={locked}
      />
      <Text style={s.copy}>
        Opening effects respect the customer's reduced-motion setting. Apple and
        Google Wallet keep their own layouts; this design is for the in-app
        card.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: locked || !dirty, busy }}
        disabled={locked || !dirty}
        onPress={() => void save()}
        style={[s.save, (locked || !dirty) && { opacity: 0.5 }]}
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={s.saveText}>
            {dirty ? "Save card design" : "Design saved"}
          </Text>
        )}
      </Pressable>
      {dirty && (
        <Pressable
          accessibilityRole="button"
          disabled={locked}
          onPress={reset}
          style={s.link}
        >
          <Text style={s.linkText}>Discard changes</Text>
        </Pressable>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  root: { gap: 16, marginBottom: 28 },
  title: {
    fontFamily: "BricolageGrotesque_700Bold",
    fontSize: 30,
    color: "#1C2620",
  },
  copy: { color: "#35443D", fontSize: 15, lineHeight: 22 },
  label: { fontSize: 16, fontWeight: "700", color: "#1C2620" },
  group: { gap: 10, marginTop: 8 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#AAB5AE",
    borderRadius: 22,
  },
  selected: { backgroundColor: "#234C40", borderColor: "#234C40" },
  chipText: { color: "#1C2620", fontSize: 15 },
  selectedText: { color: "#FFFFFF" },
  template: {
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#AAB5AE",
    borderRadius: 14,
    minWidth: 135,
  },
  swatch: { height: 32, borderRadius: 8 },
  colour: { flexGrow: 1, minWidth: 120, gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#AAB5AE",
    borderRadius: 12,
    padding: 12,
    color: "#1C2620",
    backgroundColor: "#FFFFFF",
    fontSize: 16,
  },
  save: {
    minHeight: 50,
    borderRadius: 25,
    backgroundColor: "#234C40",
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { fontWeight: "700", color: "#FFFFFF", fontSize: 16 },
  link: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  linkText: { color: "#234C40", textDecorationLine: "underline", fontSize: 15 },
});
