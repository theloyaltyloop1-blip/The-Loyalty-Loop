import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  AppState,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import Svg, { Polyline } from "react-native-svg";
import {
  BadgeCheck,
  ChartNoAxesCombined,
  Gift,
  LayoutDashboard,
  Newspaper,
  Settings,
  Sparkles,
  Stamp,
  Star,
  Users,
} from "lucide-react-native";
import type { Session } from "@supabase/supabase-js";
import { colors } from "@loyalty-loop/design-tokens";
import { hasSupabaseConfig, supabase } from "./src/supabase";
import { NativeOwnerPageView, type NativeOwnerPage } from "./src/owner-pages";
import { biometricLockEnabled, setBiometricLock, unlockWithBiometrics } from "./src/biometric";
import { registerPushToken } from "./src/push";

function BusinessLanding({ onContinue }: { onContinue: () => void }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.auth}>
        <View style={styles.mark}>
          <Text style={styles.markText}>↻</Text>
        </View>
        <Text style={styles.eyebrow}>THE LOYALTY LOOP FOR BUSINESS</Text>
        <Text style={styles.hero}>Turn visits into{`\n`}regulars.</Text>
        <Text style={styles.copy}>
          A simple loyalty programme for independent businesses and the teams
          that run them.
        </Text>
        <View style={styles.card}>
          <Text style={styles.section}>Reward customers in seconds</Text>
          <Text style={styles.copy}>
            Scan their personal QR code or enter their code at the counter.
          </Text>
          <Text style={styles.section}>Keep every shop in sync</Text>
          <Text style={styles.copy}>
            Give owners and staff access to the businesses they work with.
          </Text>
          <Text style={styles.section}>Grow with clarity</Text>
          <Text style={styles.copy}>
            See your loyalty activity and customer progress in one place.
          </Text>
        </View>
        <Button title="Sign in to your business" onPress={onContinue} />
        <Text style={styles.small}>
          New business? Create your loyalty programme on The Loyalty Loop
          website.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

type Business = {
  id: string;
  name: string;
  category?: string | null;
  description?: string | null;
  address?: string | null;
  postcode?: string | null;
  phone?: string | null;
  website?: string | null;
  brand_color?: string;
  logo_url?: string | null;
  cover_url?: string | null;
  is_active?: boolean;
  loyalty_type?: "stamp_card" | "points" | "tiered";
  loyalty_config?: {
    stamps_required?: number;
    signup_reward_title?: string;
    stamp_icon?: string;
  };
};
type StaffBusiness = {
  business_id: string;
  can_scan_stamps?: boolean;
  can_redeem_rewards?: boolean;
  business?: Business | Business[] | null;
};
type DashboardStats = {
  members: number;
  stamps: number;
  rewards: number;
  redeemed: number;
  reviews: number;
  activeMembers: number;
  dormantMembers: number;
};
type MemberRow = {
  user_id: string;
  first_name?: string | null;
  last_name?: string | null;
  stamp_count: number;
  points_balance: number;
  visit_count: number;
  last_activity_at?: string | null;
  joined_at: string;
};
type ScannedMemberDetails = MemberRow & { id: string; email?: string | null };
type Announcement = {
  id: string;
  title: string;
  body?: string | null;
  is_active: boolean;
  created_at: string;
};
const PREVIEW_BUSINESS: Business = {
  id: "00000000-0000-0000-0000-000000000000",
  name: "The Coffee Corner",
  category: "Cafe",
  description: "Fresh coffee, pastries and friendly faces.",
  address: "12 Market Street",
  postcode: "M1 1AA",
  phone: "0161 555 0102",
  brand_color: "#E8703B",
  is_active: true,
  loyalty_type: "stamp_card",
  loyalty_config: {
    stamps_required: 10,
    signup_reward_title: "A free coffee for joining",
  },
};
const PREVIEW_STATS: DashboardStats = {
  members: 148,
  stamps: 624,
  rewards: 57,
  redeemed: 43,
  reviews: 32,
  activeMembers: 96,
  dormantMembers: 52,
};
function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}
type DailyPoint = {
  stamps: number;
  visits: number;
  newCustomers: number;
  oldCustomers: number;
};
function dayKey(iso: string) {
  return iso.slice(0, 10);
}
function buildDailySeries(
  period: 7 | 30 | 90,
  txRows: { created_at: string; value: number; user_id: string }[],
  memberRows: { user_id: string; joined_at: string }[],
): DailyPoint[] {
  const joinedAt = new Map(memberRows.map((m) => [m.user_id, m.joined_at]));
  const days: string[] = [];
  for (let i = period - 1; i >= 0; i--) {
    days.push(dayKey(new Date(Date.now() - i * 86400000).toISOString()));
  }
  return days.map((day) => {
    const rowsToday = txRows.filter((r) => dayKey(r.created_at) === day);
    const visitors = new Set(rowsToday.map((r) => r.user_id));
    let newCustomers = 0,
      oldCustomers = 0;
    visitors.forEach((userId) => {
      const joined = joinedAt.get(userId);
      if (joined && dayKey(joined) === day) newCustomers++;
      else oldCustomers++;
    });
    return {
      stamps: rowsToday.reduce((sum, r) => sum + (r.value || 0), 0),
      visits: visitors.size,
      newCustomers,
      oldCustomers,
    };
  });
}
function buildPreviewDailySeries(period: 7 | 30 | 90): DailyPoint[] {
  return Array.from({ length: period }, (_, i) => ({
    stamps: Math.round(4 + Math.sin(i / 3) * 3 + i / 6),
    visits: Math.round(3 + Math.cos(i / 4) * 2 + i / 8),
    newCustomers: Math.round(1 + Math.sin(i / 5) * 1.2),
    oldCustomers: Math.round(2 + Math.cos(i / 3) * 1.5 + i / 10),
  }));
}
function MiniLineChart({
  data,
  aKey,
  bKey,
  aLabel,
  bLabel,
  aColor,
  bColor,
}: {
  data: DailyPoint[];
  aKey: keyof DailyPoint;
  bKey: keyof DailyPoint;
  aLabel: string;
  bLabel: string;
  aColor: string;
  bColor: string;
}) {
  const max = Math.max(1, ...data.map((d) => Math.max(d[aKey], d[bKey])));
  const stepX = data.length > 1 ? 100 / (data.length - 1) : 100;
  const toPoints = (key: keyof DailyPoint) =>
    data
      .map((d, i) => `${i * stepX},${38 - (d[key] / max) * 34}`)
      .join(" ");
  return (
    <View>
      <View style={styles.chartWrap}>
        <Svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
          <Polyline
            points={toPoints(bKey)}
            fill="none"
            stroke={bColor}
            strokeWidth={1.6}
            vectorEffect="non-scaling-stroke"
          />
          <Polyline
            points={toPoints(aKey)}
            fill="none"
            stroke={aColor}
            strokeWidth={1.6}
            vectorEffect="non-scaling-stroke"
          />
        </Svg>
      </View>
      <View style={styles.chartLegendRow}>
        <View style={styles.chartLegendItem}>
          <View style={[styles.legendDot, { backgroundColor: aColor }]} />
          <Text style={styles.legendLabel}>{aLabel}</Text>
        </View>
        <View style={styles.chartLegendItem}>
          <View style={[styles.legendDot, { backgroundColor: bColor }]} />
          <Text style={styles.legendLabel}>{bLabel}</Text>
        </View>
      </View>
    </View>
  );
}
const { foreground: green, primary: orange, background: cream } = colors;

function Button({
  title,
  onPress,
  secondary,
  disabled,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        secondary && styles.secondary,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>
        {title}
      </Text>
    </Pressable>
  );
}

function Auth({ onSession }: { onSession: (session: Session) => void }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false);
  async function signIn() {
    if (!email.trim() || !password)
      return Alert.alert(
        "Check your details",
        "Enter your business email and password.",
      );
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      onSession(data.session);
    } catch (e) {
      Alert.alert(
        "Could not sign in",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.auth}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.mark}>
          <Text style={styles.markText}>↻</Text>
        </View>
        <Text style={styles.eyebrow}>THE LOYALTY LOOP FOR BUSINESS</Text>
        <Text style={styles.hero}>Your regulars,{"\n"}all in one place.</Text>
        <Text style={styles.copy}>
          Sign in as an owner or staff member to reward customers at your shop.
        </Text>
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Business email address"
            placeholderTextColor="#111111"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#111111"
            secureTextEntry
          />
          <Button
            title={busy ? "Signing in…" : "Sign in to business"}
            onPress={signIn}
            disabled={busy}
          />
        </View>
        <Text style={styles.small}>
          Customer account? Use The Loyalty Loop shopper app.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ShopPicker({
  shops,
  selected,
  onSelect,
}: {
  shops: Business[];
  selected: Business | null;
  onSelect: (shop: Business) => void;
}) {
  if (!shops.length)
    return (
      <View style={styles.card}>
        <Text style={styles.section}>No business found</Text>
        <Text style={styles.copy}>
          This account has no active owner or staff shop yet. Ask the owner to
          invite you, or finish business onboarding on the website.
        </Text>
      </View>
    );
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.shopPicker}
    >
      {shops.map((shop) => (
        <Pressable
          key={shop.id}
          onPress={() => onSelect(shop)}
          style={[
            styles.shopChip,
            selected?.id === shop.id && {
              backgroundColor: shop.brand_color || green,
            },
          ]}
        >
          {shop.logo_url ? (
            <Image
              source={{ uri: shop.logo_url }}
              style={{ width: 22, height: 22, borderRadius: 11 }}
            />
          ) : null}
          <Text
            style={[
              styles.chipText,
              selected?.id === shop.id && { color: "#fff" },
            ]}
          >
            {shop.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function StampsScreen({
  business,
  mode,
  onModeChange,
  onDone,
  onConfigureRewards,
}: {
  business: Business;
  mode: "stamps" | "reward";
  onModeChange: (mode: "stamps" | "reward") => void;
  onDone: () => void;
  onConfigureRewards: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [hasReward, setHasReward] = useState<boolean | null>(null);
  const [camera, setCamera] = useState(false);
  const [code, setCode] = useState("");
  const [matched, setMatched] = useState<{
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null>(null);
  const [memberInfo, setMemberInfo] = useState<{
    joined_at?: string | null;
    last_activity_at?: string | null;
  } | null>(null);
  const [activeReward, setActiveReward] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [amount, setAmount] = useState(1);
  const [busy, setBusy] = useState(false);
  const unit =
    business.loyalty_type === "points"
      ? "points"
      : business.loyalty_type === "tiered"
        ? "visits"
        : "stamps";
  useEffect(() => {
    let active = true;
    setHasReward(null);
    void supabase
      .from("reward_catalog")
      .select("id")
      .eq("business_id", business.id)
      .limit(1)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          Alert.alert("Could not check rewards", error.message);
          setHasReward(false);
          return;
        }
        setHasReward((data || []).length > 0);
      });
    return () => {
      active = false;
    };
  }, [business.id]);

  function reset() {
    setMatched(null);
    setMemberInfo(null);
    setActiveReward(null);
    setCode("");
    setAmount(1);
  }

  async function loadMemberDetails(userId: string) {
    const [{ data: memberRows }, { data: rewardRows }] = await Promise.all([
      supabase.rpc("get_scanned_member_details", { _business_id: business.id, _user_id: userId }),
      supabase
        .from("rewards")
        .select("id,title")
        .eq("business_id", business.id)
        .eq("user_id", userId)
        .is("redeemed_at", null)
        .order("created_at", { ascending: true })
        .limit(1),
    ]);
    const row = (memberRows || [])[0] as ScannedMemberDetails | undefined;
    if (row) setMatched({ id: row.id, first_name: row.first_name, last_name: row.last_name, email: row.email });
    setMemberInfo(
      row
        ? { joined_at: row.joined_at, last_activity_at: row.last_activity_at }
        : null,
    );
    setActiveReward((rewardRows || [])[0] || null);
  }

  async function loadMemberInfo(userId: string) {
    const { data } = await supabase.rpc("get_scanned_member_details", {
      _business_id: business.id, _user_id: userId,
    });
    const row = (data || [])[0] as ScannedMemberDetails | undefined;
    if (row) setMatched({ id: row.id, first_name: row.first_name, last_name: row.last_name, email: row.email });
    setMemberInfo(row ? { joined_at: row.joined_at, last_activity_at: row.last_activity_at } : null);
  }

  async function parse(value: string) {
    const rewardMatch = value.match(/^loyaltyloop:reward:(.+)$/);
    if (rewardMatch) {
      if (mode !== "reward") {
        Alert.alert("Reward QR code", "Switch to Reward mode before redeeming this QR code.");
        return;
      }
      setCamera(false);
      setBusy(true);
      try {
        const { data: reward, error } = await supabase
          .from("rewards")
          .select("id,title,user_id,redeemed_at,expires_at")
          .eq("business_id", business.id)
          .eq("qr_token", rewardMatch[1])
          .maybeSingle();
        if (error) throw error;
        if (!reward) throw new Error("That reward does not belong to this shop.");
        if (reward.redeemed_at) throw new Error("This reward has already been redeemed.");
        if (reward.expires_at && new Date(reward.expires_at) < new Date()) throw new Error("This reward has expired.");
        setMatched({ id: reward.user_id });
        setActiveReward({ id: reward.id, title: reward.title });
        setCode("");
        void loadMemberInfo(reward.user_id);
      } catch (e) {
        Alert.alert("Could not find reward", e instanceof Error ? e.message : "Please try again.");
      } finally {
        setBusy(false);
      }
      return;
    }
    const match = value.match(/^loyaltyloop:customer:(.+)$/);
    if (!match) {
      Alert.alert(
        "Not a Loyalty Loop code",
        mode === "reward" ? "Scan the customer's reward QR code." : "Scan a Loyalty Loop customer QR code.",
      );
      return;
    }
    setCamera(false);
    const id = match[1];
    setMatched({ id });
    setCode("");
    void loadMemberDetails(id);
  }
  async function lookup() {
    if (!code.trim()) return;
    setBusy(true);
    const normalized = code.replace(/\s+/g, "").toUpperCase();
    try {
      if (mode === "reward") {
        const { data: reward, error: rewardError } = await supabase
          .from("rewards")
          .select("id,title,user_id,redeemed_at,expires_at")
          .eq("business_id", business.id)
          .eq("short_code", normalized)
          .maybeSingle();
        if (rewardError) throw rewardError;
        if (reward) {
          if (reward.redeemed_at) throw new Error("This reward has already been redeemed.");
          if (reward.expires_at && new Date(reward.expires_at) < new Date()) throw new Error("This reward has expired.");
          setMatched({ id: reward.user_id });
          setActiveReward({ id: reward.id, title: reward.title });
          setCode("");
          void loadMemberInfo(reward.user_id);
          return;
        }
      }
      const { data, error } = await supabase.rpc("lookup_user_by_stamp_code", {
        _code: normalized,
      });
      if (error) throw error;
      const person = (data || [])[0];
      if (!person) throw new Error(mode === "reward" ? "No reward or customer found with that code." : "No customer found with that code.");
      setMatched(person);
      setCode("");
      void loadMemberDetails(person.id);
    } catch (e) {
      Alert.alert(
        mode === "reward" ? "Could not find reward" : "Could not find customer",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function award() {
    if (!matched) return;
    const value = Math.max(1, amount);
    setBusy(true);
    try {
      const { error } = await supabase.from("transactions").insert({
        user_id: matched.id,
        business_id: business.id,
        type: "stamp",
        value,
      });
      if (error) throw error;
      void supabase.functions.invoke("send-visit-thank-you", {
        body: { business_id: business.id, user_id: matched.id, amount: value },
      });
      void supabase.functions.invoke("send-user-push", {
        body: { business_id: business.id, user_id: matched.id },
      });
      Alert.alert(
        "Reward added",
        `${value} ${unit} awarded to ${matched.first_name || "the customer"}.`,
      );
      reset();
      onDone();
    } catch (e) {
      Alert.alert(
        "Could not award",
        e instanceof Error
          ? e.message
          : "The customer may need to join this shop first.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function redeem() {
    if (!matched || !activeReward) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("rewards")
        .update({ redeemed_at: new Date().toISOString() })
        .eq("id", activeReward.id);
      if (error) throw error;
      void supabase.functions.invoke("send-user-push", {
        body: { business_id: business.id, user_id: matched.id },
      });
      Alert.alert(
        "Reward redeemed",
        `${activeReward.title} redeemed for ${matched.first_name || "the customer"}.`,
      );
      reset();
      onDone();
    } catch (e) {
      Alert.alert(
        "Could not redeem",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <View>
      <Text style={styles.pageKicker}>QUICK ACTION</Text>
      <Text style={styles.pageTitle}>Stamps</Text>
      <View style={[styles.segment, { marginTop: 18 }]}>
        {(["stamps", "reward"] as const).map((value) => (
          <Pressable
            key={value}
            onPress={() => onModeChange(value)}
            style={[
              styles.segmentButton,
              mode === value && styles.segmentActive,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                mode === value && styles.segmentTextActive,
              ]}
            >
              {value === "stamps" ? "Stamps" : "Reward"}
            </Text>
          </Pressable>
        ))}
      </View>
      {hasReward === null ? (
        <View style={styles.card}>
          <ActivityIndicator color={orange} />
        </View>
      ) : !hasReward ? (
        <View style={styles.card}>
          <Text style={styles.matchTitle}>Add a reward before scanning</Text>
          <Text style={styles.copy}>
            Create at least one reward in the rewards catalogue first. This
            makes sure every customer knows what they are collecting towards.
          </Text>
          <Button title="Set up rewards" onPress={onConfigureRewards} />
        </View>
      ) : (
        <>
          {mode === "stamps" && (
            <View style={styles.stepper}>
              <Pressable
                onPress={() => setAmount((a) => Math.max(1, a - 1))}
                style={styles.stepperButton}
              >
                <Text style={styles.stepperText}>−</Text>
              </Pressable>
              <Text style={styles.stepperValue}>{amount}</Text>
              <Pressable
                onPress={() => setAmount((a) => a + 1)}
                style={styles.stepperButton}
              >
                <Text style={styles.stepperText}>+</Text>
              </Pressable>
            </View>
          )}
          <Pressable
            onPress={async () => {
              if (!permission?.granted) {
                const result = await requestPermission();
                if (!result.granted)
                  return Alert.alert(
                    "Camera permission needed",
                    "Allow camera access to scan customer cards.",
                  );
              }
              setCamera(true);
            }}
            style={({ pressed }) => [
              styles.cameraStartButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.cameraStartText}>Camera Start</Text>
          </Pressable>
          {camera && (
            <Modal animationType="slide" onRequestClose={() => setCamera(false)}>
              <SafeAreaView style={styles.cameraWrap}>
                <Text style={styles.cameraTitle}>{mode === "reward" ? "Scan reward QR code" : "Scan customer card"}</Text>
                <CameraView
                  style={styles.camera}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={({ data }) => parse(data)}
                />
                <Button
                  title="Cancel scan"
                  secondary
                  onPress={() => setCamera(false)}
                />
              </SafeAreaView>
            </Modal>
          )}
          <View style={styles.card}>
            <Text style={styles.section}>{mode === "reward" ? "Or enter their reward or customer code" : "Or enter their code"}</Text>
            <TextInput
              style={[styles.input, styles.customerCodeInput]}
              value={code}
              onChangeText={setCode}
              placeholder={mode === "reward" ? "Reward or customer short code" : "Customer short code"}
              selectionColor="#111111"
              autoCapitalize="characters"
            />
            <Button
              title={busy ? "Looking up…" : "Find customer"}
              onPress={lookup}
              disabled={busy}
            />
          </View>
          {matched && (
            <View style={styles.card}>
              {mode === "stamps" ? (
                <Pressable
                  onPress={award}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.bigActionButton,
                    pressed && styles.pressed,
                    busy && styles.disabled,
                  ]}
                >
                  <Text style={styles.bigActionButtonText}>
                    {busy ? "Awarding…" : `Award ${unit}`}
                  </Text>
                </Pressable>
              ) : activeReward ? (
                <Pressable
                  onPress={redeem}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.bigActionButton,
                    pressed && styles.pressed,
                    busy && styles.disabled,
                  ]}
                >
                  <Text style={styles.bigActionButtonText}>
                    {busy ? "Redeeming…" : `Redeem "${activeReward.title}"`}
                  </Text>
                </Pressable>
              ) : (
                <Text style={styles.copy}>
                  This customer has no reward ready to redeem yet.
                </Text>
              )}
              <Text style={[styles.matchTitle, { marginTop: 18 }]}>
                Member Information:
              </Text>
              <View style={styles.memberInfoRow}>
                <Text style={styles.memberInfoLabel}>Name:</Text>
                <Text style={styles.memberInfoValue}>
                  {[matched.first_name, matched.last_name]
                    .filter(Boolean)
                    .join(" ") || "—"}
                </Text>
              </View>
              <View style={styles.memberInfoRow}>
                <Text style={styles.memberInfoLabel}>Email:</Text>
                <Text style={styles.memberInfoValue}>
                  {matched.email || "Not available"}
                </Text>
              </View>
              <View style={styles.memberInfoRow}>
                <Text style={styles.memberInfoLabel}>First Visit:</Text>
                <Text style={styles.memberInfoValue}>
                  {formatDate(memberInfo?.joined_at)}
                </Text>
              </View>
              <View style={styles.memberInfoRow}>
                <Text style={styles.memberInfoLabel}>Last Visit:</Text>
                <Text style={styles.memberInfoValue}>
                  {formatDate(memberInfo?.last_activity_at)}
                </Text>
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}

function StatTile({
  icon,
  value,
  label,
  wide,
}: {
  icon: ReactNode;
  value: number;
  label: string;
  wide?: boolean;
}) {
  return (
    <View style={[styles.statTile, wide && styles.statTileWide]}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function DashboardHome({
  business,
  stats,
  onIssueStamp,
  onRedeemReward,
  onReport,
}: {
  business: Business;
  stats: DashboardStats;
  onIssueStamp: () => void;
  onRedeemReward: () => void;
  onReport: () => void;
}) {
  const checklist = [
    { label: "Add your address", done: Boolean(business.address) },
    { label: "Add your postcode", done: Boolean(business.postcode) },
    { label: "Write a short description", done: Boolean(business.description) },
  ];
  const tileIcon = (Icon: typeof Users) => (
    <Icon size={21} strokeWidth={2.1} color={orange} />
  );
  return (
    <View>
      <View style={styles.welcomeRow}>
        <View>
          <Text style={styles.dashboardLabel}>DASHBOARD</Text>
          <Text style={styles.welcomeTitle}>WELCOME</Text>
        </View>
        {business.logo_url ? (
          <Image
            source={{ uri: business.logo_url }}
            style={{ width: 42, height: 42, borderRadius: 21 }}
          />
        ) : (
          <View
            style={[
              styles.homeLogo,
              { backgroundColor: business.brand_color || orange },
            ]}
          >
            <Text style={styles.homeLogoText}>{business.name.charAt(0)}</Text>
          </View>
        )}
      </View>
      <View style={styles.setupCard}>
        <Text style={styles.setupTitle}>
          {checklist.every((item) => item.done)
            ? "Your shop is ready"
            : "Finish setting up"}
        </Text>
        {checklist.map((item) => (
          <View key={item.label} style={styles.checkRow}>
            <View style={[styles.checkCircle, item.done && styles.checkDone]}>
              <Text style={styles.checkMark}>{item.done ? "✓" : ""}</Text>
            </View>
            <Text style={[styles.checkText, item.done && styles.checkTextDone]}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.statsGrid}>
        <StatTile icon={tileIcon(Stamp)} value={stats.stamps} label="Stamps" />
        <StatTile
          icon={tileIcon(Users)}
          value={stats.members}
          label="Customers"
        />
        <StatTile icon={tileIcon(Gift)} value={stats.rewards} label="Rewards" />
      </View>
      <View style={styles.statsGrid}>
        <StatTile
          icon={tileIcon(BadgeCheck)}
          value={stats.activeMembers}
          label="Active Members"
          wide
        />
        <StatTile
          icon={tileIcon(Star)}
          value={stats.dormantMembers}
          label="Dormant Members"
          wide
        />
      </View>
      <View style={styles.pillRow}>
        <Pressable
          onPress={onIssueStamp}
          style={({ pressed }) => [styles.pillButton, pressed && styles.pressed]}
        >
          <Stamp size={18} strokeWidth={2.2} color="#fff" />
          <Text style={styles.pillButtonText}>Issue Stamp</Text>
        </Pressable>
        <Pressable
          onPress={onRedeemReward}
          style={({ pressed }) => [styles.pillButton, pressed && styles.pressed]}
        >
          <Gift size={18} strokeWidth={2.2} color="#fff" />
          <Text style={styles.pillButtonText}>Redeem Reward</Text>
        </Pressable>
      </View>
      <Pressable
        onPress={onReport}
        style={({ pressed }) => [
          styles.reportButtonBlack,
          pressed && styles.pressed,
        ]}
      >
        <Sparkles size={20} strokeWidth={2.2} color="#fff" />
        <Text style={styles.reportButtonBlackText}>
          Generate Business Report
        </Text>
      </Pressable>
    </View>
  );
}

function MembersPage({ business }: { business: Business }) {
  const [members, setMembers] = useState<MemberRow[]>([]),
    [loading, setLoading] = useState(true),
    [search, setSearch] = useState("");
  useEffect(() => {
    setLoading(true);
    supabase
      .rpc("get_business_members", { _business_id: business.id })
      .then(({ data, error }) => {
        if (error) Alert.alert("Could not load members", error.message);
        setMembers((data || []) as MemberRow[]);
        setLoading(false);
      });
  }, [business.id]);
  const shown = members.filter((member) =>
    `${member.first_name || ""} ${member.last_name || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <View>
      <Text style={styles.pageKicker}>CUSTOMERS</Text>
      <Text style={styles.pageTitle}>Members</Text>
      <Text style={styles.pageIntro}>
        Everyone collecting rewards at {business.name}.
      </Text>
      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholder="Search members"
        placeholderTextColor="#73766E"
      />
      {loading ? (
        <ActivityIndicator color={green} style={{ marginTop: 30 }} />
      ) : shown.length ? (
        shown.map((member) => {
          const name =
            [member.first_name, member.last_name].filter(Boolean).join(" ") ||
            "Customer";
          const progress =
            business.loyalty_type === "points"
              ? member.points_balance
              : business.loyalty_type === "tiered"
                ? member.visit_count
                : member.stamp_count;
          return (
            <View key={member.user_id} style={styles.memberCard}>
              <View
                style={[
                  styles.memberAvatar,
                  { backgroundColor: business.brand_color || orange },
                ]}
              >
                <Text style={styles.memberAvatarText}>{name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{name}</Text>
                <Text style={styles.memberMeta}>
                  Joined {new Date(member.joined_at).toLocaleDateString()}
                </Text>
              </View>
              <View>
                <Text style={styles.memberProgress}>{progress}</Text>
                <Text style={styles.memberUnit}>
                  {business.loyalty_type === "points"
                    ? "points"
                    : business.loyalty_type === "tiered"
                      ? "visits"
                      : "stamps"}
                </Text>
              </View>
            </View>
          );
        })
      ) : (
        <Text style={styles.emptyState}>No matching members yet.</Text>
      )}
    </View>
  );
}

function AnalyticsPage({
  business,
  totals,
  userId,
  preview,
  onBusinessChanged,
}: {
  business: Business;
  totals: DashboardStats;
  userId: string;
  preview?: boolean;
  onBusinessChanged: () => Promise<void>;
}) {
  const [period, setPeriod] = useState<7 | 30 | 90>(30),
    [detailed, setDetailed] = useState(false),
    [periodStats, setPeriodStats] = useState({
      members: 0,
      stamps: 0,
      rewards: 0,
    }),
    [dailySeries, setDailySeries] = useState<DailyPoint[]>([]);
  useEffect(() => {
    const since = new Date(Date.now() - period * 86400000).toISOString();
    Promise.all([
      supabase
        .from("memberships")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id)
        .gte("joined_at", since),
      supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id)
        .gte("created_at", since),
      supabase
        .from("rewards")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id)
        .gte("created_at", since),
    ]).then(([members, stamps, rewards]) =>
      setPeriodStats({
        members: members.count || 0,
        stamps: stamps.count || 0,
        rewards: rewards.count || 0,
      }),
    );
  }, [business.id, period]);
  useEffect(() => {
    if (preview) {
      setDailySeries(buildPreviewDailySeries(period));
      return;
    }
    let active = true;
    const since = new Date(Date.now() - period * 86400000).toISOString();
    Promise.all([
      supabase
        .from("transactions")
        .select("created_at,value,user_id")
        .eq("business_id", business.id)
        .eq("type", "stamp")
        .gte("created_at", since),
      supabase
        .from("memberships")
        .select("user_id,joined_at")
        .eq("business_id", business.id),
    ]).then(([{ data: txRows }, { data: memberRows }]) => {
      if (!active) return;
      setDailySeries(
        buildDailySeries(period, txRows || [], memberRows || []),
      );
    });
    return () => {
      active = false;
    };
  }, [business.id, period, preview]);
  const modeSwitch = (
    <View style={styles.segment}>
      {(["simple", "detailed"] as const).map((value) => (
        <Pressable
          key={value}
          onPress={() => setDetailed(value === "detailed")}
          style={[
            styles.segmentButton,
            (value === "detailed") === detailed && styles.segmentActive,
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              (value === "detailed") === detailed && styles.segmentTextActive,
            ]}
          >
            {value === "simple" ? "Simple" : "Detailed"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
  if (detailed) {
    return (
      <View>
        <Text style={styles.pageKicker}>PERFORMANCE</Text>
        <Text style={styles.pageTitle}>Analytics</Text>
        {modeSwitch}
        <NativeOwnerPageView
          page="ai"
          business={business}
          userId={userId}
          onBack={() => setDetailed(false)}
          onBusinessChanged={onBusinessChanged}
          preview={preview}
        />
      </View>
    );
  }
  return (
    <View>
      <Text style={styles.pageKicker}>PERFORMANCE</Text>
      <Text style={styles.pageTitle}>Analytics</Text>
      <Text style={styles.pageIntro}>
        A clear view of what changed and what to do next.
      </Text>
      {modeSwitch}
      <View style={styles.periodSwitch}>
        {([7, 30, 90] as const).map((value) => (
          <Pressable
            key={value}
            onPress={() => setPeriod(value)}
            style={[
              styles.periodButton,
              period === value && styles.periodActive,
            ]}
          >
            <Text
              style={[
                styles.periodText,
                period === value && styles.periodTextActive,
              ]}
            >
              {value} days
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.analyticsHeading}>Last {period} days</Text>
      <View style={styles.analyticsGrid}>
        <StatTile icon="+" value={periodStats.members} label="New members" />
        <StatTile icon="♟" value={periodStats.stamps} label="Activity" />
        <StatTile icon="◇" value={periodStats.rewards} label="Rewards" />
      </View>
      <Text style={styles.chartsHeading}>
        The last {period} days visualised:
      </Text>
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Activity — stamps & visits</Text>
        <MiniLineChart
          data={dailySeries}
          aKey="stamps"
          bKey="visits"
          aLabel="Stamps"
          bLabel="Visits"
          aColor={orange}
          bColor="#8B7FD6"
        />
      </View>
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Customers — new & old</Text>
        <MiniLineChart
          data={dailySeries}
          aKey="newCustomers"
          bKey="oldCustomers"
          aLabel="New"
          bLabel="Returning"
          aColor="#3FA34D"
          bColor="#20211E"
        />
      </View>
      <View style={styles.insightCard}>
        <Text style={styles.insightLabel}>QUICK READ</Text>
        <Text style={styles.insightTitle}>
          {periodStats.members > 0
            ? "Your loyalty audience is growing."
            : "Focus on getting the next customer to join."}
        </Text>
        <Text style={styles.insightCopy}>
          {periodStats.stamps > 0
            ? `${periodStats.stamps} loyalty actions were recorded in this period. Keep the scan prompt visible at the till.`
            : "No loyalty activity is recorded for this period yet. Try placing your QR poster beside the payment point."}
        </Text>
      </View>
      <View style={styles.totalCard}>
        <Text style={styles.totalTitle}>All-time picture</Text>
        <Text style={styles.totalLine}>
          {totals.members} members · {totals.stamps} stamps · {totals.redeemed}{" "}
          redeemed
        </Text>
      </View>
    </View>
  );
}

function NewsPage({ business }: { business: Business }) {
  const [items, setItems] = useState<Announcement[]>([]),
    [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    supabase
      .from("announcements")
      .select("*")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) Alert.alert("Could not load news", error.message);
        setItems((data || []) as Announcement[]);
      });
  useEffect(() => {
    load();
  }, [business.id]);
  const publish = async () => {
    if (!title.trim())
      return Alert.alert(
        "Add a headline",
        "Give your announcement a short title.",
      );
    setBusy(true);
    const { error } = await supabase.from("announcements").insert({
      business_id: business.id,
      title: title.trim(),
      body: body.trim() || null,
      is_active: true,
    });
    setBusy(false);
    if (error) return Alert.alert("Could not publish", error.message);
    setTitle("");
    setBody("");
    load();
    Alert.alert(
      "Published",
      "Customers can now see this announcement in News.",
    );
  };
  const toggle = async (item: Announcement) => {
    const { error } = await supabase
      .from("announcements")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    if (error) return Alert.alert("Could not update", error.message);
    load();
  };
  return (
    <View>
      <Text style={styles.pageKicker}>ANNOUNCEMENTS</Text>
      <Text style={styles.pageTitle}>News</Text>
      <Text style={styles.pageIntro}>
        Share a new menu, event, offer or shop update with customers.
      </Text>
      <View style={styles.composeCard}>
        <Text style={styles.composeTitle}>Create an announcement</Text>
        <TextInput
          style={styles.settingsInput}
          value={title}
          onChangeText={setTitle}
          placeholder="Headline"
          placeholderTextColor="#6F726B"
          maxLength={120}
        />
        <TextInput
          style={[styles.settingsInput, styles.textArea]}
          value={body}
          onChangeText={setBody}
          placeholder="What would you like customers to know?"
          placeholderTextColor="#6F726B"
          multiline
          textAlignVertical="top"
          maxLength={2000}
        />
        <Button
          title={busy ? "Publishing…" : "Publish news"}
          onPress={publish}
          disabled={busy}
        />
      </View>
      <Text style={styles.analyticsHeading}>Previous announcements</Text>
      {items.length ? (
        items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => toggle(item)}
            style={({ pressed }) => [
              styles.newsCard,
              pressed && styles.pressed,
            ]}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.newsHeader}>
                <Text style={styles.newsTitle}>{item.title}</Text>
                <View
                  style={[
                    styles.statusPill,
                    !item.is_active && styles.statusDraft,
                  ]}
                >
                  <Text style={styles.statusText}>
                    {item.is_active ? "LIVE" : "HIDDEN"}
                  </Text>
                </View>
              </View>
              {item.body ? (
                <Text style={styles.newsBody}>{item.body}</Text>
              ) : null}
              <Text style={styles.newsDate}>
                {new Date(item.created_at).toLocaleDateString()} · Tap to{" "}
                {item.is_active ? "hide" : "publish"}
              </Text>
            </View>
          </Pressable>
        ))
      ) : (
        <Text style={styles.emptyState}>
          No announcements yet. Your first one can be ready in seconds.
        </Text>
      )}
    </View>
  );
}

function SettingsRow({
  icon,
  title,
  detail,
  onPress,
  danger,
}: {
  icon: string;
  title: string;
  detail?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}
    >
      <View style={[styles.settingsIcon, danger && styles.dangerIcon]}>
        <Text style={styles.settingsIconText}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.settingsRowTitle, danger && styles.dangerText]}>
          {title}
        </Text>
        {detail ? <Text style={styles.settingsRowDetail}>{detail}</Text> : null}
      </View>
      <Text style={[styles.chevron, danger && styles.dangerText]}>›</Text>
    </Pressable>
  );
}

function BusinessSettings({
  business,
  session,
  onChanged,
  onOpenPage,
}: {
  business: Business;
  session: Session;
  onChanged: () => Promise<void>;
  onOpenPage: (page: NativeOwnerPage) => void;
}) {
  const [name, setName] = useState(business.name),
    [category, setCategory] = useState(business.category || ""),
    [description, setDescription] = useState(business.description || ""),
    [address, setAddress] = useState(business.address || ""),
    [postcode, setPostcode] = useState(business.postcode || ""),
    [phone, setPhone] = useState(business.phone || ""),
    [loyaltyType, setLoyaltyType] = useState<Business["loyalty_type"]>(
      business.loyalty_type || "stamp_card",
    ),
    [threshold, setThreshold] = useState(
      String(business.loyalty_config?.stamps_required || 10),
    ),
    [signupReward, setSignupReward] = useState(
      business.loyalty_config?.signup_reward_title || "",
    ),
    [saving, setSaving] = useState(false),
    [biometricEnabled, setBiometricEnabled] = useState(false);
  useEffect(() => {
    setName(business.name);
    setCategory(business.category || "");
    setDescription(business.description || "");
    setAddress(business.address || "");
    setPostcode(business.postcode || "");
    setPhone(business.phone || "");
    setLoyaltyType(business.loyalty_type || "stamp_card");
    setThreshold(String(business.loyalty_config?.stamps_required || 10));
    setSignupReward(business.loyalty_config?.signup_reward_title || "");
  }, [business.id]);
  useEffect(() => {
    biometricLockEnabled().then(setBiometricEnabled);
  }, []);
  const toggleBiometricLock = async () => {
    const result = await setBiometricLock(!biometricEnabled);
    if (result.success) setBiometricEnabled(!biometricEnabled);
    else Alert.alert("Could not update app lock", result.error);
  };
  const save = async () => {
    if (!name.trim())
      return Alert.alert("Shop name needed", "Enter a name for your business.");
    setSaving(true);
    try {
      const { error } = await supabase
        .from("businesses")
        .update({
          name: name.trim(),
          category: category.trim() || null,
          description: description.trim() || null,
          address: address.trim() || null,
          postcode: postcode.trim() || null,
          phone: phone.trim() || null,
          loyalty_type: loyaltyType,
          loyalty_config: {
            ...business.loyalty_config,
            stamps_required: Math.max(1, Number(threshold) || 10),
            signup_reward_title: signupReward.trim(),
          },
        })
        .eq("id", business.id);
      if (error) throw error;
      await onChanged();
      Alert.alert(
        "Settings saved",
        "Your shop and loyalty programme are up to date.",
      );
    } catch (e) {
      Alert.alert(
        "Could not save",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };
  const toggleActive = () =>
    Alert.alert(
      business.is_active === false ? "Reactivate shop?" : "Deactivate shop?",
      business.is_active === false
        ? "Customers will be able to discover and join this shop again."
        : "The shop will be hidden from customers, but its data will be kept.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: business.is_active === false ? "Reactivate" : "Deactivate",
          style: business.is_active === false ? "default" : "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("businesses")
              .update({ is_active: business.is_active === false })
              .eq("id", business.id);
            if (error)
              return Alert.alert("Could not update shop", error.message);
            await onChanged();
          },
        },
      ],
    );
  return (
    <View>
      <View style={styles.settingsHero}>
        <View>
          <Text style={styles.settingsKicker}>SETTINGS</Text>
          <Text style={styles.settingsTitle}>Your shop, your way.</Text>
          <Text style={styles.settingsSubtitle}>
            The essentials from your web workspace, designed for quick changes
            on mobile.
          </Text>
        </View>
        <View
          style={[
            styles.settingsAvatar,
            { backgroundColor: business.brand_color || green },
          ]}
        >
          {business.logo_url ? (
            <Image
              source={{ uri: business.logo_url }}
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            <Text style={styles.settingsAvatarLetter}>
              {business.name.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
      </View>
      <Text style={styles.groupLabel}>SHOP PROFILE</Text>
      <View style={styles.settingsGroup}>
        <Text style={styles.fieldLabel}>Shop name</Text>
        <TextInput
          style={styles.settingsInput}
          value={name}
          onChangeText={setName}
          placeholderTextColor="#6F726B"
        />
        <Text style={styles.fieldLabel}>Category</Text>
        <TextInput
          style={styles.settingsInput}
          value={category}
          onChangeText={setCategory}
          placeholder="Cafe, salon, restaurant…"
          placeholderTextColor="#6F726B"
        />
        <Text style={styles.fieldLabel}>Description</Text>
        <TextInput
          style={[styles.settingsInput, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Tell customers what makes you special"
          placeholderTextColor="#6F726B"
          multiline
          textAlignVertical="top"
        />
        <Text style={styles.fieldLabel}>Address</Text>
        <TextInput
          style={styles.settingsInput}
          value={address}
          onChangeText={setAddress}
          placeholderTextColor="#6F726B"
        />
        <View style={styles.twoColumns}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Postcode</Text>
            <TextInput
              style={styles.settingsInput}
              value={postcode}
              onChangeText={setPostcode}
              placeholderTextColor="#6F726B"
              autoCapitalize="characters"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Phone</Text>
            <TextInput
              style={styles.settingsInput}
              value={phone}
              onChangeText={setPhone}
              placeholderTextColor="#6F726B"
              keyboardType="phone-pad"
            />
          </View>
        </View>
      </View>
      <Text style={styles.groupLabel}>LOYALTY PROGRAMME</Text>
      <View style={styles.settingsGroup}>
        <Text style={styles.fieldLabel}>How customers collect</Text>
        <View style={styles.segment}>
          {(
            [
              ["stamp_card", "Stamps"],
              ["points", "Points"],
              ["tiered", "Visits"],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => setLoyaltyType(value)}
              style={[
                styles.segmentButton,
                loyaltyType === value && styles.segmentActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  loyaltyType === value && styles.segmentTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.fieldLabel}>Target for a reward</Text>
        <View style={styles.stepper}>
          <Pressable
            onPress={() =>
              setThreshold(String(Math.max(1, (Number(threshold) || 1) - 1)))
            }
            style={styles.stepperButton}
          >
            <Text style={styles.stepperText}>−</Text>
          </Pressable>
          <TextInput
            style={styles.stepperInput}
            value={threshold}
            onChangeText={setThreshold}
            keyboardType="number-pad"
          />
          <Pressable
            onPress={() => setThreshold(String((Number(threshold) || 0) + 1))}
            style={styles.stepperButton}
          >
            <Text style={styles.stepperText}>+</Text>
          </Pressable>
        </View>
        <Text style={styles.fieldLabel}>Sign-up reward</Text>
        <TextInput
          style={styles.settingsInput}
          value={signupReward}
          onChangeText={setSignupReward}
          placeholder="e.g. Free coffee for joining"
          placeholderTextColor="#6F726B"
        />
      </View>
      <Pressable
        onPress={save}
        disabled={saving}
        style={({ pressed }) => [
          styles.saveSettings,
          pressed && styles.pressed,
          saving && styles.disabled,
        ]}
      >
        <Text style={styles.saveSettingsText}>
          {saving ? "Saving…" : "Save changes"}
        </Text>
      </Pressable>
      <Text style={styles.groupLabel}>BUSINESS TOOLS</Text>
      <View style={styles.settingsGroupNoPadding}>
        <SettingsRow
          icon="◉"
          title="Logo & cover images"
          detail="Update your storefront branding"
          onPress={() => onOpenPage("branding")}
        />
        <SettingsRow
          icon="★"
          title="Rewards catalogue"
          detail="Create and edit reward tiers"
          onPress={() => onOpenPage("rewards")}
        />
        <SettingsRow
          icon="✦"
          title="Customer reviews"
          detail="Read feedback and reply as your shop"
          onPress={() => onOpenPage("reviews")}
        />
        <SettingsRow
          icon="♟"
          title="Staff & permissions"
          detail="Invite, revoke and manage access"
          onPress={() => onOpenPage("staff")}
        />
        <SettingsRow
          icon="?"
          title="Help & support"
          detail="Get help from The Loyalty Loop"
          onPress={() => onOpenPage("support")}
        />
        <SettingsRow
          icon="•"
          title="Face ID / fingerprint lock"
          detail={biometricEnabled ? "Required when opening this app" : "Protect access to this app"}
          onPress={() => void toggleBiometricLock()}
        />
        <SettingsRow
          icon="i"
          title="How to use your loyalty programme"
          detail="A short step-by-step business guide"
          onPress={() => onOpenPage("tutorial")}
        />
        <SettingsRow
          icon="↗"
          title="Visit web dashboard"
          detail="Open the-loyalty-loop.com in your browser"
          onPress={() => Linking.openURL("https://www.the-loyalty-loop.com")}
        />
      </View>
      <Text style={styles.groupLabel}>ACCOUNT</Text>
      <View style={styles.settingsGroupNoPadding}>
        <SettingsRow
          icon="@"
          title="Signed in account"
          detail={session.user.email || "Business account"}
          onPress={() =>
            Alert.alert("Business account", session.user.email || "Signed in")
          }
        />
        <SettingsRow
          icon="↗"
          title={
            business.is_active === false ? "Reactivate shop" : "Deactivate shop"
          }
          detail={
            business.is_active === false
              ? "Make your shop visible again"
              : "Temporarily hide your shop"
          }
          onPress={toggleActive}
          danger={business.is_active !== false}
        />
        <SettingsRow
          icon="⇥"
          title="Sign out"
          onPress={() => supabase.auth.signOut()}
          danger
        />
      </View>
      <Text style={styles.settingsFootnote}>
        Permanent shop deletion remains on the website so it cannot be triggered
        accidentally from a phone.
      </Text>
    </View>
  );
}

function Dashboard({
  session,
  preview = false,
}: {
  session: Session;
  preview?: boolean;
}) {
  const [shops, setShops] = useState<Business[]>(
      preview ? [PREVIEW_BUSINESS] : [],
    ),
    [selected, setSelected] = useState<Business | null>(
      preview ? PREVIEW_BUSINESS : null,
    ),
    [tab, setTab] = useState<
      "home" | "scan" | "members" | "analytics" | "news" | "settings"
    >("home"),
    [ownerPage, setOwnerPage] = useState<NativeOwnerPage | null>(null),
    [stampsMode, setStampsMode] = useState<"stamps" | "reward">("stamps"),
    [stats, setStats] = useState<DashboardStats>(
      preview
        ? PREVIEW_STATS
        : {
            members: 0,
            stamps: 0,
            rewards: 0,
            redeemed: 0,
            reviews: 0,
            activeMembers: 0,
            dormantMembers: 0,
          },
    ),
    [loading, setLoading] = useState(!preview);
  async function load() {
    if (preview) return;
    setLoading(true);
    try {
      const [
        { data: owned, error: ownedError },
        { data: staff, error: staffError },
      ] = await Promise.all([
        supabase
          .from("businesses")
          .select("*")
          .eq("owner_id", session.user.id)
          .order("created_at"),
        supabase
          .from("staff_members")
          .select(
            "business_id,can_scan_stamps,can_redeem_rewards,business:businesses(*)",
          )
          .eq("user_id", session.user.id)
          .eq("status", "active"),
      ]);
      if (ownedError) throw ownedError;
      if (staffError) throw staffError;
      const staffShops = (staff || [])
        .map((row: StaffBusiness) =>
          Array.isArray(row.business) ? row.business[0] : row.business,
        )
        .filter(Boolean) as Business[];
      const all = [
        ...(owned || []),
        ...staffShops.filter((s) => !(owned || []).some((o) => o.id === s.id)),
      ];
      setShops(all);
      setSelected((current) =>
        current
          ? all.find((s) => s.id === current.id) || all[0] || null
          : all[0] || null,
      );
    } catch (e) {
      Alert.alert(
        "Could not load business",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!preview) load();
  }, [preview]);
  useEffect(() => {
    if (preview || !selected) return;
    Promise.all([
      supabase
        .from("memberships")
        .select("id", { count: "exact", head: true })
        .eq("business_id", selected.id),
      supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("business_id", selected.id)
        .eq("type", "stamp"),
      supabase
        .from("rewards")
        .select("id", { count: "exact", head: true })
        .eq("business_id", selected.id),
      supabase
        .from("rewards")
        .select("id", { count: "exact", head: true })
        .eq("business_id", selected.id)
        .not("redeemed_at", "is", null),
      supabase
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("business_id", selected.id),
      supabase.rpc("get_business_members", { _business_id: selected.id }),
    ]).then(([members, stamps, rewards, redeemed, reviews, memberRows]) => {
      const cutoff = Date.now() - 30 * 86400000;
      let activeMembers = 0,
        dormantMembers = 0;
      ((memberRows.data || []) as MemberRow[]).forEach((row) => {
        const last = row.last_activity_at
          ? new Date(row.last_activity_at).getTime()
          : 0;
        if (last >= cutoff) activeMembers++;
        else dormantMembers++;
      });
      setStats({
        members: members.count || 0,
        stamps: stamps.count || 0,
        rewards: rewards.count || 0,
        redeemed: redeemed.count || 0,
        reviews: reviews.count || 0,
        activeMembers,
        dormantMembers,
      });
    });
  }, [selected?.id, loading]);
  const nav = [
    { id: "home", icon: LayoutDashboard, label: "Dashboard" },
    { id: "scan", icon: Stamp, label: "Stamps" },
    { id: "members", icon: Users, label: "Members" },
    { id: "analytics", icon: ChartNoAxesCombined, label: "Analytics" },
    { id: "news", icon: Newspaper, label: "News" },
    { id: "settings", icon: Settings, label: "Settings" },
  ] as const;
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.screen}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!ownerPage && (
          <ShopPicker
            shops={shops}
            selected={selected}
            onSelect={(shop) => {
              setSelected(shop);
              setOwnerPage(null);
            }}
          />
        )}
        {loading ? (
          <ActivityIndicator color={green} style={{ marginTop: 40 }} />
        ) : (
          selected &&
          (ownerPage ? (
            <NativeOwnerPageView
              page={ownerPage}
              business={selected}
              userId={session.user.id || "preview-user"}
              onBack={() => setOwnerPage(null)}
              onBusinessChanged={load}
              preview={preview}
            />
          ) : (
            <>
              {tab === "home" && (
                <DashboardHome
                  business={selected}
                  stats={stats}
                  onIssueStamp={() => {
                    setStampsMode("stamps");
                    setTab("scan");
                  }}
                  onRedeemReward={() => {
                    setStampsMode("reward");
                    setTab("scan");
                  }}
                  onReport={() => setOwnerPage("ai")}
                />
              )}{" "}
              {tab === "scan" && (
                <StampsScreen
                  business={selected}
                  mode={stampsMode}
                  onModeChange={setStampsMode}
                  onDone={load}
                  onConfigureRewards={() => setOwnerPage("rewards")}
                />
              )}{" "}
              {tab === "members" && <MembersPage business={selected} />}{" "}
              {tab === "analytics" && (
                <AnalyticsPage
                  business={selected}
                  totals={stats}
                  userId={session.user.id || "preview-user"}
                  preview={preview}
                  onBusinessChanged={load}
                />
              )}{" "}
              {tab === "news" && <NewsPage business={selected} />}{" "}
              {tab === "settings" && (
                <BusinessSettings
                  business={selected}
                  session={session}
                  onChanged={load}
                  onOpenPage={setOwnerPage}
                />
              )}
            </>
          ))
        )}
      </ScrollView>
      <View style={styles.tabs}>
        {nav.map(({ id, icon: Icon, label }) => (
          <Pressable
            key={id}
            style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
            onPress={() => {
              setOwnerPage(null);
              setTab(id);
            }}
          >
            <Icon
              size={21}
              strokeWidth={tab === id ? 2.5 : 1.9}
              color={tab === id ? orange : "#5F625B"}
            />
            <Text
              numberOfLines={1}
              style={[styles.tabText, tab === id && styles.tabActive]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppRoot />
    </SafeAreaProvider>
  );
}

function AppRoot() {
  const previewMode =
    __DEV__ &&
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("preview") === "dashboard";
  if (previewMode)
    return (
      <Dashboard
        preview
        session={
          {
            user: { email: "owner@the-loyalty-loop.com" },
          } as unknown as Session
        }
      />
    );
  const [session, setSession] = useState<Session | null>(null),
    [checking, setChecking] = useState(true),
    [allowed, setAllowed] = useState(false),
    [showAuth, setShowAuth] = useState(false),
    [locked, setLocked] = useState(false),
    [checkingLock, setCheckingLock] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) =>
      setSession(next),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) {
      setAllowed(false);
      return;
    }
    (async () => {
      await supabase.rpc("ensure_current_user_bootstrap");
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      const roles = (data || []).map((r: any) => r.role);
      const ok = roles.some((role: string) =>
        ["admin", "brand_head", "business_owner", "staff"].includes(role),
      );
      setAllowed(ok);
      if (!ok) {
        Alert.alert(
          "Use the shopper app",
          "This is a customer account. Please sign in to The Loyalty Loop shopper app.",
        );
        await supabase.auth.signOut();
      }
    })();
  }, [session?.user.id]);
  async function checkAppLock() {
    if (!session) {
      setLocked(false);
      return;
    }
    if (!(await biometricLockEnabled())) {
      setLocked(false);
      return;
    }
    setCheckingLock(true);
    setLocked(true);
    const success = await unlockWithBiometrics();
    setLocked(!success);
    setCheckingLock(false);
  }
  useEffect(() => {
    void checkAppLock();
  }, [session?.user.id]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && session) void checkAppLock();
    });
    return () => subscription.remove();
  }, [session?.user.id]);
  useEffect(() => {
    if (session) void registerPushToken(session.user.id).catch(() => undefined);
  }, [session?.user.id]);
  if (!hasSupabaseConfig)
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.auth}>
          <Text style={styles.hero}>App configuration needed</Text>
          <Text style={styles.copy}>
            This build needs its Expo Supabase environment variables before it
            can connect.
          </Text>
        </View>
      </SafeAreaView>
    );
  if (checking || (session && (!allowed || checkingLock)))
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={green} />
        </View>
      </SafeAreaView>
    );
  if (session && locked)
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.lockScreen}>
          <View style={styles.mark}><Text style={styles.markText}>↻</Text></View>
          <Text style={styles.title}>App locked</Text>
          <Text style={styles.copy}>Use Face ID, Touch ID or your fingerprint to continue.</Text>
          <Button title="Unlock app" onPress={() => void checkAppLock()} />
        </View>
      </SafeAreaView>
    );
  return session ? (
    <Dashboard session={session} />
  ) : showAuth ? (
    <Auth onSession={setSession} />
  ) : (
    <BusinessLanding onContinue={() => setShowAuth(true)} />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: cream },
  auth: { flexGrow: 1, padding: 28, justifyContent: "center" },
  screen: { padding: 22, paddingBottom: 112 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  lockScreen: { flex: 1, padding: 28, alignItems: "center", justifyContent: "center" },
  mark: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: green,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  markText: { color: "#e4b666", fontSize: 34, fontWeight: "800" },
  eyebrow: {
    color: orange,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  hero: {
    color: green,
    fontSize: 37,
    fontWeight: "800",
    lineHeight: 44,
    letterSpacing: -1,
  },
  title: {
    color: green,
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36,
    letterSpacing: -0.7,
  },
  copy: { color: "#657060", fontSize: 16, lineHeight: 24, marginTop: 9 },
  small: {
    color: "#7a8178",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 22,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    marginTop: 24,
    gap: 12,
    elevation: 2,
    shadowColor: "#30442d",
    shadowOpacity: 0.08,
    shadowRadius: 15,
  },
  input: {
    backgroundColor: "#f4f1eb",
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#243021",
    fontSize: 16,
  },
  customerCodeInput: { color: "#111111" },
  button: {
    backgroundColor: green,
    borderRadius: 999,
    alignItems: "center",
    padding: 15,
    marginTop: 3,
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    shadowColor: green,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: green,
  },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  secondaryText: { color: green },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  shopPicker: { gap: 9, paddingTop: 18, paddingBottom: 5 },
  shopChip: {
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 21,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  chipLogo: { width: 22, height: 22, borderRadius: 11 },
  chipText: { color: green, fontWeight: "800", fontSize: 13 },
  overview: { borderRadius: 21, padding: 22, marginTop: 24 },
  overviewLabel: {
    color: "#e6ecdd",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  overviewNumber: {
    color: "#fff",
    fontSize: 48,
    fontWeight: "800",
    marginVertical: 9,
  },
  section: { fontSize: 19, fontWeight: "800", color: green, marginTop: 8 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  match: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#e7e3da",
    paddingTop: 14,
  },
  matchTitle: { fontSize: 17, fontWeight: "800", color: green },
  cameraWrap: { flex: 1, padding: 20, backgroundColor: "#111" },
  cameraTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 18,
  },
  camera: { flex: 1, borderRadius: 20, overflow: "hidden", marginBottom: 20 },
  statTile: {
    width: "31%",
    minHeight: 132,
    borderWidth: 2,
    borderColor: "#22231F",
    borderRadius: 20,
    padding: 14,
    backgroundColor: "rgba(255,255,255,.52)",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  statIcon: { fontSize: 20, color: orange, fontWeight: "900" },
  statValue: {
    fontSize: 28,
    color: "#171815",
    fontWeight: "900",
    marginTop: 12,
  },
  statLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: "#5E625A",
    fontWeight: "700",
  },
  welcomeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 20,
  },
  dashboardLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.7,
    color: "#777970",
  },
  welcomeTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    color: "#151613",
    letterSpacing: -1,
  },
  homeLogo: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  homeLogoText: { fontSize: 18, color: "#fff", fontWeight: "900" },
  setupCard: {
    borderWidth: 2,
    borderColor: "#22231F",
    borderRadius: 22,
    padding: 18,
    backgroundColor: "rgba(255,255,255,.55)",
    marginBottom: 20,
  },
  setupTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#191A17",
    marginBottom: 13,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    minHeight: 38,
  },
  checkCircle: {
    width: 23,
    height: 23,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#31322E",
    alignItems: "center",
    justifyContent: "center",
  },
  checkDone: { borderColor: orange, backgroundColor: "#F8C9B6" },
  checkMark: { fontSize: 13, fontWeight: "900", color: "#8C3820" },
  checkText: { fontSize: 14, fontWeight: "700", color: "#30312D" },
  checkTextDone: { color: "#8A8C85", textDecorationLine: "line-through" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  statTileWide: { width: "48%" },
  pillRow: { flexDirection: "row", gap: 10, marginTop: 6, marginBottom: 12 },
  pillButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: "#8B7FD6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pillButtonText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  reportButtonBlack: {
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: "#191A18",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 8,
  },
  reportButtonBlackText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  cameraStartButton: {
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: "#191A18",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    marginBottom: 16,
  },
  cameraStartText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  memberInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(20,20,18,.07)",
  },
  memberInfoLabel: { fontSize: 13, fontWeight: "800", color: "#4E514A", flexShrink: 0, marginRight: 12 },
  memberInfoValue: { flex: 1, fontSize: 13, color: "#20211E", fontWeight: "700", textAlign: "right" },
  bigActionButton: {
    minHeight: 64,
    borderRadius: 32,
    backgroundColor: orange,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  bigActionButtonText: { color: "#fff", fontWeight: "900", fontSize: 18 },
  pageKicker: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.7,
    color: orange,
    marginTop: 28,
    marginBottom: 7,
  },
  pageTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    letterSpacing: -0.8,
    color: "#171815",
  },
  pageIntro: {
    fontSize: 15,
    lineHeight: 22,
    color: "#676A62",
    marginTop: 7,
    marginBottom: 20,
  },
  searchInput: {
    height: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(20,20,18,.1)",
    backgroundColor: "rgba(255,255,255,.72)",
    paddingHorizontal: 15,
    fontSize: 15,
    color: "#111",
    marginBottom: 14,
  },
  memberCard: {
    minHeight: 76,
    borderWidth: 1,
    borderColor: "rgba(20,20,18,.09)",
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,.7)",
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  memberAvatar: {
    width: 43,
    height: 43,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  memberAvatarText: { color: "#fff", fontSize: 17, fontWeight: "900" },
  memberName: { fontSize: 16, fontWeight: "900", color: "#1B1C19" },
  memberMeta: { fontSize: 12, color: "#73766E", marginTop: 3 },
  memberProgress: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1B1C19",
    textAlign: "right",
  },
  memberUnit: { fontSize: 10, color: "#73766E", textAlign: "right" },
  emptyState: {
    fontSize: 15,
    lineHeight: 22,
    color: "#73766E",
    textAlign: "center",
    paddingVertical: 36,
  },
  periodSwitch: {
    flexDirection: "row",
    backgroundColor: "#E6DFD3",
    borderRadius: 15,
    padding: 4,
    marginBottom: 24,
  },
  periodButton: {
    flex: 1,
    height: 41,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  periodActive: { backgroundColor: "#191A18" },
  periodText: { fontSize: 12, fontWeight: "800", color: "#666961" },
  periodTextActive: { color: "#fff" },
  analyticsHeading: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1A1B18",
    marginTop: 8,
    marginBottom: 13,
  },
  analyticsGrid: { flexDirection: "row", justifyContent: "space-between" },
  chartsHeading: {
    fontSize: 15,
    fontWeight: "800",
    color: "#41443C",
    marginTop: 18,
    marginBottom: 10,
  },
  chartCard: {
    borderWidth: 2,
    borderColor: "#22231F",
    borderRadius: 20,
    padding: 16,
    backgroundColor: "rgba(255,255,255,.6)",
    marginBottom: 14,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#191A18",
    marginBottom: 10,
  },
  chartWrap: { height: 80, width: "100%" },
  chartLegendRow: { flexDirection: "row", gap: 16, marginTop: 10 },
  chartLegendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, fontWeight: "800", color: "#5E625A" },
  insightCard: {
    borderRadius: 22,
    backgroundColor: "#1A1A18",
    padding: 20,
    marginTop: 10,
    marginBottom: 15,
  },
  insightLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: "#F39A74",
  },
  insightTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "900",
    color: "#fff",
    marginTop: 9,
  },
  insightCopy: { fontSize: 14, lineHeight: 21, color: "#D7D4CC", marginTop: 9 },
  totalCard: {
    borderWidth: 2,
    borderColor: "#22231F",
    borderRadius: 20,
    padding: 17,
    backgroundColor: "rgba(255,255,255,.55)",
    marginBottom: 16,
  },
  totalTitle: { fontSize: 16, fontWeight: "900", color: "#1B1C19" },
  totalLine: { fontSize: 13, color: "#666961", marginTop: 7 },
  composeCard: {
    borderWidth: 2,
    borderColor: "#22231F",
    borderRadius: 22,
    padding: 17,
    backgroundColor: "rgba(255,255,255,.6)",
    gap: 11,
    marginBottom: 22,
  },
  composeTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#191A17",
    marginBottom: 2,
  },
  newsCard: {
    borderWidth: 1,
    borderColor: "rgba(20,20,18,.1)",
    borderRadius: 19,
    padding: 16,
    backgroundColor: "rgba(255,255,255,.68)",
    marginBottom: 11,
  },
  newsHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  newsTitle: { fontSize: 16, fontWeight: "900", color: "#1A1B18", flex: 1 },
  statusPill: {
    borderRadius: 10,
    backgroundColor: "#D8E8D5",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusDraft: { backgroundColor: "#E5E1D9" },
  statusText: { fontSize: 9, fontWeight: "900", color: "#454840" },
  newsBody: { fontSize: 13, lineHeight: 19, color: "#62655E", marginTop: 8 },
  newsDate: { fontSize: 11, color: "#85877F", marginTop: 10 },
  navIcon: { fontSize: 21, lineHeight: 23, color: "#5F625B" },
  navIconActive: { color: orange },
  tabPressed: { opacity: 0.55, transform: [{ scale: 0.94 }] },
  settingsHero: {
    marginTop: 26,
    marginBottom: 28,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  settingsKicker: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.8,
    color: orange,
    marginBottom: 8,
  },
  settingsTitle: {
    fontSize: 29,
    lineHeight: 34,
    fontWeight: "900",
    color: "#191A18",
    letterSpacing: -0.7,
    maxWidth: 250,
  },
  settingsSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: "#64685F",
    marginTop: 9,
    maxWidth: 275,
  },
  settingsAvatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginLeft: "auto",
  },
  settingsAvatarImage: { width: "100%", height: "100%" },
  settingsAvatarLetter: { color: "#fff", fontSize: 21, fontWeight: "900" },
  groupLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.3,
    color: "#75786F",
    marginLeft: 4,
    marginTop: 8,
    marginBottom: 9,
  },
  settingsGroup: {
    backgroundColor: "rgba(255,255,255,.82)",
    borderRadius: 22,
    padding: 17,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(20,20,18,.07)",
  },
  settingsGroupNoPadding: {
    backgroundColor: "rgba(255,255,255,.82)",
    borderRadius: 22,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(20,20,18,.07)",
    overflow: "hidden",
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#4E514A",
    marginTop: 8,
    marginBottom: 7,
  },
  settingsInput: {
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: "#F3EEE4",
    borderWidth: 1,
    borderColor: "rgba(20,20,18,.08)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#111",
    fontSize: 15,
  },
  textArea: { minHeight: 96 },
  twoColumns: { flexDirection: "row", gap: 10 },
  segment: {
    flexDirection: "row",
    backgroundColor: "#EAE4D9",
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  segmentButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: { backgroundColor: "#1A1A18" },
  segmentText: { fontSize: 13, fontWeight: "800", color: "#65685F" },
  segmentTextActive: { color: "#fff" },
  stepper: {
    height: 50,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "rgba(20,20,18,.12)",
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 12,
  },
  stepperButton: {
    width: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEE8DC",
  },
  stepperText: { fontSize: 22, fontWeight: "700", color: "#191A18" },
  stepperInput: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "900",
    color: "#111",
    backgroundColor: "#fff",
  },
  stepperValue: {
    flex: 1,
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 17,
    lineHeight: 50,
    includeFontPadding: false,
    fontWeight: "900",
    color: "#111",
    backgroundColor: "#fff",
  },
  saveSettings: {
    height: 54,
    borderRadius: 27,
    backgroundColor: "#1A1A18",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  saveSettingsText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  settingsRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(20,20,18,.07)",
  },
  settingsIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#E9E2D5",
    alignItems: "center",
    justifyContent: "center",
  },
  dangerIcon: { backgroundColor: "#F8DEDA" },
  settingsIconText: { fontSize: 16, fontWeight: "900", color: "#20211E" },
  settingsRowTitle: { fontSize: 15, fontWeight: "800", color: "#1B1C19" },
  settingsRowDetail: {
    fontSize: 12,
    lineHeight: 17,
    color: "#72756D",
    marginTop: 3,
  },
  chevron: { fontSize: 28, color: "#A2A49D", fontWeight: "300" },
  dangerText: { color: "#B73B32" },
  settingsFootnote: {
    fontSize: 12,
    lineHeight: 18,
    color: "#777A71",
    textAlign: "center",
    paddingHorizontal: 18,
    marginTop: -8,
    marginBottom: 14,
  },
  tabs: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    backgroundColor: "#FFFDF8",
    borderTopWidth: 1,
    borderTopColor: "rgba(20,20,18,.08)",
    paddingTop: 8,
    paddingBottom: 10,
  },
  tab: {
    flex: 1,
    minHeight: 49,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 1,
  },
  tabText: { color: "#6F726A", fontWeight: "700", fontSize: 9, marginTop: 3 },
  tabActive: { color: orange, fontWeight: "900" },
});
