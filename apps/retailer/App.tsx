import { WhirlSpinner, useWhirlSlot } from '../../packages/whirl/native'
import { AppSwitch } from "./src/components/AppSwitch";
import { AskWhirlCard } from './src/components/AskWhirlCard';
import { AskWhirlSheet } from './src/components/AskWhirlSheet';
import { AppWhirlProvider, Whirl, WhirlEmpty, WhirlOrMark } from './src/Whirl'
import { CARD_FONTS } from "../../packages/card-design/fonts";
import { AppAlertHost, showAlert } from "./src/components/AppAlert";
import { EmailCodeStep } from "./src/components/EmailCodeStep";
import { codeErrorMessage, isUnconfirmedEmail } from "./src/email-code";
import { ThemeProvider, useTheme, statusBarStyle } from "./src/theme";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { currencySymbol, money, scaledLimit, setActiveCountry } from "./src/money";
import { ShopOnboarding, clearPendingShop, type OnboardingDestination } from "./src/shop-onboarding";
import {
  AppState,
  Image,
  Linking,
  Platform,
  Pressable,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { KeyboardAwareScrollView } from './src/components/KeyboardAware'
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { HelpFaq } from "./src/HelpFaq";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { CameraView, useCameraPermissions } from "expo-camera";
import { haptic } from './src/haptics'
import Svg, { Polyline } from "react-native-svg";
import {
  AtSign,
  BadgeCheck,
  Bell,
  BookOpen,
  ChartNoAxesCombined,
  CloudOff,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Fingerprint,
  Gift,
  Globe,
  Image as ImageIcon,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Newspaper,
  Settings,
  Sparkles,
  Stamp,
  Star,
  Trash2,
  Users,
  X,
  type LucideIcon,
  Store,
  ScanLine,
} from "lucide-react-native";
import type { Session } from "@supabase/supabase-js";
import { useFonts, BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold } from "@expo-google-fonts/bricolage-grotesque";
import { Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from "@expo-google-fonts/inter";
import { InstrumentSerif_400Regular_Italic } from "@expo-google-fonts/instrument-serif";
import { AppIntro, MUTED, NIGHT, PAPER, SANS_HEAVY, SANS_MEDIUM } from "./src/components/Poster";
import { colors, fonts, getActiveScheme, schemeColor, themed } from "@loyalty-loop/design-tokens";
import { parseRewardQr } from "./src/reward-qr";
import { parseWinbackQr } from "./src/winback-qr";
import { chargeAfterDiscount, parsePounds, percentOff, rewardDiscountPence, rewardDiscountPercent } from "./src/reward-discount";
import { HALAL_CERTIFIERS, SHOP_FEATURES } from "./src/shop-features";
import { hasSupabaseConfig, readStoredSession, supabase } from "./src/supabase";
import { clearLaunchCache, launchCacheTicket, readLaunchCache, writeLaunchCache } from "./src/launch-cache";
import { isSessionRejection } from "./src/launch-cache-core";
import { SkeletonScreen } from "./src/components/Skeleton";
import { OutageBanner, simulatedOutage, useServiceStatus } from "./src/service-status";
import { MAX_AGE_MS as OFFLINE_STAMP_MAX_AGE_MS, MAX_QUEUED as OFFLINE_STAMP_MAX, insertStamp, isNetworkFailure, notifyStampAccepted, saveStampOffline, sendWaitingStamps, useWaitingStamps, type DrainReport } from "./src/offline-stamps";
import Storage from "expo-sqlite/kv-store";
import { HoldButton } from "./src/components/HoldButton";
import { DynamicButton } from "./src/components/DynamicButton";
import { fuzzyFilter } from "./src/fuzzy-search";
import { useDebouncedValue } from "./src/use-debounced-value";
import {
  NativeOwnerPageView,
  type NativeOnboardingDestination,
  type NativeOwnerPage,
} from "./src/owner-pages";
import { biometricLockEnabled, setBiometricLock, unlockWithBiometrics } from "./src/biometric";
import { offerPushPrompt, registerPushToken } from "./src/push";
import { getUsageAnalyticsConsent, setUsageAnalyticsConsent, trackUsageEvent } from "./src/usage-analytics";
import { syncRetailerWidget } from "./src/widgets/state";
import { Sheet } from "./src/components/Sheet";
import { TourOverlay, TourProvider, TourTarget, useTour } from "./src/components/Tour";
import { hasPointsWallet, pointsBalanceSentence, programmeIdFor, progressFor, recordsSpend, rewardWords, standingFromSnapshot, unitNames, type LadderRung, type ProgrammeSnapshot, type SnapshotStanding } from "@loyalty-loop/loyalty";
import { useBackStep } from "./src/back-steps";
import { CashOff } from "./src/CashOff";
import { useLaunchUpdate } from "./src/launch-update";
import { BusinessSettings } from "./src/shop-pages";

const FONT_DISPLAY = fonts.nativeDisplay;

type Business = {
  id: string;
  name: string;
  slug?: string | null;
  whatsapp_onboarding_enabled?: boolean | null;
  category?: string | null;
  description?: string | null;
  address?: string | null;
  postcode?: string | null;
  lat?: number | null;
  lng?: number | null;
  phone?: string | null;
  website?: string | null;
  brand_color?: string;
  card_design?: unknown;
  logo_url?: string | null;
  cover_url?: string | null;
  is_active?: boolean;
  loyalty_type?: "stamp_card" | "points" | "tiered";
  loyalty_config?: {
    stamps_required?: number;
    signup_reward_title?: string;
    stamp_icon?: string;
  };
  reward_model?: "stamp_legacy" | "spend_threshold" | "tiers" | "points" | "custom";
  programme_rules?: unknown;
  reward_threshold_pence?: number | null;
  manual_spend_max_pence?: number;
  features?: string[] | null;
  halal_certifier?: string | null;
  country_code?: string | null;
  verification_status?: "unverified" | "pending" | "verified" | "rejected";
  approval_status?: "pending" | "approved" | "rejected";
  /** Missing until the automatic win-back migration is applied. */
  winback_auto_enabled?: boolean;
  winback_threshold_days?: number;
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
  /** Stamps and purchases per day for the last 7 days, oldest first. */
  week?: number[];
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
  reward_progress_pence?: number | null;
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
  slug: "the-coffee-corner",
  category: "Cafe",
  description: "Fresh coffee, pastries and friendly faces.",
  address: "12 Market Street",
  postcode: "M1 1AA",
  phone: "0161 555 0102",
  brand_color: "#2B3A67",
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
  week: [9, 14, 11, 16, 21, 26, 13],
};
const capitalise = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
function formatDate(value?: string | null) {
  if (!value) return "-";
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
      stamps: rowsToday.length,
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
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>
        {title}
      </Text>
    </Pressable>
  );
}

const WEB_ORIGIN = "https://www.the-loyalty-loop.com";

// Scan result lines for membership tiers and points shops (see standingFromSnapshot).
function standingSentence(name: string, standing: SnapshotStanding): string {
  if (standing.kind === "points") return pointsBalanceSentence(name, standing);
  return `${name} is ${standing.tierName ? `at ${standing.tierName}` : "not yet at a level"}${standing.label ? `, ${standing.label}` : ""}.`;
}

function StandingLines({ name, standing }: { name: string; standing: SnapshotStanding }) {
  if (standing.kind === "points") {
    return (
      <View>
        <Text style={styles.spendProgress}>{name}: {standing.label}</Text>
        {standing.levelPerks?.length ? <Text style={styles.spendCap}>{standing.levelName}: {standing.levelPerks.join(" · ")}</Text> : null}
      </View>
    );
  }
  return (
    <View>
      <Text style={styles.spendProgress}>
        {name}: {standing.tierName ?? "No level yet"}
        {standing.label ? ` · ${standing.label}` : ""}
      </Text>
      {standing.perks.length ? <Text style={styles.spendCap}>{standing.perks.join(" · ")}</Text> : null}
    </View>
  );
}

type CardLinkStatus = { linked: boolean; manualToday: number; nextAllowedAt: string | null };

type SpendSummary = CardLinkStatus & ProgrammeSnapshot & {
  rewardModel: string;
  member: boolean;
  progressPence: number | null;
  redemptionBlocked: boolean;
  thresholdPence: number | null;
  manualMaxPence: number;
};
type RecentSpend = { id: string; value: number; created_at: string };

// Amounts show in the open shop's currency (src/money.ts).
const pounds = money;

type ActiveReward = { id: string; title: string; discount_pence: number | null; discount_percent: number | null };

function toActiveReward(row: { id: string; title: string; catalog?: unknown }): ActiveReward {
  return { id: row.id, title: row.title, discount_pence: rewardDiscountPence(row), discount_percent: rewardDiscountPercent(row) };
}

/** "£ off" reward: staff type the bill, the app shows what to charge on the card machine. */
function DiscountCharge({
  discountPence,
  discountPercent,
  billTotal,
  onBillTotalChange,
}: {
  discountPence: number | null;
  discountPercent?: number | null;
  billTotal: string;
  onBillTotalChange: (value: string) => void;
}) {
  const billPence = parsePounds(billTotal);
  const off = (bill: number) => (discountPercent ? percentOff(bill, discountPercent) : discountPence ?? 0);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.copy}>
        {discountPercent ? `This reward takes ${discountPercent}% off the bill.` : `This reward takes ${pounds(discountPence ?? 0)} off the bill.`}
      </Text>
      <TextInput
        value={billTotal}
        onChangeText={onBillTotalChange}
        placeholder="Bill total, e.g. 20.00"
        placeholderTextColor={colors.muted}
        keyboardType="decimal-pad"
        style={styles.input}
        accessibilityLabel="Bill total in pounds"
      />
      {billPence !== null ? (
        <Text style={[styles.matchTitle, { marginTop: 8 }]}>
          {`Charge ${pounds(chargeAfterDiscount(billPence, off(billPence)))} on the card machine`}
        </Text>
      ) : null}
    </View>
  );
}

// Idempotency key for one purchase entry: a retry after a dropped connection
// reuses it, so the server never credits the same purchase twice. Not a secret.
function newClientRef(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// After a stamp or purchase is saved: did the database add a birthday bonus?
// Reads transactions.birthday_bonus for that row. Before the birthday migration the
// column does not exist, the read fails, and nothing is shown. Never blocks the scan.
async function announceBirthdayBonus(
  find: { clientRef: string } | { transactionId: string },
  name: string,
  unit: string,
) {
  const read = (columns: string) => {
    const query = supabase.from("transactions").select(columns);
    return ("clientRef" in find ? query.eq("client_ref", find.clientRef) : query.eq("id", find.transactionId)).maybeSingle();
  };
  // birthday_item exists only after the free-item migration; fall back without it.
  let { data, error } = await read("birthday_bonus, birthday_item");
  if (error) ({ data, error } = await read("birthday_bonus"));
  const row = (!error && data ? data : {}) as unknown as { birthday_bonus?: number; birthday_item?: string | null };
  const bonus = Number(row.birthday_bonus ?? 0);
  const item = row.birthday_item ?? null;
  if (bonus <= 0 && !item) return;
  haptic.success();
  showAlert(
    `🎂 Happy birthday, ${name}!`,
    item
      ? `It's their birthday month: ${item} is waiting for them. Wish them a happy birthday!`
      : `It's their birthday month, so ${bonus} bonus ${bonus === 1 ? unit.replace(/s$/, "") : unit} ${bonus === 1 ? "was" : "were"} added. Wish them a happy birthday!`,
  );
}

// Refusals from record_manual_spend / undo_manual_spend (ARCH_PLAN.md §4.10).
function spendRefusal(error: { message?: string; details?: string } | null): string | null {
  const message = error?.message ?? "";
  if (message.includes("amount_out_of_range")) {
    const cap = Number(error?.details);
    return Number.isFinite(cap) && cap > 0
      ? `Each entry can be at most ${pounds(cap)}. The shop owner can change this limit.`
      : "That amount is outside this shop's limit.";
  }
  if (message.includes("not_a_member")) return "This customer hasn't joined your shop yet. Ask them to join it in the app first.";
  if (message.includes("shop_not_spend_based")) return "This shop isn't using spend rewards yet.";
  if (message.includes("too_late")) return "It's too late to undo this entry. Ask the shop owner, who can undo entries for 7 days.";
  if (message.includes("already_undone")) return "This entry has already been undone.";
  if (message.includes("not_allowed")) return "You don't have permission to do this.";
  return manualEntryRefusal(error);
}

function winbackCouponError(message: string): string {
  if (message.includes("coupon_already_used")) return "This win-back code has already been used.";
  if (message.includes("coupon_expired")) return "This win-back code has expired.";
  if (message.includes("coupon_not_found")) return "That win-back code isn't valid for this shop.";
  if (message.includes("not_allowed")) return "Your staff account can't redeem codes here.";
  return "Please try again.";
}

// The database refuses some manual entries for customers with a linked card
// (CARD_LINKING_PLAN.md §3.6). Turn its error codes into staff-friendly copy.
function manualEntryRefusal(error: { message?: string | null; details?: string | null } | null): string | null {
  const message = error?.message ?? "";
  if (message.includes("business is inactive")) {
    return "This shop is inactive. Ask the owner to reactivate it before adding a purchase.";
  }
  if (message.includes("manual_daily_limit_reached")) {
    return "This customer has had 3 manual entries here today.";
  }
  if (message.includes("manual_too_soon")) {
    const at = error?.details ? new Date(error.details) : null;
    const time = at && !Number.isNaN(at.getTime())
      ? at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })
      : null;
    return time
      ? `The next manual entry for this customer is allowed at ${time}.`
      : "Manual entries for this customer must be at least 30 minutes apart.";
  }
  if (message.includes("linked_customer_payment_method_required")) {
    return "Choose how the customer paid.";
  }
  return null;
}

// After stamps saved without signal were sent: tell the owner about any the
// server refused or that were too old to send. Nothing to say if all went in.
function describeWaitingProblems(
  report: DrainReport,
  words: { unit: string; units: string },
): { title: string; message: string } | null {
  const refused = report.rejected.reduce((sum, r) => sum + r.item.value, 0);
  const expired = report.expired.reduce((sum, item) => sum + item.value, 0);
  if (!refused && !expired) return null;
  const noun = (n: number) => (n === 1 ? words.unit : words.units);
  const lines: string[] = [];
  for (const { item, error } of report.rejected.slice(0, 3)) {
    const reason = manualEntryRefusal(error) ?? "The customer may need to join your shop in the app first.";
    lines.push(`${item.name || "A customer"} (${item.value} ${noun(item.value)}): ${reason}`);
  }
  if (report.rejected.length > 3) lines.push(`And ${report.rejected.length - 3} more.`);
  if (expired) {
    const hours = Math.round(OFFLINE_STAMP_MAX_AGE_MS / 3_600_000);
    lines.push(`${expired} ${noun(expired)} saved more than ${hours} hours ago ${expired === 1 ? "was" : "were"} too old to send, so ${expired === 1 ? "it was" : "they were"} not added.`);
  }
  const total = refused + expired;
  return {
    title: `${total} saved ${noun(total)} ${total === 1 ? "wasn't" : "weren't"} added`,
    message: lines.join("\n\n"),
  };
}

function Auth({ onSession, onNewShop }: { onSession: (session: Session) => void; onNewShop: () => void }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [helpOpen, setHelpOpen] = useState(false),
    // Waiting for the code from an email: to confirm the account, or to reset the password.
    [codeStep, setCodeStep] = useState<{ email: string; purpose: "signup" | "recovery" } | null>(null);
  useBackStep(!!codeStep, () => setCodeStep(null));
  async function forgotPassword() {
    const address = email.trim();
    if (!address) return showAlert("Enter your email first", "Type the email you sign in with, then tap “Forgot password?” again.");
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(address, { redirectTo: `${WEB_ORIGIN}/reset-password` });
    setBusy(false);
    if (error) return showAlert("Couldn’t send the email", codeErrorMessage(error.message));
    // Supabase doesn't say whether the address has an account, so neither do we.
    setCodeStep({ email: address, purpose: "recovery" });
  }
  async function confirmEmailFirst(address: string) {
    const { error } = await supabase.auth.resend({ type: "signup", email: address, options: { emailRedirectTo: `${WEB_ORIGIN}/auth/callback` } });
    // Even if a code went out a moment ago (rate limit), the step lets them type it.
    if (error && !/security purposes|rate limit/i.test(error.message))
      return showAlert("Could not sign in", codeErrorMessage(error.message));
    setCodeStep({ email: address, purpose: "signup" });
  }
  async function submit() {
    if (!email.trim() || !password)
      return showAlert("Check your details", "Enter your email and password.");
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      haptic.success();
      onSession(data.session);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      if (isUnconfirmedEmail(raw)) return void (await confirmEmailFirst(email.trim()));
      showAlert(
        "Could not sign in",
        /invalid/i.test(raw)
            ? "That email and password don't match. Check them and try again, or tap “Forgot password?”."
            : /fetch|network/i.test(raw)
              ? "We couldn't reach our servers. Check your connection and try again."
              : "Something went wrong. Check your email and password, then try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.auth}
        keyboardShouldPersistTaps="handled"
      >
        {codeStep ? (
          <EmailCodeStep
            key={codeStep.purpose}
            email={codeStep.email}
            purpose={codeStep.purpose}
            redirectTo={`${WEB_ORIGIN}${codeStep.purpose === "signup" ? "/auth/callback" : "/reset-password"}`}
            pose={codeStep.purpose === "signup" ? "thumbs" : "think"}
            title={codeStep.purpose === "signup" ? "Confirm your email" : "Reset your password"}
            intro={codeStep.purpose === "signup" ? "Type it here to finish signing in." : "If that address has an account, type the code here with a new password."}
            onVerified={onSession}
            onChangeEmail={() => setCodeStep(null)}
          />
        ) : (
        <>
        <WhirlOrMark pose="wave" mark={<View style={styles.mark}><Text style={styles.markText}>↻</Text></View>} />
        <Text style={styles.eyebrow}>The Loyalty Loop for Business</Text>
        <Text style={styles.hero}>Sign in to your shop</Text>
        <Text style={styles.copy}>
          Sign in as an owner or staff member to reward customers at your shop.
        </Text>
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.muted}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
          />
          <Button
            title={busy ? "Signing in…" : "Sign in"}
            onPress={submit}
            disabled={busy}
          />
        </View>
        <Pressable onPress={onNewShop} style={styles.onboardingSkip}>
          <Text style={styles.onboardingSkipText}>New here? Set up your shop</Text>
        </Pressable>
        <Text style={styles.small}>
          Customer account? Use The Loyalty Loop shopper app.
        </Text>
        <Pressable accessibilityRole="button" onPress={() => void forgotPassword()} style={styles.authHelpLink}>
          <Text style={styles.authHelpLinkText}>Forgot password?</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setHelpOpen(true)} style={styles.authHelpLink}>
          <Text style={styles.authHelpLinkText}>Help &amp; FAQ</Text>
        </Pressable>
        </>
        )}
        <Modal visible={helpOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setHelpOpen(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: schemeColor("#F6F1E8", 'bg') }} edges={["top", "bottom"]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12 }}>
              <Text style={{ fontSize: 28, fontWeight: "900", color: schemeColor("#1A2138", 'fg') }}>Help &amp; FAQ</Text>
              <Pressable accessibilityRole="button" onPress={() => setHelpOpen(false)} style={{ padding: 10 }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: schemeColor("#2B3A67", 'fg') }}>Done</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              <HelpFaq />
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </KeyboardAwareScrollView>
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
    <KeyboardAwareScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.shopPicker}
    >
      {shops.map((shop) => (
        <Pressable
          key={shop.id}
          onPress={() => onSelect(shop)}
          style={({ pressed }) => [
            styles.shopChip,
            selected?.id === shop.id && {
              backgroundColor: shop.brand_color || colors.foreground,
            },
            pressed && styles.pressed,
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
              selected?.id === shop.id && { color: schemeColor("#fff", 'fg') },
            ]}
          >
            {shop.name}
          </Text>
        </Pressable>
      ))}
    </KeyboardAwareScrollView>
  );
}

/** Entrance for the scan-match card: fades and rises in when a match appears.
 * No exit animation — the card is simply replaced by the next scan. */
function ScanMatchCard({ children }: { children: ReactNode }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(8);
  useEffect(() => {
    opacity.set(withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }));
    translateY.set(withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) }));
  }, [opacity, translateY]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: translateY.get() }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

// Shown when a reward is tried without signal. Rewards are never saved on the
// phone: two offline phones could otherwise spend the same reward twice.
const REWARD_NEEDS_SIGNAL =
  "Using a reward only works online, so it can't be spent twice. The reward is still unused. Try again when you're back online.";

function StampsScreen({
  business,
  mode,
  onModeChange,
  onDone,
  onConfigureRewards,
  staffId,
  offline,
  onSendWaiting,
}: {
  business: Business;
  /** The signed-in account; stamps saved without signal are kept per account. */
  staffId: string;
  /** The outage check says this phone has no connection. */
  offline: boolean;
  mode: "stamps" | "reward";
  onModeChange: (mode: "stamps" | "reward") => void;
  onDone: () => void;
  onConfigureRewards: () => void;
  onSendWaiting: () => void;
}) {
  setActiveCountry(business.country_code);
  const waiting = useWaitingStamps(staffId, business.id);
  // A stamp saved on the phone (no signal): the button shows "Saved" and the
  // screen resets for the next customer, without the reward haptic.
  const [savedOffline, setSavedOffline] = useState(false);
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
    stamp_count?: number | null;
    points_balance?: number | null;
  } | null>(null);
  // The shop's reward ladder, for "Sam · 7 of 10 stamps" above the Award button.
  const [ladder, setLadder] = useState<LadderRung[]>([]);
  const [activeReward, setActiveReward] = useState<ActiveReward | null>(null);
  // Bill total typed by staff for a "£ off" reward, to show what to charge.
  const [billTotal, setBillTotal] = useState("");
  const [amount, setAmount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  // Whether the scanned customer has a linked card that earns automatically at
  // this shop. If so, staff are asked how they paid before a manual entry.
  const [linkStatus, setLinkStatus] = useState<CardLinkStatus | null>(null);
  const [askPayment, setAskPayment] = useState(false);
  // Spend-recording shops (£ spend, membership tiers, points) take a £ amount
  // instead of stamps (ARCH_PLAN.md §4.10). Tiers and points read their standing
  // from the RPC snapshot (programme, tierName, pointsBalance, ...).
  const spendShop = recordsSpend(business);
  const [amountPence, setAmountPence] = useState(0);
  const [spendSummary, setSpendSummary] = useState<SpendSummary | null>(null);
  const standing = standingFromSnapshot(spendSummary, pounds);
  const [recentSpend, setRecentSpend] = useState<RecentSpend[]>([]);
  const [lastSpendMessage, setLastSpendMessage] = useState<string | null>(null);
  const spendRef = useRef<string | null>(null);
  // One-time reference for a stamp award: a retry after a dropped connection
  // reuses it, so the database refuses the second copy (transactions_client_ref_key).
  const stampRef = useRef<{ ref: string; value: number } | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    if (!spendShop) return;
    const timer = setInterval(() => setNowTick(Date.now()), 15000);
    return () => clearInterval(timer);
  }, [spendShop]);
  // How the current customer was found. Only camera scans return to the camera
  // afterwards; a typed short code stays on the code entry (otherwise awarding
  // after a code lookup unexpectedly opened the camera).
  const lookupVia = useRef<"camera" | "code" | null>(null);
  // One clean result per scan: the camera reports the same code many times a
  // second, so scan events are ignored while a code is being dealt with. Freed
  // when the camera opens again. A code that isn't ours is ignored until it has
  // been out of view for a moment, so it gives one pop-up, not a stream.
  const scanBusy = useRef(false);
  const rejectedScan = useRef<{ data: string; seenAt: number } | null>(null);
  useEffect(() => {
    if (!camera) return;
    scanBusy.current = false;
    rejectedScan.current = null;
  }, [camera]);
  const words = rewardWords(business.loyalty_type);
  const unit = words.units;
  useEffect(() => {
    let active = true;
    // Custom programmes may have no reward list at all (e.g. only "3 points = £1 off").
    if (business.reward_model === "custom") {
      setHasReward(true);
      setLadder([]);
      return;
    }
    setHasReward(null);
    // The reward list is kept on the phone too, so Scan still opens without signal.
    const ladderScope = `ladder.${business.id}`;
    const ticket = launchCacheTicket();
    void supabase
      .from("reward_catalog")
      .select("business_id,title,stamp_threshold,spend_threshold_pence")
      .eq("business_id", business.id)
      .then(({ data, error, status }) => {
        if (!active) return;
        if (error && isNetworkFailure(status)) {
          // No signal: use the saved list, or let scanning go ahead without it.
          // Stamps are then saved on the phone and sent later.
          const saved = readLaunchCache<LadderRung[]>(ladderScope, staffId)?.data ?? [];
          setLadder(saved);
          setHasReward(true);
          return;
        }
        if (error) {
          showAlert("Could not check your rewards", "We couldn't reach our servers. Check your connection, then open Scan again.");
          setHasReward(false);
          return;
        }
        setLadder((data || []) as LadderRung[]);
        setHasReward((data || []).length > 0);
        writeLaunchCache(ladderScope, staffId, data || [], ticket);
      });
    return () => {
      active = false;
    };
  }, [business.id]);

  // Once a staff member has allowed the camera, open it automatically when
  // they arrive on the stamp screen. This removes a repeated counter-side tap.
  useEffect(() => {
    if (hasReward && mode === "stamps" && permission?.granted && !matched && lookupVia.current !== "code") {
      setCamera(true);
    }
  }, [hasReward, matched, mode, permission?.granted]);

  function reset() {
    setMatched(null);
    setMemberInfo(null);
    setActiveReward(null);
    setBillTotal("");
    setCode("");
    setAmount(1);
    setLinkStatus(null);
    setAskPayment(false);
    setAmountPence(0);
    setSpendSummary(null);
    spendRef.current = null;
    stampRef.current = null;
  }

  async function loadSpendSummary(userId: string) {
    const { data, error } = await supabase.rpc("scanned_member_spend_summary", {
      _customer_id: userId,
      _business_id: business.id,
    });
    if (error || !data) {
      setSpendSummary(null);
      setLinkStatus(null);
      return;
    }
    const summary = data as SpendSummary;
    setSpendSummary(summary);
    setLinkStatus({ linked: summary.linked, manualToday: summary.manualToday, nextAllowedAt: summary.nextAllowedAt });
  }

  // This staff member's own entries from the last 10 minutes, which they can undo.
  const loadRecentSpend = useCallback(async () => {
    if (!spendShop) return;
    const { data: auth } = await supabase.auth.getUser();
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("transactions")
      .select("id,value,created_at")
      .eq("business_id", business.id)
      .eq("type", "spend")
      .eq("recorded_by", auth.user?.id ?? "")
      .is("voided_at", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10);
    setRecentSpend((data || []) as RecentSpend[]);
  }, [business.id, spendShop]);
  useEffect(() => { void loadRecentSpend(); }, [loadRecentSpend]);

  function pressKey(key: string) {
    setAmountPence((current) => {
      if (key === "back") return Math.floor(current / 10);
      if (key === "clear") return 0;
      const next = current * 10 + Number(key);
      const cap = spendSummary?.manualMaxPence ?? business.manual_spend_max_pence ?? 20000;
      return next > cap ? current : next;
    });
  }

  async function submitSpend(paymentMethod?: "cash" | "unlinked_card") {
    if (!matched || amountPence < 1) return;
    if (linkStatus?.linked && !paymentMethod) {
      setAskPayment(true);
      return;
    }
    setAskPayment(false);
    const cap = spendSummary?.manualMaxPence ?? business.manual_spend_max_pence ?? 20000;
    const name = matched.first_name || "this customer";
    const confirmed = await new Promise<boolean>((resolve) => {
      const big = amountPence * 2 >= cap;
      showAlert(
        big ? `${pounds(amountPence)}. Is that right?` : `Add ${pounds(amountPence)} for ${name}?`,
        big ? `That's a large amount for one purchase. Check it before adding it for ${name}.` : undefined,
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          { text: `Add ${pounds(amountPence)}`, onPress: () => resolve(true) },
        ],
      );
    });
    if (!confirmed) return;
    spendRef.current = spendRef.current ?? newClientRef();
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("record_manual_spend", {
        _business_id: business.id,
        _customer_id: matched.id,
        _amount_pence: amountPence,
        _payment_method: paymentMethod ?? null,
        _client_ref: spendRef.current,
      });
      const refusal = spendRefusal(error);
      if (refusal) {
        haptic.warning()
        showAlert("Can’t add this purchase", refusal);
        spendRef.current = null;
        void loadSpendSummary(matched.id);
        return;
      }
      if (error) throw error;
      spendRef.current = null;
      const result = data as { transactionId?: string; progressPence: number; thresholdPence: number; rewardsEarned: number | null } & ProgrammeSnapshot;
      if (result.transactionId && business.reward_model === "points") {
        void announceBirthdayBonus({ transactionId: result.transactionId }, name, "points");
      }
      const left = Math.max(0, result.thresholdPence - result.progressPence);
      const resultStanding = standingFromSnapshot(result, pounds);
      setLastSpendMessage(
        result.rewardsEarned
          ? `${pounds(amountPence)} added. ${name} earned ${result.rewardsEarned === 1 ? "a reward" : `${result.rewardsEarned} rewards`}!`
          : resultStanding
            ? `${pounds(amountPence)} added. ${standingSentence(name, resultStanding)}`
            : `${pounds(amountPence)} added. ${name} is ${pounds(left)} from a reward.`,
      );
      void supabase.functions.invoke("send-user-push", { body: { business_id: business.id, user_id: matched.id } });
      void supabase.functions.invoke("update-wallet-pass", { body: { business_id: business.id, user_id: matched.id } });
      void loadRecentSpend();
      setShowSuccess(true);
    } catch (e) {
      // spendRef is kept, so trying again cannot credit the purchase twice.
      haptic.error()
      showAlert("Could not add purchase", "The purchase wasn't saved. Check the connection and try again. Trying again won't add it twice.");
    } finally {
      setBusy(false);
    }
  }

  function undoSpend(entry: RecentSpend) {
    showAlert(`Undo ${pounds(entry.value)}?`, "This takes the amount back off the customer's progress.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Undo",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.rpc("undo_manual_spend", { _transaction_id: entry.id, _reason: "Undone by staff" });
          const refusal = spendRefusal(error);
          if (refusal || error) showAlert("Could not undo", refusal ?? "The entry is still there. Check the connection and try again.");
          else setLastSpendMessage(`${pounds(entry.value)} undone.`);
          void loadRecentSpend();
        },
      },
    ]);
  }

  function choosePayment(method: "cash" | "unlinked_card") {
    if (spendShop) void submitSpend(method);
    else void award(method);
  }

  async function loadLinkStatus(userId: string) {
    const { data, error } = await supabase.rpc("customer_card_link_status", {
      _customer_id: userId,
      _business_id: business.id,
    });
    // On any error, behave as before (no payment question). The database
    // still enforces the rule and award() explains any refusal.
    setLinkStatus(error || !data ? null : (data as CardLinkStatus));
  }

  // After a successful award/redeem, show the checkmark confirmation first;
  // the screen only resets once that animation has finished fading out.
  // The button turns into a green "Awarded" tick; reset for the next customer
  // after ~0.65s (the old full-screen tick took ~0.75s), so the till is never slower.
  useEffect(() => {
    if (!showSuccess) return;
    haptic.reward()
    const timer = setTimeout(finishAfterSuccess, 650);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSuccess]);

  function finishAfterSuccess() {
    setShowSuccess(false);
    reset();
    setCamera(lookupVia.current === "camera");
    onDone();
  }

  // Saved on the phone: a plain success tap (not the reward one, nothing has
  // reached the customer yet), and a little longer so the note can be read.
  useEffect(() => {
    if (!savedOffline) return;
    haptic.success();
    const timer = setTimeout(() => {
      setSavedOffline(false);
      reset();
      setCamera(lookupVia.current === "camera");
    }, 1400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedOffline]);

  async function loadMemberDetails(userId: string) {
    void (spendShop ? loadSpendSummary(userId) : loadLinkStatus(userId));
    const [{ data: memberRows }, { data: rewardRows }] = await Promise.all([
      supabase.rpc("get_scanned_member_details", { _business_id: business.id, _user_id: userId }),
      supabase
        .from("rewards")
        .select("id,title,catalog:reward_catalog(discount_pence,discount_percent)")
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
        ? { joined_at: row.joined_at, last_activity_at: row.last_activity_at, stamp_count: row.stamp_count, points_balance: row.points_balance }
        : null,
    );
    setActiveReward(rewardRows?.[0] ? toActiveReward(rewardRows[0]) : null);
  }

  async function loadMemberInfo(userId: string) {
    const { data } = await supabase.rpc("get_scanned_member_details", {
      _business_id: business.id, _user_id: userId,
    });
    const row = (data || [])[0] as ScannedMemberDetails | undefined;
    if (row) setMatched({ id: row.id, first_name: row.first_name, last_name: row.last_name, email: row.email });
    setMemberInfo(row ? { joined_at: row.joined_at, last_activity_at: row.last_activity_at, stamp_count: row.stamp_count, points_balance: row.points_balance } : null);
  }

  async function parse(value: string) {
    const winbackCode = parseWinbackQr(value);
    if (winbackCode) {
      lookupVia.current = "code";
      setCamera(false);
      setBusy(true);
      try {
        await redeemWinback(winbackCode);
      } catch (e) {
        showAlert("Could not use code", e instanceof Error ? e.message : "Please try again.");
      } finally {
        setBusy(false);
      }
      return;
    }
    const rewardToken = parseRewardQr(value);
    if (rewardToken) {
      // A reward QR always means "use this reward": switch to Reward and carry on.
      if (mode !== "reward") onModeChange("reward");
      setCamera(false);
      setBusy(true);
      try {
        const { data: reward, error, status } = await supabase
          .from("rewards")
          .select("id,title,user_id,redeemed_at,expires_at,catalog:reward_catalog(discount_pence,discount_percent)")
          .eq("business_id", business.id)
          .eq("qr_token", rewardToken)
          .maybeSingle();
        if (error && isNetworkFailure(status)) throw new Error(REWARD_NEEDS_SIGNAL);
        if (error) throw new Error("We couldn't check this reward. Check the connection and scan it again.");
        if (!reward) throw new Error("That reward does not belong to this shop.");
        if (reward.redeemed_at) throw new Error("This reward has already been redeemed.");
        if (reward.expires_at && new Date(reward.expires_at) < new Date()) throw new Error("This reward has expired.");
        setMatched({ id: reward.user_id });
        setActiveReward(toActiveReward(reward));
        setCode("");
        void loadMemberInfo(reward.user_id);
      } catch (e) {
        showAlert("Could not find reward", e instanceof Error ? e.message : "Please try again.");
      } finally {
        setBusy(false);
      }
      return;
    }
    const match = value.match(/^loyaltyloop:customer:(.+)$/);
    if (!match) {
      rejectedScan.current = { data: value, seenAt: Date.now() };
      scanBusy.current = false;
      showAlert(
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
  /** Redeems a win-back coupon (typed or scanned). Throws a readable Error on failure. */
  async function redeemWinback(normalized: string) {
    const { data, error } = await supabase.rpc("redeem_winback_coupon", {
      _business_id: business.id,
      _code: normalized,
    });
    if (error) throw new Error(winbackCouponError(error.message));
    const userId = (data as { user_id: string }).user_id;
    haptic.success()
    showAlert("Win-back code accepted", "Give the customer their welcome-back extra. The code is now used up.");
    setMatched({ id: userId });
    setCode("");
    void loadMemberDetails(userId);
  }
  async function lookup() {
    if (!code.trim()) return;
    lookupVia.current = "code";
    setBusy(true);
    const normalized = code.replace(/\s+/g, "").toUpperCase();
    try {
      if (normalized.startsWith("COMEBACK")) {
        await redeemWinback(normalized);
        return;
      }
      if (mode === "reward") {
        const { data: reward, error: rewardError, status: rewardStatus } = await supabase
          .from("rewards")
          .select("id,title,user_id,redeemed_at,expires_at,catalog:reward_catalog(discount_pence,discount_percent)")
          .eq("business_id", business.id)
          .eq("short_code", normalized)
          .maybeSingle();
        if (rewardError && isNetworkFailure(rewardStatus)) throw new Error(REWARD_NEEDS_SIGNAL);
        if (rewardError) throw new Error("We couldn't check that code. Check the connection and try again.");
        if (reward) {
          if (reward.redeemed_at) throw new Error("This reward has already been redeemed.");
          if (reward.expires_at && new Date(reward.expires_at) < new Date()) throw new Error("This reward has expired.");
          setMatched({ id: reward.user_id });
          setActiveReward(toActiveReward(reward));
          setCode("");
          void loadMemberInfo(reward.user_id);
          return;
        }
      }
      const { data, error, status } = await supabase.rpc("lookup_user_by_stamp_code", {
        _code: normalized,
      });
      if (error && isNetworkFailure(status)) {
        throw new Error(
          mode === "reward"
            ? REWARD_NEEDS_SIGNAL
            : spendShop
              ? "Looking up a code needs a connection. Try again when you're back online."
              : `Looking up a typed code needs a connection. Scan the customer's QR code instead: without signal, ${unit} are saved on this phone and sent when you're back online.`,
        );
      }
      if (error) throw new Error("We couldn't check that code. Check the connection and try again.");
      const person = (data || [])[0];
      if (!person) throw new Error(mode === "reward" ? "No reward or customer found with that code." : "No customer found with that code.");
      setMatched(person);
      setCode("");
      void loadMemberDetails(person.id);
    } catch (e) {
      showAlert(
        mode === "reward" ? "Could not find reward" : "Could not find customer",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function award(paymentMethod?: "cash" | "unlinked_card") {
    if (!matched) return;
    if (linkStatus?.linked && !paymentMethod) {
      setAskPayment(true);
      return;
    }
    setAskPayment(false);
    const value = Math.max(1, amount);
    if (!stampRef.current || stampRef.current.value !== value) stampRef.current = { ref: newClientRef(), value };
    const stamp = { ref: stampRef.current.ref, userId: matched.id, businessId: business.id, value, paymentMethod: paymentMethod ?? null };
    // No signal: keep the stamp on this phone with its reference. If an earlier
    // try did get through, the database refuses the copy when it is sent.
    const keepOnPhone = () => {
      const saved = saveStampOffline(staffId, { ...stamp, name: matched.first_name ?? null });
      if (!saved.ok) {
        haptic.error()
        showAlert(
          saved.reason === "full" ? `${OFFLINE_STAMP_MAX} ${unit} are waiting to send` : `Could not save the ${words.unit}`,
          saved.reason === "full"
            ? `This phone can hold ${OFFLINE_STAMP_MAX} ${unit} without signal. Get back online so they can send, then add more.`
            : "Nothing was added. Try again.",
        );
        return;
      }
      stampRef.current = null;
      setSavedOffline(true);
    };
    setBusy(true);
    try {
      if (offline) {
        keepOnPhone();
        return;
      }
      const inserted = await insertStamp(stamp);
      if (inserted.error && isNetworkFailure(inserted.status)) {
        keepOnPhone();
        return;
      }
      // Same reference already saved: the first tap got through, so this is a success.
      const alreadySaved = inserted.error?.code === "23505" && `${inserted.error.message}${inserted.error.details ?? ""}`.includes("client_ref");
      const error = alreadySaved ? null : inserted.error;
      const refusal = manualEntryRefusal(error);
      if (refusal) {
        haptic.warning()
        showAlert("Can’t add this entry", refusal);
        if (error?.message?.includes("linked_customer_payment_method_required")) {
          setLinkStatus((current) => ({ manualToday: 0, nextAllowedAt: null, ...current, linked: true }));
          setAskPayment(true);
        }
        stampRef.current = null;
        void loadLinkStatus(matched.id);
        return;
      }
      if (error) throw error;
      void announceBirthdayBonus({ clientRef: stampRef.current.ref }, matched.first_name || "the customer", unit);
      stampRef.current = null;
      notifyStampAccepted(business.id, matched.id, value);
      // The signal is clearly back: send anything still waiting on the phone.
      if (waiting > 0) onSendWaiting();
      // Show the success checkmark; reset() (and returning to the camera for
      // the next person in the queue, if this came from a camera scan) fires
      // once that confirmation has finished.
      setShowSuccess(true);
    } catch (e) {
      haptic.error()
      showAlert(
        `Could not add ${unit}`,
        "Nothing was added. Check the connection and try again. If it keeps failing, the customer may need to join your shop in the app first.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function redeem() {
    if (!matched || !activeReward) return;
    // Rewards are never saved on the phone (no double spending): say so plainly.
    if (offline) {
      showAlert("Rewards need a connection", REWARD_NEEDS_SIGNAL);
      return;
    }
    setBusy(true);
    try {
      const { error, status } = await supabase
        .from("rewards")
        .update({ redeemed_at: new Date().toISOString() })
        .eq("id", activeReward.id)
        .is("redeemed_at", null);
      if (error && isNetworkFailure(status)) {
        haptic.error()
        showAlert("Rewards need a connection", REWARD_NEEDS_SIGNAL);
        return;
      }
      if (error) throw error;
      void supabase.functions.invoke("send-user-push", {
        body: { business_id: business.id, user_id: matched.id },
      });
      void supabase.functions.invoke("update-wallet-pass", {
        body: { business_id: business.id, user_id: matched.id },
      });
      setShowSuccess(true);
    } catch (e) {
      haptic.error()
      showAlert(
        "Could not redeem",
        e instanceof Error && e.message.includes("business is inactive")
          ? "This shop is inactive. Ask the owner to reactivate it before redeeming a reward."
          : "The reward is still unused. Check the connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <View>
      <Text style={styles.pageTitle}>{spendShop ? "Record a purchase" : capitalise(unit)}</Text>
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
              {value === "stamps" ? (spendShop ? "Purchase" : capitalise(unit)) : "Reward"}
            </Text>
          </Pressable>
        ))}
      </View>
      {waiting > 0 ? (
        <WaitingStampsPill count={waiting} words={words} offline={offline} onPress={onSendWaiting} style={{ marginTop: 14 }} />
      ) : null}
      {hasReward === null ? (
        <View style={styles.card}>
          <WhirlSpinner size={28} />
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
          {lastSpendMessage && spendShop && mode === "stamps" ? (
            <Pressable onPress={() => setLastSpendMessage(null)} style={styles.spendBanner}>
              <Text style={styles.spendBannerText}>{lastSpendMessage}</Text>
            </Pressable>
          ) : null}
          {mode === "stamps" && !spendShop && (
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
          <TourTarget id="scan-input">
          <Pressable
            onPress={async () => {
              if (!permission?.granted) {
                const result = await requestPermission();
                if (!result.granted)
                  return showAlert(
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
            <Text style={styles.cameraStartText}>Scan customer QR</Text>
          </Pressable>
          <Sheet visible={camera} onClose={() => setCamera(false)} backdrop={false} dragArea="full" sheetStyle={styles.cameraSheet}>
            <SafeAreaView style={styles.cameraWrap}>
              <Text style={styles.cameraTitle}>{mode === "reward" ? "Scan reward QR code" : "Scan customer card"}</Text>
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={({ data }) => {
                  if (scanBusy.current) return;
                  const now = Date.now();
                  const rejected = rejectedScan.current;
                  if (rejected && rejected.data === data && now - rejected.seenAt < 2500) {
                    rejected.seenAt = now;
                    return;
                  }
                  scanBusy.current = true;
                  haptic.select();
                  lookupVia.current = "camera";
                  void parse(data);
                }}
              />
              <Button
                title="Cancel scan"
                secondary
                onPress={() => setCamera(false)}
              />
            </SafeAreaView>
          </Sheet>
          <View style={styles.card}>
            <Text style={styles.section}>{mode === "reward" ? "Or enter their reward or customer code" : "Or enter their code"}</Text>
            <TextInput
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.customerCodeInput]}
              value={code}
              onChangeText={setCode}
              placeholder={mode === "reward" ? "Reward or customer short code" : "Customer short code"}
              selectionColor={schemeColor("#1A2138", 'fg')}
              autoCapitalize="characters"
            />
            <Button
              title={busy ? "Looking up…" : "Find customer"}
              onPress={lookup}
              disabled={busy}
            />
          </View>
          </TourTarget>
          {matched && (
            <ScanMatchCard key={matched.id}>
            <TourTarget id="scan-result">
            <View style={styles.card}>
              {mode === "stamps" && spendShop ? (
                <View>
                  {standing ? <StandingLines name={matched.first_name || "Customer"} standing={standing} /> : null}
                  {standing?.kind === "points" && standing.cash ? (
                    <CashOff
                      businessId={business.id}
                      customerId={matched.id}
                      name={matched.first_name || "the customer"}
                      standing={standing}
                      pounds={pounds}
                      onDone={() => void loadSpendSummary(matched.id)}
                    />
                  ) : null}
                  {!standing && spendSummary && spendSummary.thresholdPence ? (
                    <Text style={styles.spendProgress}>
                      {(matched.first_name || "Customer")}: {pounds(Math.max(0, spendSummary.progressPence ?? 0))} of {pounds(spendSummary.thresholdPence)}
                      {spendSummary.redemptionBlocked ? " · reward paused" : ""}
                    </Text>
                  ) : null}
                  <Text style={styles.spendAmount} accessibilityLabel={`Amount ${pounds(amountPence)}`}>{pounds(amountPence)}</Text>
                  <Text style={styles.spendCap}>
                    Up to {pounds(spendSummary?.manualMaxPence ?? business.manual_spend_max_pence ?? 20000)} per entry
                  </Text>
                  <View style={styles.keypad}>
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"].map((key) => (
                      <Pressable
                        key={key}
                        onPress={() => pressKey(key)}
                        accessibilityRole="button"
                        accessibilityLabel={key === "back" ? "Delete last digit" : key === "clear" ? "Clear amount" : key}
                        style={({ pressed }) => [styles.keypadKey, pressed && styles.pressed]}
                      >
                        <Text style={styles.keypadKeyText}>{key === "back" ? "⌫" : key === "clear" ? "C" : key}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <DynamicButton
                    status={busy ? "busy" : showSuccess ? "done" : "idle"}
                    label={amountPence ? `Add ${pounds(amountPence)}` : "Type the amount"}
                    busyLabel="Adding…"
                    doneLabel="Added"
                    onPress={() => void submitSpend()}
                    disabled={amountPence < 1}
                    color={colors.primary}
                    style={styles.dynamicAction}
                  />
                </View>
              ) : mode === "stamps" ? (
                <View>
                  {/* Who is being stamped, and where they are, before the tap. */}
                  <Text style={styles.matchWho} accessibilityLiveRegion="polite">
                    {matched.first_name || "Customer"}
                    {memberInfo ? ` · ${progressFor(business, memberInfo, ladder).label}` : ""}
                  </Text>
                  <DynamicButton
                    status={busy ? "busy" : showSuccess || savedOffline ? "done" : "idle"}
                    label={`Award ${unit}`}
                    busyLabel="Awarding…"
                    doneLabel={savedOffline ? "Saved" : "Awarded"}
                    doneColor={savedOffline ? colors.amberInk : undefined}
                    onPress={() => void award()}
                    disabled={savedOffline}
                    color={colors.primary}
                    style={styles.dynamicAction}
                  />
                  {savedOffline ? (
                    <Text style={styles.offlineNote} accessibilityLiveRegion="polite">
                      Saved – will send when you're back online
                    </Text>
                  ) : offline ? (
                    <Text style={styles.offlineNote}>
                      No signal. This {words.unit} will be saved on the phone and sent when you're back online.
                    </Text>
                  ) : null}
                </View>
              ) : activeReward ? (
                <View>
                <Text style={styles.matchWho}>{matched.first_name || "Customer"}</Text>
                {activeReward.discount_pence || activeReward.discount_percent ? (
                  <DiscountCharge
                    discountPence={activeReward.discount_pence}
                    discountPercent={activeReward.discount_percent}
                    billTotal={billTotal}
                    onBillTotalChange={setBillTotal}
                  />
                ) : null}
                {/* Redeeming can't be undone, so it takes a short (0.6s) press and hold
                    instead of a tap: no accidental redemptions, no extra pop-up. */}
                <HoldButton
                  label={activeReward.discount_pence || activeReward.discount_percent ? "Hold: customer paid, use reward" : `Hold to redeem "${activeReward.title}"`}
                  holdingLabel="Keep holding…"
                  busy={busy || showSuccess}
                  busyLabel={showSuccess ? "Redeemed" : "Redeeming…"}
                  doneLabel="Redeeming…"
                  duration={600}
                  onConfirm={() => void redeem()}
                  accessibilityLabel={activeReward.discount_pence || activeReward.discount_percent ? "Customer paid, use reward" : `Redeem ${activeReward.title}`}
                  color={showSuccess ? colors.funGreen : colors.primary}
                  style={styles.dynamicAction}
                />
                </View>
              ) : (
                <Text style={styles.copy}>
                  {offline
                    ? "No signal, so rewards can't be checked or used right now. Try again when you're back online."
                    : `${matched.first_name || "This customer"} has no reward ready to use yet.`}
                </Text>
              )}
              <FoldSection title="Customer details">
                <View style={styles.memberInfoRow}>
                  <Text style={styles.memberInfoLabel}>Name</Text>
                  <Text style={styles.memberInfoValue}>
                    {[matched.first_name, matched.last_name]
                      .filter(Boolean)
                      .join(" ") || "-"}
                  </Text>
                </View>
                <View style={styles.memberInfoRow}>
                  <Text style={styles.memberInfoLabel}>Email</Text>
                  <Text style={styles.memberInfoValue}>
                    {matched.email || "Not available"}
                  </Text>
                </View>
                <View style={styles.memberInfoRow}>
                  <Text style={styles.memberInfoLabel}>First visit</Text>
                  <Text style={styles.memberInfoValue}>
                    {formatDate(memberInfo?.joined_at)}
                  </Text>
                </View>
                <View style={styles.memberInfoRow}>
                  <Text style={styles.memberInfoLabel}>Last visit</Text>
                  <Text style={styles.memberInfoValue}>
                    {formatDate(memberInfo?.last_activity_at)}
                  </Text>
                </View>
              </FoldSection>
            </View>
            </TourTarget>
            </ScanMatchCard>
          )}
        </>
      )}
      {spendShop && mode === "stamps" && recentSpend.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.section}>Your recent entries</Text>
          {recentSpend.map((entry) => {
            const ageMs = nowTick - new Date(entry.created_at).getTime();
            const minutesLeft = Math.max(0, Math.ceil((10 * 60 * 1000 - ageMs) / 60000));
            return (
              <View key={entry.id} style={styles.recentRow}>
                <Text style={styles.recentAmount}>{pounds(entry.value)}</Text>
                <Text style={styles.recentTime}>
                  {new Date(entry.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </Text>
                {minutesLeft > 0 ? (
                  <Pressable onPress={() => undoSpend(entry)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Undo ${pounds(entry.value)}`}>
                    <Text style={styles.recentUndo}>Undo · {minutesLeft} min</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
      <Sheet visible={askPayment} onClose={() => setAskPayment(false)} dragArea="full" sheetStyle={styles.paySheet}>
        <SafeAreaView edges={["bottom"]}>
          <View style={styles.paySheetHandle} />
          <Text style={styles.paySheetTitle}>This customer has a linked card</Text>
          <Text style={styles.paySheetCopy}>
            If they paid with it, their reward updates automatically, so there’s nothing to do.
          </Text>
          <Text style={styles.paySheetQuestion}>How did they pay?</Text>
          <View style={styles.paySheetButtons}>
            <Button title="Cash" onPress={() => choosePayment("cash")} disabled={busy} />
            <Button title="A different card" onPress={() => choosePayment("unlinked_card")} disabled={busy} />
            <Button title="They used their linked card" secondary onPress={() => setAskPayment(false)} disabled={busy} />
          </View>
          {linkStatus && linkStatus.manualToday > 0 ? (
            <Text style={styles.paySheetNote}>
              {linkStatus.manualToday} of 3 manual entries used today for this customer.
            </Text>
          ) : null}
        </SafeAreaView>
      </Sheet>
    </View>
  );
}

/** Stamps saved on this phone without signal. Amber, like the other dashboard
 *  call-outs; tapping it tries to send them now. */
function WaitingStampsPill({
  count,
  words,
  offline,
  onPress,
  style,
}: {
  count: number;
  words: { unit: string; units: string };
  offline: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const noun = count === 1 ? words.unit : words.units;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${count} ${noun} waiting to send. ${offline ? "They'll send when you're back online." : "Tap to send now."}`}
      onPress={onPress}
      style={({ pressed }) => [styles.waitingPill, style, pressed && styles.pressed]}
    >
      <CloudOff size={20} strokeWidth={2} color={colors.amberInk} />
      <View style={{ flex: 1 }}>
        <Text style={styles.waitingPillTitle}>{count} {noun} waiting to send</Text>
        <Text style={styles.waitingPillSub}>{offline ? "They'll send by themselves when you're back online." : "They'll send by themselves. Tap to send now."}</Text>
      </View>
    </Pressable>
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

// Home, three planes: the stats card (ink on white) in the middle, and the
// Scan button lifted on top of its lower edge. Sapphire is kept for things
// you tap; type is huge numbers or tiny caps. Setup steps only show while
// something is missing.
const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];
function DashboardHome({
  business,
  stats,
  waiting = 0,
  offline = false,
  onSendWaiting,
  onIssueStamp,
  onRedeemReward,
  onReport,
  onOpenGuide,
  onWinBack,
}: {
  business: Business;
  stats: DashboardStats;
  waiting?: number;
  offline?: boolean;
  onSendWaiting?: () => void;
  onIssueStamp: () => void;
  onRedeemReward: () => void;
  onReport: () => void;
  onOpenGuide: () => void;
  onWinBack?: () => void;
}) {
  const greeting = useWhirlSlot("home", "greeting");
  const [askWhirl, setAskWhirl] = useState(false);
  const checklist = [
    { label: "Add your address", done: Boolean(business.address) },
    { label: "Add your postcode", done: Boolean(business.postcode) },
    { label: "Put your shop on the map", done: business.lat != null && business.lng != null },
    { label: "Write a short description", done: Boolean(business.description) },
  ];
  const spendShop = recordsSpend(business);
  // What one entry is called at this shop: purchases, or stamps / points / visits.
  const activity = spendShop ? "purchases" : rewardWords(business.loyalty_type).units;
  const week = stats.week ?? [];
  const weekTotal = week.reduce((sum, n) => sum + n, 0);
  const peak = Math.max(1, ...week);
  const today = new Date().getDay();
  const days = week.map((count, i) => ({ count, day: WEEKDAY[(today - (week.length - 1 - i) + 7) % 7], best: count === peak && count > 0 }));
  return (
    <View style={{ gap: 14 }}>
      <View style={styles.homeHeader}>
        {business.logo_url ? (
          <Image source={{ uri: business.logo_url }} style={styles.homeHeaderLogo} />
        ) : (
          <View style={[styles.homeHeaderLogo, { backgroundColor: colors.olive, alignItems: "center", justifyContent: "center" }]}>
            <Text style={styles.homeHeaderLetter}>{business.name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <Text style={[styles.homeHeaderName, { flexShrink: 1 }]} numberOfLines={1}>{business.name}</Text>
        {greeting ? <Whirl pose="peek" size={76} effect="peek" style={{ marginLeft: "auto" }} /> : null}
      </View>
      <AskWhirlCard mode="business" onPress={() => setAskWhirl(true)} />
      {/* Only aggregate counts are sent to Whirl: never customers' names, emails or numbers. */}
      <AskWhirlSheet visible={askWhirl} onClose={() => setAskWhirl(false)} mode="business" businessId={business.id} stats={{ period: stats }} />

      <View style={styles.homePanel}>
        <Text style={styles.homePanelLabel}>Last 30 days</Text>
        <View style={styles.homeBigRow}>
          <Text style={styles.homeBig} numberOfLines={1} adjustsFontSizeToFit>{stats.activeMembers}</Text>
          {stats.dormantMembers > 0 ? (
            <View style={styles.homeBadge}><Text style={styles.homeBadgeText}>{stats.dormantMembers} quiet</Text></View>
          ) : null}
        </View>
        <Text style={styles.homeBigLabel}>{stats.activeMembers === 1 ? "regular came back" : "regulars came back"}</Text>
        {week.length ? (
          <View accessible accessibilityLabel={`${weekTotal} ${activity} in the last 7 days`} style={styles.homeBars}>
            {days.map((d, i) => (
              <View key={i} style={styles.homeBarCol}>
                {/* The best day is the darkest bar in light and the brightest in dark. */}
                <View style={[styles.homeBar, { height: Math.max(6, Math.round((d.count / peak) * 70)), backgroundColor: d.best ? colors.sageInk : schemeColor("rgba(26,33,56,0.16)", 'bg') }]} />
                <Text style={styles.homeBarDay}>{d.day}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {week.length ? <Text style={styles.homeWeek}>{weekTotal} {activity} this week</Text> : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Scan a customer"
        onPress={onIssueStamp}
        style={({ pressed }) => [styles.homeScan, pressed && styles.pressed]}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.homeScanTitle}>Scan a customer</Text>
          <Text style={styles.homeScanSub}>{spendShop ? "Record a purchase or a reward" : `Add ${activity} or use a reward`}</Text>
        </View>
        <View style={styles.homeScanIcon}><ScanLine size={26} strokeWidth={2} color={colors.primaryText} /></View>
      </Pressable>

      {/* Below the Scan button, which overlaps the panel's lower edge. */}
      {waiting > 0 && onSendWaiting ? (
        <WaitingStampsPill count={waiting} words={rewardWords(business.loyalty_type)} offline={offline} onPress={onSendWaiting} />
      ) : null}
      {stats.dormantMembers > 0 && onWinBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Win back ${stats.dormantMembers} ${stats.dormantMembers === 1 ? "customer" : "customers"}`}
          onPress={onWinBack}
          style={({ pressed }) => [styles.homePill, styles.homePillAmber, { alignSelf: "stretch", flexGrow: 0, flexShrink: 0, flexBasis: "auto" }, pressed && styles.pressed]}
        >
          <Users size={19} strokeWidth={2} color={colors.amberInk} />
          <Text style={[styles.homePillText, { color: colors.amberInk }]}>Win back {stats.dormantMembers} {stats.dormantMembers === 1 ? "customer" : "customers"}</Text>
        </Pressable>
      ) : null}

      <View style={styles.homePills}>
        <Pressable accessibilityRole="button" accessibilityLabel="Redeem a reward" onPress={onRedeemReward} style={({ pressed }) => [styles.homePill, styles.homePillSage, pressed && styles.pressed]}>
          <Gift size={19} strokeWidth={2} color={colors.sageInk} />
          <Text style={[styles.homePillText, { color: colors.sageInk }]}>Redeem</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Open your business report" onPress={onReport} style={({ pressed }) => [styles.homePill, styles.homePillPeach, pressed && styles.pressed]}>
          <Sparkles size={19} strokeWidth={2} color={colors.peachInk} />
          <Text style={[styles.homePillText, { color: colors.peachInk }]}>Report</Text>
        </Pressable>
      </View>

      <View style={styles.homeTiles}>
        <View style={[styles.homeTile, { backgroundColor: colors.peach }]}>
          <Text style={[styles.homeTileValue, { color: colors.peachInk }]} numberOfLines={1} adjustsFontSizeToFit>{stats.members}</Text>
          <Text style={[styles.homeTileLabel, { color: colors.peachInk }]}>Customers</Text>
        </View>
        <View style={[styles.homeTile, { backgroundColor: colors.amber }]}>
          <Text style={[styles.homeTileValue, { color: colors.amberInk }]} numberOfLines={1} adjustsFontSizeToFit>{stats.stamps}</Text>
          <Text style={[styles.homeTileLabel, { color: colors.amberInk }]}>{capitalise(activity)}</Text>
        </View>
        <View style={[styles.homeTile, { backgroundColor: colors.sage }]}>
          <Text style={[styles.homeTileValue, { color: colors.sageInk }]} numberOfLines={1} adjustsFontSizeToFit>{stats.rewards}</Text>
          <Text style={[styles.homeTileLabel, { color: colors.sageInk }]}>Rewards</Text>
        </View>
      </View>

      {checklist.some((item) => !item.done) ? (
        <View style={styles.setupCard}>
          <Text style={styles.setupTitle}>Finish setting up</Text>
          {checklist.map((item) => (
            <View key={item.label} style={styles.checkRow}>
              <View style={[styles.checkCircle, item.done && styles.checkDone]}>
                <Text style={styles.checkMark}>{item.done ? "✓" : ""}</Text>
              </View>
              <Text style={[styles.checkText, item.done && styles.checkTextDone]}>{item.label}</Text>
            </View>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="Open the setup guide" onPress={onOpenGuide} style={({ pressed }) => [styles.setupGuideButton, pressed && styles.pressed]}>
            <Text style={styles.setupGuideText}>Open setup guide</Text>
            <Text style={styles.setupGuideArrow}>›</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={onOpenGuide} style={({ pressed }) => [styles.homeGuideLink, pressed && styles.pressed]}>
          <Text style={styles.homeGuideLinkText}>Setup guide</Text>
          <ChevronRight size={18} color={colors.ink} />
        </Pressable>
      )}
    </View>
  );
}

function CustomersHome({ business, onBusinessChanged }: { business: Business; onBusinessChanged: () => Promise<void> | void }) {
  const days = business.winback_threshold_days ?? 30;
  const [members, setMembers] = useState<MemberRow[] | null>(null),
    [audience, setAudience] = useState<"all" | "inactive_30" | "regulars">("all"),
    [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [sending, setSending] = useState(false),
    [emailing, setEmailing] = useState(false);
  useEffect(() => {
    supabase.rpc("get_business_members", { _business_id: business.id }).then(({ data, error }) => {
      if (error) showAlert("Could not load customers", "We couldn't reach our servers. Check your connection, then open this page again.");
      setMembers((data || []) as MemberRow[]);
    });
  }, [business.id]);
  const cutoff = Date.now() - days * 86400000;
  // Same rule as the server: no visit yet counts from the day they joined.
  const seen = (m: MemberRow) => new Date(m.last_activity_at || m.joined_at).getTime();
  const list = members || [];
  const quiet = list.filter((m) => seen(m) < cutoff).sort((a, b) => seen(b) - seen(a));
  const nameOf = (m: MemberRow) => [m.first_name, m.last_name].filter(Boolean).join(" ") || "Customer";
  const ago = (m: MemberRow) => {
    if (!m.last_activity_at) return "never";
    const d = Math.floor((Date.now() - seen(m)) / 86400000);
    return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
  };
  async function send() {
    if (!title.trim() || !body.trim()) {
      showAlert("Add a message", "Write a short title and message first.");
      return;
    }
    setSending(true);
    const { error } = await supabase
      .from("business_promotions")
      .insert({ business_id: business.id, title: title.trim(), body: body.trim(), audience, status: "sent" });
    setSending(false);
    if (error) {
      showAlert("Could not send", "Your message wasn't sent. Check the connection and try again.");
      return;
    }
    setTitle("");
    setBody("");
    showAlert("Message sent", "It's on its way to their phones and their inbox.");
  }
  async function emailQuiet() {
    setEmailing(true);
    const { data, error } = await supabase.functions.invoke("send-winback-emails", {
      body: { business_id: business.id, days_inactive_threshold: days },
    });
    setEmailing(false);
    if (error) {
      showAlert("Could not send emails", "Try again in a minute.");
      return;
    }
    const result = data as { sent?: number; skipped?: number; errors?: number; remaining?: number; message?: string };
    if (!result.sent && result.errors) {
      showAlert("Emails not sent", "Email sending isn't set up yet. Push notifications still work.");
      return;
    }
    if (!result.sent && !result.skipped) {
      showAlert("Nobody to email", `Everyone has visited in the last ${days} days.`);
      return;
    }
    showAlert(
      "Emails sent",
      `${result.sent ?? 0} sent with a comeback code.` +
        (result.skipped ? ` ${result.skipped} already had one this month.` : "") +
        (result.remaining ? ` ${result.remaining} more are waiting: tap Send now again to email them.` : ""),
    );
  }
  return (
    <View>
      <Text style={styles.pageTitle}>Bring them back</Text>
      <Text style={styles.pageIntro}>See who has gone quiet, then send them a push notification or an email.</Text>
      {members === null ? (
        <WhirlSpinner size={28} style={{ marginTop: 30 }} />
      ) : (
        <>
          <Text style={styles.fieldLabel}>
            {list.length} customers · {list.length - quiet.length} back this month · {quiet.length} gone quiet
          </Text>
          <Text style={[styles.fieldLabel, { marginTop: 18 }]}>Haven't been back in a while</Text>
          {quiet.length ? (
            quiet.slice(0, 6).map((m) => (
              <View key={m.user_id} style={styles.memberCard}>
                <Text style={[styles.memberName, { flex: 1 }]}>{nameOf(m)}</Text>
                <Text style={styles.memberMeta}>last seen {ago(m)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.pageIntro}>Everyone has visited in the last {days} days.</Text>
          )}
        </>
      )}
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Send a message</Text>
        <View style={{ flexDirection: "row", gap: 8, marginVertical: 10 }}>
          {([["all", "Everyone"], ["inactive_30", "Gone quiet"], ["regulars", "Regulars"]] as const).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => setAudience(value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: audience === value }}
              accessibilityLabel={`Send to ${label.toLowerCase()}`}
              style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderRadius: 999, backgroundColor: audience === value ? colors.primary : schemeColor("#EFE9DF", 'bg') }}
            >
              <Text style={{ fontWeight: "700", fontSize: 13, color: audience === value ? schemeColor("#fff", 'fg') : schemeColor("#6F6B64", 'fg') }}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} maxLength={120} placeholder="We miss you" placeholderTextColor={colors.muted} />
        <TextInput
          style={[styles.input, { height: 96, textAlignVertical: "top", marginTop: 10 }]}
          value={body}
          onChangeText={setBody}
          maxLength={1000}
          multiline
          placeholder="Come in this week and we'll have something waiting."
          placeholderTextColor={colors.muted}
        />
        <Button title={sending ? "Sending…" : "Send push notification"} onPress={() => void send()} />
      </View>
      {"winback_auto_enabled" in business ? (
        <AutoWinbackSection business={business} days={days} onBusinessChanged={onBusinessChanged} />
      ) : null}
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Email customers who've gone quiet</Text>
        <Text style={[styles.pageIntro, { marginTop: 6 }]}>
          Send now to everyone who hasn't visited in {days} days, with a comeback code. Nobody gets more than one a month.
        </Text>
        <Button title={emailing ? "Sending…" : "Send win-back emails now"} disabled={emailing} onPress={() => void emailQuiet()} />
      </View>
    </View>
  );
}

// Automatic win-back (businesses.winback_auto_enabled / winback_threshold_days): a daily
// job emails customers as they go quiet, at about 10am UK time. Same rules as the website.
function AutoWinbackSection({
  business,
  days,
  onBusinessChanged,
}: {
  business: Business;
  days: number;
  onBusinessChanged: () => Promise<void> | void;
}) {
  const on = business.winback_auto_enabled !== false;
  const [shown, setShown] = useState(on);
  const [draft, setDraft] = useState(String(days));
  const [busy, setBusy] = useState(false);
  const [nextRun, setNextRun] = useState<{ would_send: number; waiting: number } | null>(null);
  const [lastRun, setLastRun] = useState<{ run_on: string; sent: number; failed: number; waiting: number } | null>(null);
  useEffect(() => setShown(on), [on]);
  useEffect(() => setDraft(String(days)), [days]);
  useEffect(() => {
    let live = true;
    // Counts only; nothing is sent. preview_for, never business_id: the older function
    // ignored dry_run and would have sent, but rejects a body without business_id.
    supabase.functions
      .invoke("send-winback-emails", { body: { preview_for: business.id } })
      .then(({ data }) => {
        const auto = (data as { automatic?: { would_send: number; waiting: number } } | null)?.automatic;
        if (live) setNextRun(auto ?? null);
      });
    supabase
      .from("winback_auto_runs")
      .select("run_on, sent, failed, waiting")
      .eq("business_id", business.id)
      .order("run_on", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (live) setLastRun(data ?? null);
      });
    return () => {
      live = false;
    };
  }, [business.id, days, on]);

  async function save(patch: { winback_auto_enabled?: boolean; winback_threshold_days?: number }) {
    setBusy(true);
    const { error } = await supabase.from("businesses").update(patch).eq("id", business.id);
    setBusy(false);
    if (error) {
      setShown(on);
      setDraft(String(days));
      return showAlert("Could not save", "Your change wasn't saved. Check the connection and try again.");
    }
    await onBusinessChanged();
    if (patch.winback_auto_enabled === false) {
      showAlert("Automatic emails off", "Nobody gets a win-back email unless you tap Send now.");
    } else if (patch.winback_auto_enabled === true) {
      showAlert("Automatic emails on", "The next ones go out at about 10am.");
    } else {
      showAlert("Saved", `Customers now count as gone quiet after ${patch.winback_threshold_days} days.`);
    }
  }

  function saveDays() {
    const value = Number(draft);
    if (!Number.isInteger(value) || value < 7 || value > 365) {
      return showAlert("Check the days", "Enter a whole number of days from 7 to 365.");
    }
    void save({ winback_threshold_days: value });
  }

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const lastRunText = lastRun
    ? `Last morning run, ${new Date(lastRun.run_on + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}: ` +
      (lastRun.sent ? `${plural(lastRun.sent, "email")} sent` : "nobody was due") +
      (lastRun.failed ? `, ${lastRun.failed} didn't go through (tried again next morning)` : "") +
      (lastRun.waiting ? `, ${lastRun.waiting} kept for the next mornings` : "") +
      "."
    : null;

  return (
    <View style={[styles.card, { backgroundColor: schemeColor("#DCEBD9", "bg") }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={[styles.fieldLabel, { flex: 1, fontSize: 15, marginTop: 0, marginBottom: 0 }]}>Automatic win-back emails</Text>
        <AppSwitch
          value={shown}
          disabled={busy}
          accessibilityLabel="Automatic win-back emails"
          onValueChange={(next) => {
            setShown(next);
            void save({ winback_auto_enabled: next });
          }}
        />
      </View>
      {shown ? (
        <>
          <Text style={[styles.memberMeta, { fontSize: 14, lineHeight: 20, marginTop: 0 }]}>
            Every morning at about 10am (UK time) customers who haven't visited for {days} days get an email with a one-use comeback
            code, valid for 30 days. One each time they go quiet, never to anyone who turned off offers. Up to 50 a day.
          </Text>
          <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>Counts as gone quiet after (days)</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TextInput
              style={[styles.input, { width: 96 }]}
              value={draft}
              onChangeText={(value) => setDraft(value.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              maxLength={3}
              accessibilityLabel="Days before a customer counts as gone quiet"
            />
            {draft !== String(days) ? (
              <View style={{ flex: 1 }}>
                <Button title={busy ? "Saving…" : "Save"} disabled={busy} onPress={saveDays} />
              </View>
            ) : null}
          </View>
          {nextRun ? (
            <Text style={[styles.memberMeta, { fontSize: 14, fontWeight: "700", marginTop: 0 }]}>
              {nextRun.would_send
                ? `Next run: ${plural(nextRun.would_send, "customer")} due an email` + (nextRun.waiting ? `, ${nextRun.waiting} more on the mornings after.` : ".")
                : "Next run: nobody is due an email yet."}
            </Text>
          ) : null}
          {lastRunText ? <Text style={[styles.memberMeta, { fontSize: 13, marginTop: 0 }]}>{lastRunText}</Text> : null}
        </>
      ) : (
        <Text style={[styles.memberMeta, { fontSize: 14, lineHeight: 20, marginTop: 0 }]}>
          Off. Nobody gets a win-back email unless you tap Send now below.
        </Text>
      )}
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
        if (error) showAlert("Could not load customers", "We couldn't reach our servers. Check your connection, then open this page again.");
        setMembers((data || []) as MemberRow[]);
        setLoading(false);
      });
  }, [business.id]);
  const searchTerm = useDebouncedValue(search);
  // Typo-tolerant, accent-insensitive; "Smith John" finds John Smith.
  const shown = fuzzyFilter(members, searchTerm, (member) => [
    `${member.first_name || ""} ${member.last_name || ""}`,
  ]);
  return (
    <View>
      <Text style={styles.pageTitle}>Customers</Text>
      <Text style={styles.pageIntro}>
        Everyone collecting rewards at {business.name}.
      </Text>
      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholder="Search customers"
        placeholderTextColor={colors.muted}
      />
      {loading ? (
        <WhirlSpinner size={28} style={{ marginTop: 30 }} />
      ) : shown.length ? (
        shown.map((member) => {
          const name =
            [member.first_name, member.last_name].filter(Boolean).join(" ") ||
            "Customer";
          // Points and custom shops show the wallet; other spend shops the £ spent;
          // stamp shops their stamps, points or visits (packages/loyalty).
          const wallet = hasPointsWallet(business);
          const spendShop = recordsSpend(business);
          const progress = wallet
            ? member.points_balance
            : spendShop
              ? poundsWhole(Math.max(0, member.reward_progress_pence ?? 0))
              : business.loyalty_type === "points"
                ? member.points_balance
                : business.loyalty_type === "tiered"
                  ? member.visit_count
                  : member.stamp_count;
          return (
            <View key={member.user_id} style={styles.memberCard}>
              <View
                style={[
                  styles.memberAvatar,
                  { backgroundColor: business.brand_color || colors.primary },
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
                  {wallet
                    ? unitNames(business).many
                    : spendShop
                      ? "spent"
                      : rewardWords(business.loyalty_type).units}
                </Text>
              </View>
            </View>
          );
        })
      ) : (
        <WhirlEmpty pose="sleepy" show={!searchTerm.trim()}>
          <Text style={styles.emptyState}>
            {searchTerm.trim()
              ? `No customers match "${searchTerm.trim()}". Check the spelling or try just a first name.`
              : "No customers yet. They appear here once they join your shop."}
          </Text>
        </WhirlEmpty>
      )}
    </View>
  );
}

function FoldSection({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [styles.accordionHeader, pressed && styles.pressed]}
      >
        <Text style={styles.accordionTitle}>{title}</Text>
        <ChevronRight size={18} color={schemeColor("#59615A", 'fg')} style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }} />
      </Pressable>
      {open ? children : null}
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
  // Back steps out of Detailed to the simple view (Android).
  useBackStep(detailed, () => setDetailed(false));
  const activity = recordsSpend(business) ? "purchases" : rewardWords(business.loyalty_type).units;
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
        .in("type", ["stamp", "spend"])
        .is("voided_at", null)
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
        <Text style={styles.pageTitle}>Analytics</Text>
        {modeSwitch}
        <NativeOwnerPageView
          page="ai"
          business={business}
          userId={userId}
          onBack={() => setDetailed(false)}
          onBusinessChanged={onBusinessChanged}
          onNavigate={() => setDetailed(false)}
          preview={preview}
        />
      </View>
    );
  }
  return (
    <View>
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
      <Text style={styles.sectionCaption}>Last {period} days</Text>
      <View style={styles.analyticsGrid}>
        <StatTile icon="+" value={periodStats.members} label="New customers" />
        <StatTile icon="♟" value={periodStats.stamps} label="Activity" />
        <StatTile icon="◇" value={periodStats.rewards} label="Rewards" />
      </View>
      <View style={styles.insightCard}>
        <Text style={styles.insightLabel}>Quick read</Text>
        <Text style={styles.insightTitle}>
          {periodStats.members > 0
            ? "More customers are joining."
            : "Focus on getting the next customer to join."}
        </Text>
        <Text style={styles.insightCopy}>
          {periodStats.stamps > 0
            ? `${periodStats.stamps} ${activity} were recorded in this period. Keep your QR poster where customers pay.`
            : "No loyalty activity is recorded for this period yet. Try placing your QR poster beside the payment point."}
        </Text>
      </View>
      <FoldSection title={`Charts for the last ${period} days`}>
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>{capitalise(activity)} and visitors</Text>
        <MiniLineChart
          data={dailySeries}
          aKey="stamps"
          bKey="visits"
          aLabel={capitalise(activity)}
          bLabel="Visitors"
          aColor={colors.primary}
          bColor={colors.accent}
        />
      </View>
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>New and returning customers</Text>
        <MiniLineChart
          data={dailySeries}
          aKey="newCustomers"
          bKey="oldCustomers"
          aLabel="New"
          bLabel="Returning"
          aColor={schemeColor("#3FA34D", 'fg')}
          bColor={schemeColor("#1A2138", 'fg')}
        />
      </View>
      </FoldSection>
      <View style={styles.totalCard}>
        <Text style={styles.totalTitle}>All-time picture</Text>
        <Text style={styles.totalLine}>
          {totals.members} customers · {totals.stamps} {activity} · {totals.redeemed}{" "}
          rewards used
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
        if (error) showAlert("Could not load news", "We couldn't reach our servers. Check your connection, then open News again.");
        setItems((data || []) as Announcement[]);
      });
  useEffect(() => {
    load();
  }, [business.id]);
  const publish = async () => {
    if (!title.trim())
      return showAlert(
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
    if (error) return showAlert("Could not publish", "Your news wasn't published. Check the connection and try again.");
    setTitle("");
    setBody("");
    load();
    showAlert(
      "Published",
      "Customers can now see this announcement in News.",
    );
  };
  const toggle = async (item: Announcement) => {
    const { error } = await supabase
      .from("announcements")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    if (error) return showAlert("Could not update", "Nothing changed. Check the connection and try again.");
    load();
  };
  return (
    <View>
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
          placeholderTextColor={colors.muted}
          maxLength={120}
        />
        <TextInput
          style={[styles.settingsInput, styles.textArea]}
          value={body}
          onChangeText={setBody}
          placeholder="What would you like customers to know?"
          placeholderTextColor={colors.muted}
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
                    {item.is_active ? "Live" : "Hidden"}
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
        <WhirlEmpty pose="sleepy">
          <Text style={styles.emptyState}>
            No announcements yet. Your first one can be ready in seconds.
          </Text>
        </WhirlEmpty>
      )}
    </View>
  );
}

// Amounts are stored in minor units (pence, paisa). Whole amounts show without decimals.
function poundsWhole(pence: number): string {
  return money(pence).replace(/\.00$/, "");
}

// Parses what an owner typed ("20", "£20", "Rs 2,000") into minor units, or null.
function parsePoundsToPence(value: string): number | null {
  const cleaned = value.replace(/£|rs|[,\s]/gi, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const pence = Math.round(Number(cleaned) * 100);
  return pence >= 100 && pence <= scaledLimit(1_000_000) ? pence : null;
}

// Still used by the Shop settings screens (not by onboarding any more).
const LOYALTY_TYPE_OPTIONS: {
  type: NonNullable<Business["loyalty_type"]>;
  icon: typeof Stamp;
  title: string;
  blurb: string;
  unit: string;
}[] = [
  { type: "stamp_card", icon: Stamp, title: "Stamps", blurb: "A stamp for every visit or purchase.", unit: "stamps" },
  { type: "points", icon: Star, title: "Points", blurb: "Points for spend or specific actions.", unit: "points" },
  { type: "tiered", icon: BadgeCheck, title: "Visits", blurb: "Count how many times they visit.", unit: "visits" },
];

function Dashboard({
  session,
  preview = false,
  canCreateBusiness = false,
}: {
  session: Session;
  preview?: boolean;
  canCreateBusiness?: boolean;
}) {
  const { isDark } = useTheme();
  // Last good snapshot saved on this phone (per user, 7 days, wiped on sign-out):
  // the dashboard paints from it at once and refreshes quietly behind it.
  const [snap] = useState(() => {
    if (preview) return null;
    const uid = session.user.id;
    const saved = readLaunchCache<{ shops: Business[]; ownedIds: string[] }>("shops", uid)?.data;
    if (!saved?.shops?.length) return null;
    const first = saved.shops[0];
    const stats = readLaunchCache<{ shopId: string; stats: DashboardStats }>("stats", uid)?.data;
    const configured = readLaunchCache<{ ids: string[] }>("configured", uid)?.data?.ids ?? [];
    return { shops: saved.shops, ownedIds: saved.ownedIds ?? [], first, stats: stats?.shopId === first.id ? stats.stats : null, configured };
  });
  const [shops, setShops] = useState<Business[]>(
      preview ? [PREVIEW_BUSINESS] : snap?.shops ?? [],
    ),
    [selected, setSelected] = useState<Business | null>(
      preview ? PREVIEW_BUSINESS : snap?.first ?? null,
    ),
    _country = setActiveCountry(selected?.country_code),
    [tab, setTab] = useState<
      "home" | "scan" | "members" | "customers" | "analytics" | "news" | "settings"
    >("home"),
    [ownerPage, setOwnerPage] = useState<NativeOwnerPage | null>(null),
    [stampsMode, setStampsMode] = useState<"stamps" | "reward">("stamps"),
    [widgetRefreshKey, setWidgetRefreshKey] = useState(0),
    [stats, setStats] = useState<DashboardStats>(
      preview
        ? PREVIEW_STATS
        : snap?.stats ?? {
            members: 0,
            stamps: 0,
            rewards: 0,
            redeemed: 0,
            reviews: 0,
            activeMembers: 0,
            dormantMembers: 0,
          },
    ),
    [loading, setLoading] = useState(!preview && !snap);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(() => new Set(snap?.ownedIds ?? []));
  // Shops already known to have a programme: skip the full-screen check for them.
  const configuredShops = useRef<Set<string>>(new Set(snap?.configured ?? []));
  const [needsLoyaltySetup, setNeedsLoyaltySetup] = useState<boolean | null>(
    snap && snap.configured.includes(snap.first.id) ? false : null,
  );
  const [platformNotices, setPlatformNotices] = useState<{ id: string; title: string; body: string | null }[]>([]);
  const serviceStatus = useServiceStatus("business");
  const [dismissedNoticeIds, setDismissedNoticeIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (preview) return;
    const targetColumn = Platform.OS === "ios" ? "target_retailer_ios" : "target_retailer_android";
    void supabase
      .from("platform_announcements")
      .select("id,title,body")
      .eq("is_active", true)
      .eq(targetColumn, true)
      .order("created_at", { ascending: false })
      .then(({ data }) => setPlatformNotices(data || []));
  }, [preview]);
  const navigateOnboarding = (destination: NativeOnboardingDestination) => {
    setOwnerPage(null);
    if (destination === "branding" || destination === "rewards" || destination === "poster") {
      setOwnerPage(destination);
      return;
    }
    if (destination === "settings" || destination === "scan" || destination === "analytics" || destination === "news") {
      setTab(destination);
    }
  };
  // After the "You're live" screen: reload the shop list, then go where the owner chose.
  const finishOnboarding = (destination: OnboardingDestination) => {
    setNeedsLoyaltySetup(false);
    void load(true);
    if (destination === "scan") setTab("scan");
    if (destination === "tools") setOwnerPage("poster");
  };
  useEffect(() => { if (!preview) void trackUsageEvent(session.user.id, 'tab_viewed', tab); }, [preview, session.user.id, tab]);
  async function load(silent = false) {
    if (preview) return;
    if (!silent) setLoading(true);
    const ticket = launchCacheTicket();
    try {
      if (simulatedOutage()) throw new Error("Simulated outage");
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
      setOwnedIds(new Set((owned || []).map((b) => b.id)));
      setSelected((current) =>
        current
          ? all.find((s) => s.id === current.id) || all[0] || null
          : all[0] || null,
      );
      // Saved on the phone so the app still opens on your shop during an outage.
      writeLaunchCache("shops", session.user.id, { shops: all, ownedIds: (owned || []).map((b) => b.id) }, ticket);
      if (serviceStatus.level !== "ok") serviceStatus.recheck();
    } catch (e) {
      serviceStatus.recheck();
      const saved = readLaunchCache<{ shops: Business[]; ownedIds: string[] }>("shops", session.user.id)?.data ?? null;
      if (saved?.shops?.length) {
        setShops((current) => (current.length ? current : saved!.shops));
        setOwnedIds((current) => (current.size ? current : new Set(saved!.ownedIds)));
        setSelected((current) => current ?? saved!.shops[0] ?? null);
      } else {
        showAlert(
          "Could not load business",
          "We couldn’t reach our servers. Check the banner at the top and try again in a moment.",
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }
  useEffect(() => {
    if (!preview) load(Boolean(snap));
  }, [preview]);
  // Stamps saved on this phone without signal: send them when the app opens,
  // comes back to the front, the connection returns, or (with backoff) on a timer.
  const staffId = preview ? "" : session.user.id;
  const offline = !preview && serviceStatus.level === "offline";
  const waitingHere = useWaitingStamps(staffId, selected?.id);
  const sendWaiting = useCallback(async (force: boolean, manual = false) => {
    if (!staffId) return;
    const report = await sendWaitingStamps(staffId, force);
    if (report.sent.length) setWidgetRefreshKey((key) => key + 1);
    const words = rewardWords(selected?.loyalty_type);
    const problem = describeWaitingProblems(report, words);
    if (problem) {
      haptic.warning();
      showAlert(problem.title, problem.message);
    } else if (manual && report.stillOffline) {
      showAlert("Still no connection", `Your ${words.units} are safe on this phone. They'll send by themselves when you're back online.`);
    }
  }, [staffId, selected?.loyalty_type]);
  useEffect(() => {
    if (!staffId) return;
    void sendWaiting(true);
    const timer = setInterval(() => void sendWaiting(false), 20_000);
    const foreground = AppState.addEventListener("change", (state) => {
      if (state === "active") void sendWaiting(true);
    });
    return () => {
      clearInterval(timer);
      foreground.remove();
    };
  }, [staffId, sendWaiting]);
  // When our servers come back, reload quietly and send anything waiting.
  const wasDown = useRef(false);
  useEffect(() => {
    if (serviceStatus.level !== "ok") wasDown.current = true;
    else if (wasDown.current && serviceStatus.checkedAt) {
      wasDown.current = false;
      if (!preview) {
        void load(true);
        void sendWaiting(true);
      }
    }
  }, [serviceStatus.level, serviceStatus.checkedAt]);
  // Force the first-run loyalty programme wizard for an owner (never staff)
  // whose shop has no reward defined yet — see LoyaltyProgramSetup above.
  const selectedId = selected?.id ?? null;
  const selectedRewardModel = selected?.reward_model;
  const selectedIsOwned = selectedId ? ownedIds.has(selectedId) : false;
  useEffect(() => {
    // A custom (AI-designed) programme is complete from creation: its rules hold everything.
    if (preview || !selectedId || !selectedIsOwned || selectedRewardModel === "custom") {
      setNeedsLoyaltySetup(false);
      return;
    }
    let active = true;
    const ticket = launchCacheTicket();
    // A shop already known to be set up is re-checked quietly (no spinner); only an unknown one waits.
    setNeedsLoyaltySetup(configuredShops.current.has(selectedId) ? false : null);
    // Setup is done once the shop has rewards (stamps, £ spend, points) or
    // membership levels (tiers). A missing tiers table (migration not applied
    // yet) counts as "no tiers".
    void Promise.all([
      supabase.from("reward_catalog").select("id").eq("business_id", selectedId).limit(1),
      supabase.from("membership_tiers").select("id").eq("business_id", selectedId).limit(1),
    ]).then(([rewards, tiers]) => {
      if (!active) return;
      const hasTiers = !tiers.error && (tiers.data || []).length > 0;
      const needs = !rewards.error && (rewards.data || []).length === 0 && !hasTiers;
      setNeedsLoyaltySetup(needs);
      if (!needs && !rewards.error) {
        configuredShops.current.add(selectedId);
        writeLaunchCache("configured", session.user.id, { ids: [...configuredShops.current] }, ticket);
      } else if (needs) configuredShops.current.delete(selectedId);
    });
    return () => {
      active = false;
    };
  }, [preview, selectedId, selectedIsOwned, selectedRewardModel]);
  useEffect(() => {
    if (preview || !selected) return;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    let active = true;
    const ticket = launchCacheTicket();
    Promise.all([
      supabase
        .from("memberships")
        .select("id", { count: "exact", head: true })
        .eq("business_id", selected.id),
      supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("business_id", selected.id)
        .in("type", ["stamp", "spend"])
        .is("voided_at", null),
      supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("business_id", selected.id)
        .gte("created_at", startOfToday.toISOString()),
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
      supabase
        .from("transactions")
        .select("created_at")
        .eq("business_id", selected.id)
        .in("type", ["stamp", "spend"])
        .is("voided_at", null)
        .gte("created_at", new Date(startOfToday.getTime() - 6 * 86400000).toISOString())
        .limit(5000),
    ]).then(([members, stamps, todayActions, rewards, redeemed, reviews, memberRows, weekRows]) => {
      if (!active) return;
      const week = [0, 0, 0, 0, 0, 0, 0];
      ((weekRows.data || []) as { created_at: string }[]).forEach((row) => {
        const day = new Date(row.created_at);
        day.setHours(0, 0, 0, 0);
        const back = Math.round((startOfToday.getTime() - day.getTime()) / 86400000);
        if (back >= 0 && back < 7) week[6 - back]++;
      });
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
      const nextStats = {
        members: members.count || 0,
        stamps: stamps.count || 0,
        rewards: rewards.count || 0,
        redeemed: redeemed.count || 0,
        reviews: reviews.count || 0,
        activeMembers,
        dormantMembers,
        week: weekRows.error ? undefined : week,
      };
      setStats(nextStats);
      // Saved only from a clean, fresh answer, so a failed request never overwrites good numbers.
      if (![members, stamps, rewards, redeemed, reviews, memberRows].some((r) => r.error)) {
        writeLaunchCache("stats", session.user.id, { shopId: selected.id, stats: nextStats }, ticket);
      }
      void syncRetailerWidget({
        businessName: selected.name,
        todayActions: todayActions.count || 0,
        members: nextStats.members,
        updatedAt: new Date().toISOString(),
        brandColor: selected.brand_color || "",
        logoUrl: selected.logo_url || "",
      }).catch(() => undefined);
    });
    return () => {
      active = false;
    };
  }, [selected?.id, loading, widgetRefreshKey]);
  useEffect(() => {
    const openWidgetDestination = ({ url }: { url: string }) => {
      if (url.includes("widget/scan")) {
        setOwnerPage(null);
        setStampsMode("stamps");
        setTab("scan");
      }
    };
    void Linking.getInitialURL().then((url) => { if (url) openWidgetDestination({ url }); });
    const subscription = Linking.addEventListener("url", openWidgetDestination);
    return () => subscription.remove();
  }, []);
  // Four tabs: Home, Analytics, Scan, Shop. Analytics groups insights, the
  // customer lists and news posts as sub-tabs.
  const ANALYTICS_TABS = ["analytics", "customers", "members", "news"] as const;
  const ANALYTICS_SUBTABS = [
    { id: "analytics", label: "Insights" },
    { id: "customers", label: "Win back" },
    { id: "members", label: "Customers" },
    { id: "news", label: "News" },
  ] as const;
  const inAnalytics = (ANALYTICS_TABS as readonly string[]).includes(tab);
  const nav = [
    { id: "home", icon: LayoutDashboard, label: "Home", active: tab === "home" },
    { id: "analytics", icon: ChartNoAxesCombined, label: "Analytics", active: inAnalytics },
    { id: "scan", icon: Stamp, label: "Scan", active: tab === "scan" },
    { id: "settings", icon: Store, label: "Shop", active: tab === "settings" },
  ] as const;
  // Android back: an owner page closes first, then any tab returns to Home,
  // and on Home back leaves the app as usual (src/back-steps.ts).
  useBackStep(tab !== "home", () => { setOwnerPage(null); setTab("home"); });
  useBackStep(ownerPage !== null, () => setOwnerPage(null));
  if (!loading && shops.length) clearPendingShop();
  if (!loading && !shops.length && canCreateBusiness) {
    return <ShopOnboarding ownerId={session.user.id} onFinish={finishOnboarding} />;
  }
  if (!loading && selected && ownedIds.has(selected.id) && needsLoyaltySetup === null) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}>
          <WhirlSpinner size={40} />
        </View>
      </SafeAreaView>
    );
  }
  if (!loading && selected && needsLoyaltySetup) {
    return (
      <ShopOnboarding ownerId={session.user.id} resume={selected} onFinish={finishOnboarding} />
    );
  }
  return (
    <TourProvider
      businessId={selected?.id ?? null}
      enabled={!!selected && !preview && ownedIds.has(selected.id) && needsLoyaltySetup === false}
      screen={ownerPage ? null : tab === "home" || tab === "scan" || tab === "settings" ? (tab === "settings" ? "settings" : tab) : null}
      programme={programmeIdFor(selected ?? {})}
      onRestart={() => { setOwnerPage(null); setTab("home"); }}
    >
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={statusBarStyle(isDark)} />
      {!preview && <OutageBanner status={serviceStatus} />}
      {platformNotices.filter((notice) => !dismissedNoticeIds.has(notice.id)).map((notice) => (
        <View key={notice.id} style={styles.platformBanner}>
          <Text style={styles.platformBannerText}>
            {notice.title}
            {notice.body ? <Text style={styles.platformBannerBody}>: {notice.body}</Text> : null}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss this notice"
            onPress={() => setDismissedNoticeIds((prev) => new Set(prev).add(notice.id))}
            style={styles.platformBannerClose}
          >
            <X size={18} color={schemeColor("#fff", 'fg')} />
          </Pressable>
        </View>
      ))}
      <KeyboardAwareScrollView
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
          <SkeletonScreen cards={4} cardHeight={96} label="Loading your shop" />
        ) : (
          selected &&
          (ownerPage ? (
            <NativeOwnerPageView
              page={ownerPage}
              business={selected}
              userId={session.user.id || "preview-user"}
              onBack={() => setOwnerPage(null)}
              onBusinessChanged={load}
              onNavigate={navigateOnboarding}
              preview={preview}
            />
          ) : (
            <>
              {inAnalytics && (
                <View accessibilityRole="tablist" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                  {ANALYTICS_SUBTABS.map((sub) => (
                    <Pressable
                      key={sub.id}
                      onPress={() => setTab(sub.id)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: tab === sub.id }}
                      style={{
                        minHeight: 44,
                        justifyContent: "center",
                        paddingHorizontal: 14,
                        borderRadius: 999,
                        backgroundColor: tab === sub.id ? colors.primary : schemeColor("#EFE9DF", 'bg'),
                      }}
                    >
                      <Text style={{ fontWeight: "700", fontSize: 13, color: tab === sub.id ? schemeColor("#fff", 'fg') : schemeColor("#6F6B64", 'fg') }}>{sub.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {tab === "home" && selected.approval_status === "pending" && ownedIds.has(selected.id) ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setOwnerPage("verify")}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    padding: 14,
                    borderRadius: 18,
                    marginBottom: 14,
                    backgroundColor: schemeColor("#FFF4E0", 'bg'),
                    borderWidth: 1.5,
                    borderColor: schemeColor("#E8B866", 'border'),
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "900", fontSize: 15, color: schemeColor("#1A2138", 'fg') }}>Your shop is hidden from customers</Text>
                    <Text style={{ fontSize: 13, color: schemeColor("#4A4A4A", 'fg'), marginTop: 2 }}>
                      {selected.verification_status === "pending" ? "We're checking your document." : "Verify your business to put it live. It takes a few minutes."}
                    </Text>
                  </View>
                  <ChevronRight size={20} color={schemeColor("#1A2138", 'fg')} />
                </Pressable>
              ) : null}
              {tab === "home" && (
                <DashboardHome
                  business={selected}
                  stats={stats}
                  waiting={waitingHere}
                  offline={offline}
                  onSendWaiting={() => void sendWaiting(true, true)}
                  onIssueStamp={() => {
                    void trackUsageEvent(session.user.id, 'scan_started', 'award');
                    setStampsMode("stamps");
                    setTab("scan");
                  }}
                  onRedeemReward={() => {
                    void trackUsageEvent(session.user.id, 'scan_started', 'redeem');
                    setStampsMode("reward");
                    setTab("scan");
                  }}
                  onReport={() => setOwnerPage("ai")}
                  onOpenGuide={() => setOwnerPage("tutorial")}
                  onWinBack={() => setTab("customers")}
                />
              )}{" "}
              {tab === "customers" && <CustomersHome business={selected} onBusinessChanged={() => load(true)} />}{" "}
              {tab === "scan" && (
                <StampsScreen
                  business={selected}
                  staffId={staffId}
                  offline={offline}
                  onSendWaiting={() => void sendWaiting(true, true)}
                  mode={stampsMode}
                  onModeChange={setStampsMode}
                  onDone={() => { void load(true); setWidgetRefreshKey((key) => key + 1); }}
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
                  isOwner={ownedIds.has(selected.id)}
                  onChanged={load}
                  onOpenPage={setOwnerPage}
                />
              )}
            </>
          ))
        )}
      </KeyboardAwareScrollView>
      <View style={styles.tabs} accessibilityRole="tablist">
        {nav.map(({ id, icon: Icon, label, active }) => (
          <TourTarget key={id} id={`tab-${id === "settings" ? "shop" : id}`} style={{ flex: active ? 1.7 : 1 }}>
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [styles.tab, active && styles.tabActivePill, pressed && styles.tabPressed]}
            onPress={() => {
              setOwnerPage(null);
              setTab(id);
            }}
          >
            {active && <Icon size={20} strokeWidth={2.3} color={schemeColor("#fff", 'fg')} />}
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.tabText, active && styles.tabActive]}>
              {label}
            </Text>
          </Pressable>
          </TourTarget>
        ))}
      </View>
      <TourOverlay />
    </SafeAreaView>
    </TourProvider>
  );
}

export default function App() {
  // Brand display font. Rendering does not wait for it: titles fall back to the
  // system font for a frame on first launch, then switch once loaded.
  useFonts({ ...CARD_FONTS, BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, InstrumentSerif_400Regular_Italic });
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppWhirlProvider>
            <AppRoot />
            <AppAlertHost />
            <AppIntro />
          </AppWhirlProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Sign-out: forget every locally saved snapshot (launch cache and the old outage copies). */
function clearAllLaunchData(userId: string | null) {
  clearLaunchCache();
  if (userId) {
    try {
      Storage.removeItemSync(`loyalty-loop:business-shops:v1:${userId}`);
      Storage.removeItemSync(`loyalty-loop:business-roles:v1:${userId}`);
    } catch {}
  }
}

function AppRoot() {
  const { isDark } = useTheme(); // re-renders the whole app when the scheme changes
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
    // Verdict from the server this launch; until it arrives the last verified
    // verdict (saved on this phone, per user) is used so the app opens at once.
    [verdict, setVerdict] = useState<{ uid: string; ok: boolean; isOwner: boolean } | null>(null),
    [showAuth, setShowAuth] = useState(false),
    [locked, setLocked] = useState(false),
    [checkingLock, setCheckingLock] = useState(false),
    // The biometric check has run for this user (local, so quick). Until then
    // the app stays hidden so cached data never flashes before the lock.
    [lockCheckedFor, setLockCheckedFor] = useState<string | null>(null);
  const checkingUpdate = useLaunchUpdate();
  const lastUserId = useRef<string | null>(null);
  const optimisticToken = useRef<string | null>(null);
  const uid = session?.user.id ?? null;
  if (uid) lastUserId.current = uid;
  useEffect(() => {
    let active = true;
    // 1. Show the app from the stored session without waiting for the network.
    void readStoredSession().then((stored) => {
      if (!active || !stored) return;
      optimisticToken.current = stored.access_token;
      setSession((current) => current ?? stored);
      setChecking(false);
    });
    // 2. Confirm in the background. getSession() may refresh an expired token.
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (data.session) {
        optimisticToken.current = null;
        setSession(data.session);
      } else if (!error || isSessionRejection(error)) {
        // Really signed out (or the server rejected it). Offline errors keep the stored session.
        setSession((current) => (!current || optimisticToken.current === current.access_token ? null : current));
        if (error) clearAllLaunchData(lastUserId.current);
      }
      setChecking(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "SIGNED_OUT") {
        clearAllLaunchData(lastUserId.current);
        setSession(null);
      } else if (next) {
        optimisticToken.current = null;
        setSession(next);
      }
      // INITIAL_SESSION with no session is ignored: a failed offline refresh must not undo the stored session.
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  const cachedVerdict = useMemo(
    () => {
      if (!uid) return null;
      const saved = readLaunchCache<{ ok: boolean; isOwner: boolean }>("role", uid)?.data;
      if (saved) return saved;
      // Roles saved by the previous version of the app (only ever written after a verified check).
      try {
        const legacy: string[] = JSON.parse(Storage.getItemSync(`loyalty-loop:business-roles:v1:${uid}`) || "[]");
        const ok = legacy.some((role) => ["admin", "brand_head", "business_owner", "staff"].includes(role));
        return ok ? { ok, isOwner: legacy.includes("business_owner") } : null;
      } catch {
        return null;
      }
    },
    [uid],
  );
  const current = uid ? (verdict?.uid === uid ? verdict : cachedVerdict) : null;
  const allowed = current?.ok === true;
  const isOwner = current?.isOwner === true;
  useEffect(() => {
    if (!uid) return;
    let active = true;
    const ticket = launchCacheTicket();
    (async () => {
      await supabase.rpc("ensure_current_user_bootstrap");
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      if (!active) return;
      if (error && isSessionRejection(error)) {
        // The server says this session is no good: sign out for real.
        await supabase.auth.signOut().catch(() => undefined);
        return;
      }
      if (error || !data) {
        // Couldn't reach us (outage or no signal): never sign people out for
        // that. Use the roles saved last time; the server still checks every action.
        setVerdict({ uid, ok: true, isOwner: cachedVerdict?.isOwner === true });
        return;
      }
      const roles = data.map((r: any) => r.role);
      const ok = roles.some((role: string) =>
        ["admin", "brand_head", "business_owner", "staff"].includes(role),
      );
      const owner = roles.includes("business_owner");
      setVerdict({ uid, ok, isOwner: owner });
      if (ok) writeLaunchCache("role", uid, { ok: true, isOwner: owner }, ticket);
      else {
        showAlert(
          "Use the shopper app",
          "This is a customer account. Please sign in to The Loyalty Loop shopper app.",
        );
        await supabase.auth.signOut();
      }
    })();
    return () => {
      active = false;
    };
  }, [uid]);
  async function checkAppLock() {
    if (!session) {
      setLocked(false);
      return;
    }
    const forUser = session.user.id;
    try {
      if (!(await biometricLockEnabled())) {
        setLocked(false);
        return;
      }
      setCheckingLock(true);
      setLocked(true);
      const success = await unlockWithBiometrics();
      setLocked(!success);
      setCheckingLock(false);
    } finally {
      setLockCheckedFor(forUser);
    }
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
    // Saves a token only if notifications are already allowed; otherwise a one-time friendly pop-up asks first.
    if (session) {
      void registerPushToken(session.user.id).catch(() => undefined);
      void offerPushPrompt(session.user.id);
    }
  }, [session?.user.id]);
  // Android back on the sign-in form returns to the shop set-up screen it came from.
  useBackStep(!session && showAuth, () => setShowAuth(false));
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
  if (checkingUpdate || checking || (session && (!allowed || checkingLock || lockCheckedFor !== session.user.id)))
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}>
          <WhirlSpinner size={40} />
        </View>
      </SafeAreaView>
    );
  if (session && locked)
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.lockScreen}>
          <WhirlOrMark pose="sleepy" mark={<View style={styles.mark}><Text style={styles.markText}>↻</Text></View>} />
          <Text style={styles.title}>App locked</Text>
          <Text style={styles.copy}>Use Face ID, Touch ID or your fingerprint to continue.</Text>
          <Button title="Unlock app" onPress={() => void checkAppLock()} />
        </View>
      </SafeAreaView>
    );
  // Open on the app, not a form: someone new starts setting up their shop and
  // is asked for an account only when there's a shop to save.
  return session ? (
    <Dashboard session={session} canCreateBusiness={isOwner} />
  ) : showAuth ? (
    <Auth onSession={setSession} onNewShop={() => setShowAuth(false)} />
  ) : (
    <ShopOnboarding ownerId={null} onSignIn={() => setShowAuth(true)} onFinish={() => undefined} />
  );
}

// Translucent white panels stay white in dark mode under schemeColor, under light text;
// in dark they use the card colour instead (light mode is unchanged).
const glass = (rgba: string) => (getActiveScheme() === "dark" ? colors.card : rgba);

const styles = themed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  platformBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10 },
  platformBannerText: { flex: 1, color: schemeColor("#fff", 'fg'), fontSize: 13, fontWeight: "700" },
  platformBannerBody: { fontWeight: "400", opacity: 0.9 },
  platformBannerClose: { width: 44, height: 44, marginVertical: -8, marginRight: -10, alignItems: "center", justifyContent: "center" },
  auth: { flexGrow: 1, padding: 28, justifyContent: "center" },
  screen: { padding: 22, paddingBottom: 112 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  onboarding: { flexGrow: 1, padding: 28, justifyContent: "center" },
  onboardingMark: { width: 64, height: 64, borderRadius: 32, backgroundColor: schemeColor('#1A2138', 'bg'), alignItems: "center", justifyContent: "center", marginBottom: 42 },
  onboardingTitle: { color: schemeColor('#1D1C1A', 'fg'), fontSize: 38, fontFamily: FONT_DISPLAY, lineHeight: 44, letterSpacing: -1.1 },
  onboardingDots: { flexDirection: "row", gap: 8, marginTop: 34, marginBottom: 36 },
  onboardingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: schemeColor("#DCD6CB", 'bg') },
  onboardingDotActive: { width: 26, backgroundColor: colors.primary },
  onboardingConsent: { marginTop: 26 },
  onboardingSkip: { alignItems: "center", padding: 16 },
  onboardingSkipText: { color: colors.foreground, fontSize: 15, fontWeight: "700", textAlign: "center" },
  lockScreen: { flex: 1, padding: 28, alignItems: "center", justifyContent: "center" },
  mark: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: schemeColor('#1A2138', 'bg'),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  markText: { color: schemeColor("#e4b666", 'fg'), fontSize: 34, fontFamily: FONT_DISPLAY },
  eyebrow: {
    color: colors.primaryText,
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 8,
  },
  hero: {
    color: colors.foreground,
    fontSize: 37,
    fontFamily: FONT_DISPLAY,
    lineHeight: 44,
    letterSpacing: -1,
  },
  title: {
    color: colors.foreground,
    fontSize: 30,
    fontFamily: FONT_DISPLAY,
    lineHeight: 36,
    letterSpacing: -0.7,
  },
  copy: { color: schemeColor("#000000", 'fg'), fontSize: 16, lineHeight: 24, marginTop: 9 },
  setupOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: schemeColor("#fff", 'bg'),
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: schemeColor("#eee0cc", 'border'),
    padding: 16,
  },
  setupOptionCardActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  setupOptionTitle: { color: colors.foreground, fontSize: 16, fontWeight: "800" },
  setupOptionTitleActive: { color: schemeColor("#fff", 'fg') },
  setupOptionBlurb: { color: schemeColor("#000000", 'fg'), fontSize: 13, marginTop: 2 },
  setupOptionBlurbActive: { color: schemeColor("rgba(255,255,255,0.85)", 'fg') },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: schemeColor("rgba(0,0,0,0.12)", 'border'),
    backgroundColor: schemeColor("#fff", 'bg'),
  },
  categoryChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryChipText: { color: colors.foreground, fontWeight: "800", fontSize: 13 },
  categoryChipTextActive: { color: schemeColor("#fff", 'fg') },
  small: {
    color: schemeColor("#000000", 'fg'),
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 22,
  },
  authHelpLink: { alignSelf: "center", marginTop: 6, minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  authHelpLinkText: { color: schemeColor("#000000", 'fg'), fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },
  card: {
    backgroundColor: schemeColor("#fff", 'bg'),
    borderRadius: 18,
    padding: 18,
    marginTop: 24,
    gap: 12,
    elevation: 2,
    shadowColor: "#2B3A67",
    shadowOpacity: 0.08,
    shadowRadius: 15,
  },
  input: {
    backgroundColor: schemeColor("#f4f1eb", 'bg'),
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: schemeColor("#243021", 'fg'),
    fontSize: 16,
  },
  customerCodeInput: { color: schemeColor("#1A2138", 'fg') },
  button: {
    backgroundColor: schemeColor('#1A2138', 'bg'),
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    flexGrow: 0,
    flexShrink: 0,
    padding: 15,
    marginTop: 3,
    borderWidth: 1,
    borderColor: schemeColor("rgba(255,255,255,0.72)", 'border'),
    shadowColor: colors.foreground,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.foreground,
  },
  buttonText: { color: schemeColor("#fff", 'fg'), fontWeight: "800", fontSize: 15, textAlign: "center" },
  secondaryText: { color: colors.foreground },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  shopPicker: { gap: 9, paddingTop: 18, paddingBottom: 5 },
  shopChip: {
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 21,
    backgroundColor: schemeColor("#fff", 'bg'),
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  chipLogo: { width: 22, height: 22, borderRadius: 11 },
  chipText: { color: colors.foreground, fontWeight: "800", fontSize: 13 },
  overview: { borderRadius: 21, padding: 22, marginTop: 24 },
  overviewLabel: {
    color: schemeColor("#e6ecdd", 'fg'),
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  overviewNumber: {
    color: schemeColor("#fff", 'fg'),
    fontSize: 48,
    fontFamily: FONT_DISPLAY,
    marginVertical: 9,
  },
  section: { fontSize: 19, fontWeight: "800", color: colors.foreground, marginTop: 8 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  match: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: schemeColor("#e7e3da", 'border'),
    paddingTop: 14,
  },
  matchTitle: { fontSize: 17, fontWeight: "800", color: colors.foreground },
  matchWho: { fontSize: 20, fontWeight: "800", color: colors.foreground, textAlign: "center", minHeight: 28, marginBottom: 10 },
  cameraSheet: { flex: 1 },
  spendBanner: { backgroundColor: schemeColor("#e0f2e4", 'bg'), borderRadius: 18, padding: 14, marginTop: 16 },
  spendBannerText: { color: schemeColor("#1f5c33", 'fg'), fontSize: 15, fontWeight: "800", textAlign: "center" },
  spendProgress: { color: schemeColor("#000000", 'fg'), fontSize: 15, fontWeight: "700", textAlign: "center", marginBottom: 6 },
  spendAmount: { fontSize: 46, fontFamily: FONT_DISPLAY, color: colors.foreground, textAlign: "center", marginTop: 4, fontVariant: ["tabular-nums"] },
  spendCap: { color: schemeColor("#000000", 'fg'), fontSize: 13, textAlign: "center", marginBottom: 12 },
  keypad: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10, marginBottom: 14 },
  keypadKey: { width: "31%", minHeight: 58, borderRadius: 18, backgroundColor: schemeColor("rgba(0,0,0,0.05)", 'bg'), alignItems: "center", justifyContent: "center" },
  keypadKeyText: { fontSize: 24, fontFamily: FONT_DISPLAY, color: colors.foreground },
  recentRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: schemeColor("rgba(0,0,0,0.12)", 'border') },
  recentAmount: { fontSize: 16, fontWeight: "800", color: colors.foreground, minWidth: 80, fontVariant: ["tabular-nums"] },
  recentTime: { flex: 1, color: schemeColor("#000000", 'fg'), fontSize: 14 },
  recentUndo: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  paySheet: { backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 12 },
  paySheetHandle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: schemeColor("rgba(0,0,0,0.18)", 'bg'), marginBottom: 16 },
  paySheetTitle: { fontSize: 21, fontFamily: FONT_DISPLAY, color: colors.foreground },
  paySheetCopy: { color: schemeColor("#000000", 'fg'), fontSize: 15.5, lineHeight: 22, marginTop: 8 },
  paySheetQuestion: { fontSize: 16, fontWeight: "800", color: colors.foreground, marginTop: 18 },
  paySheetButtons: { gap: 10, marginTop: 12 },
  paySheetNote: { color: schemeColor("#000000", 'fg'), fontSize: 13, textAlign: "center", marginTop: 12 },
  cameraWrap: { flex: 1, padding: 20, backgroundColor: schemeColor("#111", 'bg') },
  cameraTitle: {
    color: schemeColor("#fff", 'fg'),
    fontSize: 20,
    fontFamily: FONT_DISPLAY,
    marginBottom: 18,
  },
  camera: { flex: 1, borderRadius: 20, overflow: "hidden", marginBottom: 20 },
  statTile: {
    width: "31%",
    minHeight: 132,
    borderWidth: 2,
    borderColor: schemeColor("#2A2A2A", 'border'),
    borderRadius: 20,
    padding: 14,
    backgroundColor: schemeColor("rgba(255,255,255,.52)", 'bg'),
    justifyContent: "space-between",
    marginBottom: 12,
  },
  statIcon: { fontSize: 20, color: colors.primary, fontFamily: FONT_DISPLAY },
  statValue: {
    fontSize: 28,
    color: schemeColor("#171815", 'fg'),
    fontFamily: FONT_DISPLAY,
    marginTop: 12,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: schemeColor("#000000", 'fg'),
    fontWeight: "700",
  },
  homeHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: schemeColor("rgba(17,17,17,0.14)", 'border') },
  homeHeaderLogo: { width: 34, height: 34, borderRadius: 17 },
  homeHeaderLetter: { color: PAPER, fontSize: 14, fontWeight: "700" },
  homeHeaderName: { flex: 1, fontSize: 18, fontWeight: "800", color: colors.ink },
  // Coloured tiles with 2px dark borders (owner rule): sage panel, amber / sage / peach below.
  homePanel: { backgroundColor: colors.sage, borderWidth: 2, borderColor: schemeColor("#2A2A2A", 'border'), borderRadius: 28, padding: 24, paddingBottom: 54, gap: 6 },
  homePanelLabel: { color: colors.sageInk, fontSize: 15, fontWeight: "700" },
  homeBigRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 },
  homeBig: { color: colors.ink, fontFamily: SANS_HEAVY, fontSize: 104, lineHeight: 104, letterSpacing: -6, includeFontPadding: false, flexShrink: 1 },
  homeBadge: { height: 30, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderColor: colors.sageInk, justifyContent: "center" },
  homeBadgeText: { color: colors.sageInk, fontSize: 13, fontWeight: "700" },
  homeBigLabel: { color: colors.sageInk, fontSize: 16, fontWeight: "700" },
  homeBars: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 96, marginTop: 18 },
  homeBarCol: { flex: 1, alignItems: "center", gap: 6 },
  homeBar: { width: "100%", borderRadius: 4 },
  homeBarDay: { color: colors.sageInk, fontSize: 12, fontWeight: "600" },
  homeWeek: { color: colors.sageInk, fontSize: 14, fontWeight: "600", marginTop: 10 },
  // Top plane: overlaps the stats card's lower edge.
  homeScan: { minHeight: 104, marginTop: -54, marginHorizontal: 10, borderRadius: 28, backgroundColor: colors.olive, flexDirection: "row", alignItems: "center", paddingHorizontal: 22, gap: 14, shadowColor: NIGHT, shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  homeScanTitle: { color: PAPER, fontFamily: SANS_HEAVY, fontSize: 30, lineHeight: 34, letterSpacing: -1.2 },
  homeScanSub: { color: colors.oliveInk, opacity: 0.85, fontSize: 14, fontWeight: "600" },
  homeScanIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  homePills: { flexDirection: "row", gap: 10 },
  homePill: { flex: 1, height: 56, borderRadius: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 2, borderColor: schemeColor("#2A2A2A", 'border') },
  homePillSage: { backgroundColor: colors.sage },
  homePillPeach: { backgroundColor: colors.peach },
  homePillAmber: { backgroundColor: colors.amber },
  homePillText: { fontSize: 16, fontWeight: "700" },
  homeTiles: { flexDirection: "row", gap: 10 },
  homeTile: { flex: 1, minHeight: 112, borderRadius: 20, borderWidth: 2, borderColor: schemeColor("#2A2A2A", 'border'), padding: 14, gap: 4, justifyContent: "space-between" },
  homeTileValue: { fontFamily: SANS_HEAVY, fontSize: 40, lineHeight: 44, letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
  homeTileLabel: { fontSize: 14, fontWeight: "700" },
  homeGuideLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, height: 48 },
  homeGuideLinkText: { color: colors.ink, fontFamily: SANS_MEDIUM, fontSize: 15 },
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
    color: schemeColor("#000000", 'fg'),
  },
  welcomeTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontFamily: FONT_DISPLAY,
    color: schemeColor("#151613", 'fg'),
    letterSpacing: -1,
  },
  homeLogo: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  homeLogoText: { fontSize: 18, color: schemeColor("#fff", 'fg'), fontWeight: "900" },
  setupCard: {
    borderWidth: 2,
    borderColor: schemeColor("#2A2A2A", 'border'),
    borderRadius: 22,
    padding: 18,
    backgroundColor: glass("rgba(255,255,255,.55)"),
    marginBottom: 20,
  },
  setupTitle: {
    fontSize: 20,
    fontFamily: FONT_DISPLAY,
    color: schemeColor("#191A17", 'fg'),
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
    borderColor: schemeColor("#31322E", 'border'),
    alignItems: "center",
    justifyContent: "center",
  },
  checkDone: { borderColor: colors.primary, backgroundColor: schemeColor("#F8C9B6", 'bg') },
  checkMark: { fontSize: 13, fontWeight: "900", color: schemeColor("#2B3A67", 'fg') },
  checkText: { fontSize: 14, fontWeight: "700", color: schemeColor("#000000", 'fg') },
  checkTextDone: { color: schemeColor("#000000", 'fg'), textDecorationLine: "line-through" },
  setupGuideButton: { minHeight: 46, borderRadius: 15, backgroundColor: schemeColor("#1A2138", 'bg'), flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 15, marginTop: 12 },
  setupGuideText: { color: schemeColor("#fff", 'fg'), fontSize: 14, fontWeight: "900" },
  setupGuideArrow: { color: schemeColor("#fff", 'fg'), fontSize: 25, lineHeight: 25, fontWeight: "600" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  statTileWide: { width: "48%" },
  sectionCaption: { fontSize: 14, fontWeight: "800", color: schemeColor("#59615A", 'fg'), marginTop: 8, marginBottom: 8 },
  reportButtonLight: { minHeight: 52, borderRadius: 26, borderWidth: 1, borderColor: schemeColor("rgba(38,48,42,.25)", 'border'), backgroundColor: schemeColor("rgba(255,255,255,.55)", 'bg'), flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 14 },
  reportButtonLightText: { color: schemeColor("#171815", 'fg'), fontWeight: "800", fontSize: 14 },
  accordionHeader: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, marginTop: 6 },
  accordionTitle: { fontSize: 13, fontWeight: "800", color: schemeColor("#59615A", 'fg') },
  pillRow: { flexDirection: "row", gap: 10, marginTop: 6, marginBottom: 12 },
  pillButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: schemeColor("#2B3A67", 'bg'),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pillButtonText: { color: schemeColor("#fff", 'fg'), fontWeight: "900", fontSize: 14 },
  reportButtonBlack: {
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: schemeColor("#1A2138", 'bg'),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 8,
  },
  reportButtonBlackText: { color: schemeColor("#fff", 'fg'), fontWeight: "900", fontSize: 15 },
  cameraStartButton: {
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: schemeColor("#1A2138", 'bg'),
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    marginBottom: 16,
  },
  cameraStartText: { color: schemeColor("#fff", 'fg'), fontWeight: "900", fontSize: 15 },
  memberInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: schemeColor("rgba(20,20,18,.07)", 'border'),
  },
  memberInfoLabel: { fontSize: 13, fontWeight: "800", color: schemeColor("#000000", 'fg'), flexShrink: 0, marginRight: 12 },
  memberInfoValue: { flex: 1, fontSize: 13, color: schemeColor("#1A2138", 'fg'), fontWeight: "700", textAlign: "right" },
  bigActionButton: {
    minHeight: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  bigActionButtonText: { color: schemeColor("#fff", 'fg'), fontWeight: "900", fontSize: 18 },
  dynamicAction: { minHeight: 64, borderRadius: 32 },
  offlineNote: { color: colors.foreground, fontSize: 14, fontWeight: "600", lineHeight: 20, textAlign: "center", marginTop: 10 },
  waitingPill: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20, borderWidth: 2, borderColor: schemeColor("#2A2A2A", 'border'), backgroundColor: colors.amber },
  waitingPillTitle: { fontSize: 16, fontWeight: "800", color: colors.amberInk },
  waitingPillSub: { fontSize: 13, fontWeight: "500", color: colors.amberInk, marginTop: 2 },
  pageTitle: {
    marginTop: 18,
    fontSize: 34,
    lineHeight: 40,
    fontFamily: FONT_DISPLAY,
    letterSpacing: -0.8,
    color: schemeColor("#171815", 'fg'),
  },
  pageIntro: {
    fontSize: 15,
    lineHeight: 22,
    color: schemeColor("#000000", 'fg'),
    marginTop: 7,
    marginBottom: 20,
  },
  searchInput: {
    height: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: schemeColor("rgba(20,20,18,.1)", 'border'),
    backgroundColor: glass("rgba(255,255,255,.72)"),
    paddingHorizontal: 15,
    fontSize: 15,
    color: schemeColor("#111", 'fg'),
    marginBottom: 14,
  },
  memberCard: {
    minHeight: 76,
    borderWidth: 1,
    borderColor: schemeColor("rgba(20,20,18,.09)", 'border'),
    borderRadius: 18,
    backgroundColor: glass("rgba(255,255,255,.7)"),
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
  memberAvatarText: { color: schemeColor("#fff", 'fg'), fontSize: 17, fontWeight: "900" },
  memberName: { fontSize: 16, fontWeight: "900", color: schemeColor("#1A2138", 'fg') },
  memberMeta: { fontSize: 12, color: schemeColor("#000000", 'fg'), marginTop: 3 },
  memberProgress: {
    fontSize: 20,
    fontFamily: FONT_DISPLAY,
    color: schemeColor("#1A2138", 'fg'),
    textAlign: "right",
  },
  memberUnit: { fontSize: 10, color: schemeColor("#000000", 'fg'), textAlign: "right" },
  emptyState: {
    fontSize: 15,
    lineHeight: 22,
    color: schemeColor("#000000", 'fg'),
    textAlign: "center",
    paddingVertical: 36,
  },
  periodSwitch: {
    flexDirection: "row",
    backgroundColor: schemeColor("#E6DFD3", 'bg'),
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
  periodActive: { backgroundColor: schemeColor("#1A2138", 'bg') },
  periodText: { fontSize: 12, fontWeight: "800", color: schemeColor("#000000", 'fg') },
  periodTextActive: { color: schemeColor("#fff", 'fg') },
  analyticsHeading: {
    fontSize: 18,
    fontWeight: "900",
    color: schemeColor("#1A1B18", 'fg'),
    marginTop: 8,
    marginBottom: 13,
  },
  analyticsGrid: { flexDirection: "row", justifyContent: "space-between" },
  chartsHeading: {
    fontSize: 15,
    fontWeight: "800",
    color: schemeColor("#000000", 'fg'),
    marginTop: 18,
    marginBottom: 10,
  },
  chartCard: {
    borderWidth: 2,
    borderColor: schemeColor("#2A2A2A", 'border'),
    borderRadius: 20,
    padding: 16,
    backgroundColor: schemeColor("rgba(255,255,255,.6)", 'bg'),
    marginBottom: 14,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: schemeColor("#1A2138", 'fg'),
    marginBottom: 10,
  },
  chartWrap: { height: 80, width: "100%" },
  chartLegendRow: { flexDirection: "row", gap: 16, marginTop: 10 },
  chartLegendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, fontWeight: "800", color: schemeColor("#000000", 'fg') },
  insightCard: {
    borderRadius: 22,
    backgroundColor: schemeColor("#1A2138", 'bg'),
    padding: 20,
    marginTop: 10,
    marginBottom: 15,
  },
  insightLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: schemeColor("#00D3FB", 'fg'),
  },
  insightTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: FONT_DISPLAY,
    color: schemeColor("#fff", 'fg'),
    marginTop: 9,
  },
  insightCopy: { fontSize: 14, lineHeight: 21, color: colors.oliveInk, marginTop: 9 },
  totalCard: {
    borderWidth: 2,
    borderColor: schemeColor("#2A2A2A", 'border'),
    borderRadius: 20,
    padding: 17,
    backgroundColor: schemeColor("rgba(255,255,255,.55)", 'bg'),
    marginBottom: 16,
  },
  totalTitle: { fontSize: 16, fontWeight: "900", color: schemeColor("#1A2138", 'fg') },
  totalLine: { fontSize: 13, color: schemeColor("#000000", 'fg'), marginTop: 7 },
  composeCard: {
    borderWidth: 2,
    borderColor: schemeColor("#2A2A2A", 'border'),
    borderRadius: 22,
    padding: 17,
    backgroundColor: schemeColor("rgba(255,255,255,.6)", 'bg'),
    gap: 11,
    marginBottom: 22,
  },
  composeTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: schemeColor("#191A17", 'fg'),
    marginBottom: 2,
  },
  newsCard: {
    borderWidth: 1,
    borderColor: schemeColor("rgba(20,20,18,.1)", 'border'),
    borderRadius: 19,
    padding: 16,
    backgroundColor: schemeColor("rgba(255,255,255,.68)", 'bg'),
    marginBottom: 11,
  },
  newsHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  newsTitle: { fontSize: 16, fontWeight: "900", color: schemeColor("#1A1B18", 'fg'), flex: 1 },
  statusPill: {
    borderRadius: 10,
    backgroundColor: schemeColor("#D8E8D5", 'bg'),
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusDraft: { backgroundColor: schemeColor("#E5E1D9", 'bg') },
  statusText: { fontSize: 11, fontWeight: "800", color: schemeColor("#000000", 'fg') },
  newsBody: { fontSize: 13, lineHeight: 19, color: schemeColor("#000000", 'fg'), marginTop: 8 },
  newsDate: { fontSize: 11, color: schemeColor("#000000", 'fg'), marginTop: 10 },
  navIcon: { fontSize: 21, lineHeight: 23, color: schemeColor("#000000", 'fg') },
  navIconActive: { color: colors.primary },
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
    color: colors.primary,
    marginBottom: 8,
  },
  settingsTitle: {
    fontSize: 29,
    lineHeight: 34,
    fontFamily: FONT_DISPLAY,
    color: schemeColor("#1A2138", 'fg'),
    letterSpacing: -0.7,
    maxWidth: 250,
  },
  settingsSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: schemeColor("#000000", 'fg'),
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
  settingsAvatarLetter: { color: schemeColor("#fff", 'fg'), fontSize: 21, fontFamily: FONT_DISPLAY },
  groupLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.3,
    color: schemeColor("#000000", 'fg'),
    marginLeft: 4,
    marginTop: 8,
    marginBottom: 9,
  },
  settingsGroup: {
    backgroundColor: schemeColor("rgba(255,255,255,.82)", 'bg'),
    borderRadius: 22,
    padding: 17,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: schemeColor("rgba(20,20,18,.07)", 'border'),
  },
  settingsGroupNoPadding: {
    backgroundColor: schemeColor("rgba(255,255,255,.82)", 'bg'),
    borderRadius: 22,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: schemeColor("rgba(20,20,18,.07)", 'border'),
    overflow: "hidden",
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: schemeColor("#000000", 'fg'),
    marginTop: 8,
    marginBottom: 7,
  },
  settingsInput: {
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: schemeColor("#EFEBE3", 'bg'),
    borderWidth: 1,
    borderColor: schemeColor("rgba(20,20,18,.08)", 'border'),
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: schemeColor("#111", 'fg'),
    fontSize: 15,
  },
  textArea: { minHeight: 96 },
  readOnlyNotice: {
    backgroundColor: schemeColor("#FDECCD", 'bg'),
    borderRadius: 13,
    padding: 12,
    marginBottom: 4,
  },
  readOnlyNoticeText: {
    color: schemeColor("#8A5A12", 'fg'),
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "700",
  },
  readOnlyValue: {
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: schemeColor("#EFEBE3", 'bg'),
    borderWidth: 1,
    borderColor: schemeColor("rgba(20,20,18,.08)", 'border'),
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: schemeColor("#000000", 'fg'),
    fontSize: 15,
  },
  fieldHelp: {
    fontSize: 12.5,
    lineHeight: 18,
    color: schemeColor("#000000", 'fg'),
    marginTop: 2,
    marginBottom: 6,
  },
  catalogueLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: schemeColor("rgba(20,20,18,.08)", 'border'),
    backgroundColor: schemeColor("#F8F5EE", 'bg'),
  },
  tierBadge: {
    minWidth: 40,
    height: 40,
    borderRadius: 12,
    paddingHorizontal: 8,
    backgroundColor: schemeColor("#E0F2E4", 'bg'),
    alignItems: "center",
    justifyContent: "center",
  },
  tierBadgeText: { color: schemeColor("#2F8A4C", 'fg'), fontWeight: "900", fontSize: 15 },
  tierTitle: { fontSize: 15, fontWeight: "800", color: schemeColor("#1A2138", 'fg') },
  tierMeta: { fontSize: 12, color: schemeColor("#000000", 'fg'), marginTop: 2 },
  twoColumns: { flexDirection: "row", gap: 10 },
  segment: {
    flexDirection: "row",
    backgroundColor: schemeColor("#EAE4D9", 'bg'),
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
  segmentActive: { backgroundColor: schemeColor("#1A2138", 'bg') },
  segmentText: { fontSize: 13, fontWeight: "800", color: schemeColor("#000000", 'fg') },
  segmentTextActive: { color: schemeColor("#fff", 'fg') },
  stepper: {
    height: 50,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: schemeColor("rgba(20,20,18,.12)", 'border'),
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 12,
  },
  stepperButton: {
    width: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: schemeColor("#EEE8DC", 'bg'),
  },
  stepperText: { fontSize: 22, fontFamily: FONT_DISPLAY, color: schemeColor("#1A2138", 'fg') },
  stepperInput: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "900",
    color: schemeColor("#111", 'fg'),
    backgroundColor: schemeColor("#fff", 'bg'),
  },
  stepperValue: {
    flex: 1,
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 17,
    lineHeight: 50,
    includeFontPadding: false,
    fontWeight: "900",
    color: schemeColor("#111", 'fg'),
    backgroundColor: schemeColor("#fff", 'bg'),
  },
  saveSettings: {
    height: 54,
    borderRadius: 27,
    backgroundColor: schemeColor("#1A2138", 'bg'),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  saveSettingsText: { color: schemeColor("#fff", 'fg'), fontSize: 16, fontWeight: "900" },
  settingsRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: schemeColor("rgba(20,20,18,.07)", 'border'),
  },
  settingsRowLast: { borderBottomWidth: 0 },
  settingsIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsRowTitle: { fontSize: 15, fontWeight: "800", color: schemeColor("#1A2138", 'fg') },
  settingsRowDetail: {
    fontSize: 12,
    lineHeight: 17,
    color: schemeColor("#000000", 'fg'),
    marginTop: 3,
  },
  dangerText: { color: schemeColor("#B73B32", 'fg') },
  settingsFootnote: {
    fontSize: 12,
    lineHeight: 18,
    color: schemeColor("#000000", 'fg'),
    textAlign: "center",
    paddingHorizontal: 18,
    marginTop: -8,
    marginBottom: 14,
  },
  tabs: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: schemeColor("#FFFFFF", 'bg'),
    borderWidth: 1,
    borderColor: schemeColor("rgba(20,20,18,.08)", 'border'),
    borderRadius: 999,
    padding: 6,
    gap: 2,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 4,
    borderRadius: 999,
  },
  tabActivePill: { flex: 1.7, paddingHorizontal: 12, backgroundColor: colors.primary },
  tabText: { color: schemeColor("#6F6B64", 'fg'), fontWeight: "700", fontSize: 12.5 },
  tabActive: { color: schemeColor("#fff", 'fg'), fontWeight: "800" },
}));
