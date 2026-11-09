import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MapPin, Minus, Plus, Search, X } from "lucide-react-native";
import { colors, fonts } from "@loyalty-loop/design-tokens";
import {
  MAX_ZOOM,
  MIN_PIN_ZOOM,
  MIN_ZOOM,
  TILE_SIZE,
  panned,
  roundPin,
  tilesFor,
  type LatLng,
} from "./tile-map";

// Lets an owner put their shop on the shoppers' map. The pin stays in the middle
// of the screen and the owner moves the map underneath it.
//
// The Business app has no native map module, and adding one would need new store
// builds. So this draws OpenStreetMap image tiles with plain React Native views,
// which ships as an ordinary over-the-air update. Address lookup uses
// OpenStreetMap's Nominatim, once per search (never as-you-type, per its rules).

const ink = "#1A2138";
const APP_AGENT = "TheLoyaltyLoopBusiness/1.0 (https://www.the-loyalty-loop.com)";
const STREET_ZOOM = 18;

const COUNTRY_VIEW: Record<string, { center: LatLng; zoom: number }> = {
  GB: { center: { lat: 54.3, lng: -2.6 }, zoom: 6 },
  PK: { center: { lat: 30.2, lng: 69.4 }, zoom: 6 },
};
const WORLD_VIEW = { center: { lat: 25, lng: 10 }, zoom: MIN_ZOOM };

async function findAddress(query: string, countryCode?: string | null): Promise<LatLng | null> {
  const q = query.trim();
  if (!q) return null;
  const params = [`format=jsonv2`, `limit=1`, `q=${encodeURIComponent(q)}`];
  if (countryCode) params.push(`countrycodes=${encodeURIComponent(countryCode.toLowerCase())}`);
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.join("&")}`, {
      headers: { "User-Agent": APP_AGENT, "Accept-Language": "en" },
    });
    if (!response.ok) return null;
    const results = (await response.json()) as { lat?: string; lon?: string }[];
    const lat = Number(results[0]?.lat);
    const lng = Number(results[0]?.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

export function MapPinPicker({
  visible,
  pin,
  addressQuery,
  countryCode,
  onSave,
  onClose,
}: {
  visible: boolean;
  /** The shop's saved pin, if it has one. */
  pin: LatLng | null;
  /** Address and postcode as typed, used to start the map in the right place. */
  addressQuery: string;
  countryCode?: string | null;
  /** Saves the pin (or removes it with null). Throw to keep the picker open. */
  onSave: (pin: LatLng | null) => Promise<void>;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const fallback = COUNTRY_VIEW[(countryCode || "GB").toUpperCase()] ?? WORLD_VIEW;
  const [center, setCenter] = useState<LatLng>(pin ?? fallback.center);
  const [zoom, setZoom] = useState(pin ? STREET_ZOOM : fallback.zoom);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [search, setSearch] = useState("");
  const [finding, setFinding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<"save" | "remove" | null>(null);

  const lookUp = async (query: string, quiet = false) => {
    if (!query.trim()) return;
    Keyboard.dismiss();
    setFinding(true);
    setNotice(null);
    const found = await findAddress(query, countryCode);
    setFinding(false);
    if (found) {
      setCenter(found);
      setZoom(STREET_ZOOM);
    } else {
      setNotice(quiet ? "We couldn't find your address. Search for your street, or move the map to your shop." : "Nothing found. Try a street name, town or postcode.");
    }
  };

  // Start fresh each time it opens: on the saved pin, else at the typed address.
  useEffect(() => {
    if (!visible) return;
    setSearch("");
    setNotice(null);
    setSaving(null);
    setCenter(pin ?? fallback.center);
    setZoom(pin ? STREET_ZOOM : fallback.zoom);
    if (!pin && addressQuery.trim()) void lookUp(addressQuery, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // The drag handler is created once, so it reads the latest values from refs.
  const live = useRef({ center, zoom });
  live.current = { center, zoom };
  const dragStart = useRef<LatLng>(center);
  const drag = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        Keyboard.dismiss();
        dragStart.current = live.current.center;
      },
      onPanResponderMove: (_event, gesture) => {
        setCenter(panned(dragStart.current, live.current.zoom, gesture.dx, gesture.dy));
      },
    }),
  ).current;

  const tiles = useMemo(() => tilesFor(center, zoom, size.width, size.height), [center, zoom, size.width, size.height]);
  const closeEnough = zoom >= MIN_PIN_ZOOM;
  const busy = saving !== null;

  const save = async (next: LatLng | null) => {
    setSaving(next ? "save" : "remove");
    try {
      await onSave(next ? roundPin(next) : null);
    } catch {
      setSaving(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.page, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Put your shop on the map</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={10} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <X size={20} color={ink} />
          </Pressable>
        </View>

        <View style={styles.searchBar}>
          <Search size={19} color={ink} />
          <TextInput
            accessibilityLabel="Search for a street, town or postcode"
            style={styles.searchInput}
            placeholder="Search street, town or postcode"
            placeholderTextColor="#6B6A66"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCorrect={false}
            onSubmitEditing={() => void lookUp(search)}
          />
          {finding ? <ActivityIndicator color={ink} /> : null}
        </View>

        <View style={styles.map} onLayout={(event) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })} {...drag.panHandlers}>
          {tiles.map((tile) => (
            <Image
              key={tile.key}
              source={{ uri: `https://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`, headers: { "User-Agent": APP_AGENT } }}
              fadeDuration={0}
              style={[styles.tile, { left: tile.left, top: tile.top }]}
            />
          ))}
          {size.width > 0 && (
            <View pointerEvents="none" style={[styles.pin, { left: size.width / 2 - 22, top: size.height / 2 - 42 }]}>
              <MapPin size={44} color="#fff" fill={colors.primary} strokeWidth={1.6} />
            </View>
          )}
          {size.width > 0 && <View pointerEvents="none" style={[styles.pinShadow, { left: size.width / 2 - 7, top: size.height / 2 - 3 }]} />}
          <View style={styles.zoom}>
            <Pressable accessibilityRole="button" accessibilityLabel="Zoom in" disabled={zoom >= MAX_ZOOM} onPress={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))} style={({ pressed }) => [styles.zoomButton, styles.zoomDivider, pressed && styles.pressed, zoom >= MAX_ZOOM && styles.faded]}>
              <Plus size={22} color={ink} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Zoom out" disabled={zoom <= MIN_ZOOM} onPress={() => setZoom((z) => Math.max(MIN_ZOOM, z - 1))} style={({ pressed }) => [styles.zoomButton, pressed && styles.pressed, zoom <= MIN_ZOOM && styles.faded]}>
              <Minus size={22} color={ink} />
            </Pressable>
          </View>
          <Text style={styles.credit}>© OpenStreetMap</Text>
        </View>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) + 6 }]}>
          <Text style={styles.hint}>
            {notice ?? (closeEnough ? "Move the map until the pin sits on your shop's door." : "Zoom in closer so the pin lands on the right building.")}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={!closeEnough || busy}
            onPress={() => void save(center)}
            style={({ pressed }) => [styles.save, (!closeEnough || busy) && styles.saveDisabled, pressed && styles.pressed]}
          >
            {saving === "save" ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{pin ? "Move pin here" : "Save pin"}</Text>}
          </Pressable>
          {pin ? (
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void save(null)} style={({ pressed }) => [styles.remove, pressed && styles.pressed]}>
              <Text style={styles.removeText}>{saving === "remove" ? "Removing…" : "Take my shop off the map"}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginBottom: 12 },
  title: { flex: 1, fontSize: 22, fontFamily: fonts.nativeDisplay, color: ink, letterSpacing: -0.4 },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(20,20,18,.07)", alignItems: "center", justifyContent: "center" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 18,
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(20,20,18,.1)",
  },
  searchInput: { flex: 1, fontSize: 15.5, color: ink, paddingVertical: 12 },
  map: { flex: 1, overflow: "hidden", backgroundColor: "#E6E2D8" },
  tile: { position: "absolute", width: TILE_SIZE, height: TILE_SIZE },
  pin: { position: "absolute", width: 44, height: 44, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } },
  pinShadow: { position: "absolute", width: 14, height: 6, borderRadius: 7, backgroundColor: "rgba(0,0,0,.28)" },
  zoom: {
    position: "absolute",
    right: 14,
    top: 14,
    borderRadius: 16,
    backgroundColor: "#fff",
    shadowColor: "#1A2138",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  zoomButton: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  zoomDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(20,20,18,.18)" },
  faded: { opacity: 0.3 },
  credit: { position: "absolute", left: 8, bottom: 6, fontSize: 10.5, color: "#3B3A36", backgroundColor: "rgba(255,255,255,.8)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: "hidden" },
  footer: { paddingHorizontal: 20, paddingTop: 14, backgroundColor: colors.background },
  hint: { fontSize: 14, lineHeight: 20, color: ink, textAlign: "center", marginBottom: 12, fontWeight: "600" },
  save: { minHeight: 54, borderRadius: 18, backgroundColor: ink, alignItems: "center", justifyContent: "center" },
  saveDisabled: { opacity: 0.35 },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  remove: { alignItems: "center", paddingVertical: 14 },
  removeText: { color: "#B73B32", fontSize: 14, fontWeight: "800" },
  pressed: { opacity: 0.72 },
});
