import { showAlert } from "./components/AppAlert";
import { money } from "./money";
import { useEffect, useState, type ReactNode } from "react";
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ArrowLeft,
  AtSign,
  Bell,
  BookOpen,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Fingerprint,
  Gift,
  Globe,
  Image as ImageIcon,
  LifeBuoy,
  LogOut,
  Plus,
  QrCode,
  Settings as SettingsIcon,
  Star,
  Store,
  Trash2,
  Users,
  type LucideIcon,
  Moon,
} from "lucide-react-native";
import type { Session } from "@supabase/supabase-js";
import { colors, fonts } from "./theme";
import { PROGRAMMES, programmeIdFor } from "@loyalty-loop/loyalty";
import { HALAL_CERTIFIERS, SHOP_FEATURES } from "./shop-features";
import { supabase } from "./supabase";
import { biometricLockEnabled, setBiometricLock } from "./biometric";
import { getUsageAnalyticsConsent, setUsageAnalyticsConsent } from "./usage-analytics";
import type { NativeOwnerPage } from "./owner-pages";

import { pick, isDark, setThemeMode, themeMode, type ThemeMode } from "./theme";
const FONT_DISPLAY = fonts.nativeDisplay;
const { foreground: green, primary: orange } = colors;
const ink = pick("#1C2620", "#F4F3EF");

export type ShopBusiness = {
  id: string;
  name: string;
  category?: string | null;
  description?: string | null;
  address?: string | null;
  postcode?: string | null;
  phone?: string | null;
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
  reward_model?: "stamp_legacy" | "spend_threshold" | "tiers" | "points";
  reward_threshold_pence?: number | null;
  features?: string[] | null;
  halal_certifier?: string | null;
};

const LOYALTY_TYPE_OPTIONS: {
  type: NonNullable<ShopBusiness["loyalty_type"]>;
  title: string;
  unit: string;
}[] = [
  { type: "stamp_card", title: "Stamps", unit: "stamps" },
  { type: "points", title: "Points", unit: "points" },
  { type: "tiered", title: "Visits", unit: "visits" },
];

const SPEND_REWARDS_HELP =
  "Customers earn by spending. Staff scan the customer's QR and enter what they spent, and linked cards count automatically where available. Each reward unlocks at the amount you set; the biggest one starts a new round.";

// Amounts are stored in minor units (pence, paisa). Whole amounts show without decimals.
function poundsWhole(pence: number): string {
  return money(pence).replace(/\.00$/, "");
}

// Icon tile colours for settings rows: soft background + matching icon tint.
const SETTINGS_TILES = {
  blue: { bg: pick("#DCE6D2", "#26311B"), fg: pick("#3E5235", "#9FD289") },
  purple: { bg: pick("#F3E3D3", "#362617"), fg: pick("#8A4A2B", "#D89F83") },
  amber: { bg: pick("#FBE7BF", "#362B17"), fg: pick("#8A5A00", "#EBC070") },
  green: { bg: pick("#DCEBD9", "#1E321A"), fg: pick("#2F7A3F", "#89D298") },
  teal: { bg: pick("#D7E6E0", "#1D2F28"), fg: pick("#2E6656", "#89D2BD") },
  slate: { bg: pick("#E6E8E2", "#1F2221"), fg: pick("#545C55", "#7D847E") },
  orange: { bg: pick("#FDE2D2", "#362217"), fg: pick("#C4531F", "#E99772") },
  red: { bg: pick("#F8DCD8", "#361B17"), fg: pick("#B73B32", "#DC857F") },
} as const;
type SettingsTile = keyof typeof SETTINGS_TILES;

function SettingsRow({
  icon: Icon,
  tile = "slate",
  title,
  detail,
  onPress,
  right,
  danger,
  last,
  testID,
}: {
  icon: LucideIcon;
  tile?: SettingsTile;
  title: string;
  detail?: string;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
  last?: boolean;
  testID?: string;
}) {
  const palette = SETTINGS_TILES[danger ? "red" : tile];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.settingsRow,
        last && styles.settingsRowLast,
        pressed && onPress && styles.pressed,
      ]}
    >
      <View style={[styles.settingsIcon, { backgroundColor: palette.bg }]}>
        <Icon size={19} color={palette.fg} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.settingsRowTitle, danger && styles.dangerText]}>
          {title}
        </Text>
        {detail ? <Text style={styles.settingsRowDetail}>{detail}</Text> : null}
      </View>
      {right ??
        (onPress ? (
          <ChevronRight size={20} color={danger ? pick("#B73B32", "#FF6B60") : pick("#A2A49D", "#6B726D")} />
        ) : null)}
    </Pressable>
  );
}

/** Light / Dark switch. Styles are built at start-up, so a change restarts the app. */
function AppearanceToggle() {
  const choose = (mode: ThemeMode) => {
    if (mode === themeMode) return;
    showAlert(
      mode === "dark" ? "Switch to dark mode?" : "Switch to light mode?",
      "The app restarts to apply it. You stay signed in.",
      [
        { text: "Switch", onPress: () => void setThemeMode(mode) },
        { text: "Cancel", style: "cancel" },
      ],
    );
  };
  return (
    <View style={styles.appearanceToggle}>
      {(["light", "dark"] as const).map((mode) => {
        const active = mode === themeMode;
        return (
          <Pressable
            key={mode}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => choose(mode)}
            style={[styles.appearanceOption, active && styles.appearanceOptionActive]}
          >
            <Text style={[styles.appearanceOptionText, active && styles.appearanceOptionTextActive]}>
              {mode === "light" ? "Light" : "Dark"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Store-policy requirement: an app that creates accounts must let the user
 * delete the account in-app. The delete-my-account function refuses while
 * the user still owns shops, so owned shops are deleted first via the same
 * RPC the website uses, after two explicit destructive confirmations. */
function confirmDeleteAccount(userId: string) {
  const run = async () => {
    let leftoverFiles = 0;
    try {
      const { data: owned, error: ownedError } = await supabase
        .from("businesses")
        .select("id,name")
        .eq("owner_id", userId);
      if (ownedError) throw ownedError;
      // A shop that is deleted but leaves files behind is still gone, so carry on
      // deleting the account and mention the leftovers once at the end.
      for (const shop of owned || []) {
        const { data, error } = await supabase.functions.invoke("delete-business", {
          body: { business_id: shop.id, confirmation_name: shop.name },
        });
        if (error) {
          const context = (error as { context?: Response }).context;
          const detail = context ? await context.json().catch(() => null) : null;
          throw new Error(typeof detail?.error === "string" && detail.error.trim() ? detail.error : "Could not delete your shop. Please try again.");
        }
        if (data?.error) throw new Error(data.error);
        if (!data?.deleted) throw new Error("Could not confirm shop deletion.");
        leftoverFiles += data.leftovers?.length ?? 0;
      }
      const { data, error } = await supabase.functions.invoke("delete-my-account");
      if (error) throw error;
      if (data && typeof data === "object" && "error" in data && data.error) throw new Error(String(data.error));
      await supabase.auth.signOut().catch(() => undefined);
      showAlert(
        "Account deleted",
        leftoverFiles
          ? `Your account and its data have been permanently deleted. ${leftoverFiles} shop file(s) could not be removed; contact support and we will remove them.`
          : "Your account and its data have been permanently deleted.",
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Please try again.";
      showAlert("Could not delete account", leftoverFiles
        ? `${message} ${leftoverFiles} file(s) from shops already deleted still need support cleanup.`
        : message);
    }
  };
  showAlert(
    "Delete your account?",
    "This permanently deletes your login and personal data. Every shop you own (including its customers' loyalty progress, rewards and reviews) is deleted too. This cannot be undone.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Continue",
        style: "destructive",
        onPress: () =>
          showAlert("Are you absolutely sure?", "There is no way to recover the account or its shops afterwards.", [
            { text: "Keep my account", style: "cancel" },
            { text: "Delete everything", style: "destructive", onPress: () => void run() },
          ]),
      },
    ],
  );
}

type ShopView = "home" | "details" | "account";

// Editing shop identity/location/loyalty settings, and the branding, rewards
// and staff pages it links to, all write to tables whose RLS only allows the
// business owner (or an admin) to write — see businesses_update_owner_or_admin,
// reward_catalog_write_owner_or_admin, staff_members_owner_full_access,
// business_photos_write_owner_or_admin. A staff account could still open this
// screen, edit a field and tap Save; the write matched zero rows under RLS, the
// client reported no error (no `.select()` was chained to notice), so the app
// said "Settings saved" and the field silently reverted on the next reload.
// Fixed by showing staff a read-only view of what only the owner can change,
// and by having save() check that a row actually came back.
export function BusinessSettings({
  business,
  session,
  isOwner,
  onChanged,
  onOpenPage,
}: {
  business: ShopBusiness;
  session: Session;
  isOwner: boolean;
  onChanged: () => Promise<void>;
  onOpenPage: (page: NativeOwnerPage) => void;
}) {
  const [view, setView] = useState<ShopView>("home");
  useEffect(() => setView("home"), [business.id]);
  if (view === "details")
    return (
      <ShopDetailsPage
        business={business}
        isOwner={isOwner}
        onChanged={onChanged}
        onOpenPage={onOpenPage}
        onBack={() => setView("home")}
      />
    );
  if (view === "account")
    return (
      <AccountPage
        business={business}
        session={session}
        isOwner={isOwner}
        onChanged={onChanged}
        onBack={() => setView("home")}
      />
    );
  return (
    <ShopHome
      business={business}
      isOwner={isOwner}
      onOpenPage={onOpenPage}
      onOpenDetails={() => setView("details")}
      onOpenAccount={() => setView("account")}
    />
  );
}

type Completeness = { key: string; label: string; done: boolean; action: "details" | "branding" };

function completenessOf(business: ShopBusiness): Completeness[] {
  const filled = (value?: string | null) => Boolean(value && value.trim());
  return [
    { key: "address", label: "Address", done: filled(business.address), action: "details" },
    { key: "postcode", label: "Postcode", done: filled(business.postcode), action: "details" },
    { key: "phone", label: "Phone number", done: filled(business.phone), action: "details" },
    { key: "description", label: "Description", done: filled(business.description), action: "details" },
    { key: "logo", label: "Logo", done: filled(business.logo_url), action: "branding" },
    { key: "cover", label: "Cover photo", done: filled(business.cover_url), action: "branding" },
  ];
}

function ShopHome({
  business,
  isOwner,
  onOpenPage,
  onOpenDetails,
  onOpenAccount,
}: {
  business: ShopBusiness;
  isOwner: boolean;
  onOpenPage: (page: NativeOwnerPage) => void;
  onOpenDetails: () => void;
  onOpenAccount: () => void;
}) {
  const brand = business.brand_color || green;
  const programme = PROGRAMMES[programmeIdFor(business)];
  const items = completenessOf(business);
  const missing = items.filter((item) => !item.done);
  const done = items.length - missing.length;
  const live = business.is_active !== false;
  const [rewardCount, setRewardCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    void supabase
      .from("reward_catalog")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .then(({ count }) => {
        if (active) setRewardCount(count ?? 0);
      });
    return () => {
      active = false;
    };
  }, [business.id]);
  const openWebTools = () => void Linking.openURL("https://www.the-loyalty-loop.com/owner/tools");
  return (
    <View>
      <View style={styles.hero}>
        <View style={[styles.cover, { backgroundColor: brand }]}>
          {business.cover_url ? (
            <Image source={{ uri: business.cover_url }} style={styles.fill} resizeMode="cover" />
          ) : null}
        </View>
        <View style={styles.heroBody}>
          <View style={[styles.logo, { backgroundColor: brand }]}>
            {business.logo_url ? (
              <Image source={{ uri: business.logo_url }} style={styles.fill} />
            ) : (
              <Text style={styles.logoLetter}>{business.name.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <Text style={styles.heroName} numberOfLines={2}>{business.name}</Text>
          <View style={styles.heroMeta}>
            {business.category ? <Text style={styles.heroCategory}>{business.category}</Text> : null}
            <View style={[styles.pill, live ? styles.pillLive : styles.pillHidden]}>
              <View style={[styles.pillDot, { backgroundColor: live ? pick("#2F8A4C", "#4CC07A") : pick("#B73B32", "#FF6B60") }]} />
              <Text style={styles.pillText}>{live ? "Live" : "Hidden"}</Text>
            </View>
          </View>
          {isOwner ? (
            <View style={styles.meter}>
              <View style={styles.meterTop}>
                <Text style={styles.meterTitle}>
                  {missing.length ? "Finish your profile" : "Your profile is complete"}
                </Text>
                <Text style={styles.meterCount}>{done} of {items.length}</Text>
              </View>
              <View style={styles.meterTrack}>
                <View style={[styles.meterFill, { width: `${(done / items.length) * 100}%` }]} />
              </View>
              {missing.map((item) => (
                <View key={item.key} style={styles.missingRow}>
                  <Text style={styles.missingLabel}>{item.label}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${item.label.toLowerCase()}`}
                    onPress={() => (item.action === "branding" ? onOpenPage("branding") : onOpenDetails())}
                    style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
                  >
                    <Plus size={14} color="#fff" strokeWidth={3} />
                    <Text style={styles.addButtonText}>Add</Text>
                  </Pressable>
                </View>
              ))}
              {!missing.length ? (
                <View style={styles.completeRow}>
                  <Check size={16} color={pick("#2F8A4C", "#85D69F")} strokeWidth={3} />
                  <Text style={styles.completeText}>Customers see everything they need.</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.tiles}>
        {isOwner ? (
          <BigTile
            testID="tour-programme-tile"
            icon={Gift}
            tile="amber"
            title="Programme"
            detail={`${programme.name}${rewardCount ? ` · ${rewardCount} reward${rewardCount === 1 ? "" : "s"}` : ""}`}
            onPress={() => onOpenPage("rewards")}
          />
        ) : null}
        {isOwner ? (
          <BigTile
            icon={ImageIcon}
            tile="orange"
            title="Photos & branding"
            detail="Logo and cover"
            onPress={() => onOpenPage("branding")}
          />
        ) : null}
        {isOwner ? (
          <BigTile
            icon={Users}
            tile="blue"
            title="Staff"
            detail="Invite and manage access"
            onPress={() => onOpenPage("staff")}
          />
        ) : null}
        <BigTile
          icon={Star}
          tile="purple"
          title="Reviews"
          detail="Read and reply"
          onPress={() => onOpenPage("reviews")}
          wide={!isOwner}
        />
      </View>

      {isOwner ? (
        <Pressable
          testID="tour-poster-tile"
          onPress={openWebTools}
          style={({ pressed }) => [styles.posterRow, pressed && styles.pressed]}
        >
          <View style={styles.posterIcon}>
            <QrCode size={24} color="#fff" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.posterTitle}>QR poster</Text>
            <Text style={styles.posterDetail}>Print it so customers can join</Text>
          </View>
          <ChevronRight size={20} color={ink} />
        </Pressable>
      ) : null}

      <View style={styles.settingsGroupNoPadding}>
        <SettingsRow
          icon={Store}
          tile="green"
          title="Shop details"
          detail={isOwner ? "Name, address, phone, what you offer" : "Name, address and phone"}
          onPress={onOpenDetails}
        />
        <SettingsRow
          icon={BookOpen}
          tile="green"
          title="How to use your loyalty programme"
          detail="A short step-by-step business guide"
          onPress={() => onOpenPage("tutorial")}
        />
        <SettingsRow
          icon={LifeBuoy}
          tile="teal"
          title="Help & support"
          detail="Get help from The Loyalty Loop"
          onPress={() => onOpenPage("support")}
        />
        <SettingsRow
          icon={SettingsIcon}
          tile="slate"
          title="Settings & account"
          detail="App lock, notifications, privacy, sign out"
          onPress={onOpenAccount}
          last
        />
      </View>
    </View>
  );
}

function BigTile({
  icon: Icon,
  tile,
  title,
  detail,
  onPress,
  wide,
  testID,
}: {
  icon: LucideIcon;
  tile: SettingsTile;
  title: string;
  detail: string;
  onPress: () => void;
  wide?: boolean;
  testID?: string;
}) {
  const palette = SETTINGS_TILES[tile];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.tile, wide && styles.tileWide, { backgroundColor: palette.bg }, pressed && styles.pressed]}
    >
      <View style={styles.tileIcon}>
        <Icon size={22} color={palette.fg} strokeWidth={2.2} />
      </View>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileDetail} numberOfLines={2}>{detail}</Text>
    </Pressable>
  );
}

function PageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.pageHeader}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <ArrowLeft size={20} color={ink} />
      </Pressable>
      <Text style={styles.pageTitle}>{title}</Text>
    </View>
  );
}

function ShopDetailsPage({
  business,
  isOwner,
  onChanged,
  onOpenPage,
  onBack,
}: {
  business: ShopBusiness;
  isOwner: boolean;
  onChanged: () => Promise<void>;
  onOpenPage: (page: NativeOwnerPage) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState(business.name),
    [category, setCategory] = useState(business.category || ""),
    [description, setDescription] = useState(business.description || ""),
    [features, setFeatures] = useState<string[]>(business.features ?? []),
    [halalCertifier, setHalalCertifier] = useState<string | null>(business.halal_certifier ?? null),
    [address, setAddress] = useState(business.address || ""),
    [postcode, setPostcode] = useState(business.postcode || ""),
    [phone, setPhone] = useState(business.phone || ""),
    [loyaltyType, setLoyaltyType] = useState<ShopBusiness["loyalty_type"]>(
      business.loyalty_type || "stamp_card",
    ),
    [saving, setSaving] = useState(false);
  // Rewards unlock at £ amounts (ARCH_PLAN.md §4.11). The highest amount starts
  // a new cycle of rewards.
  const spendShop = business.reward_model === "spend_threshold";
  const [catalog, setCatalog] = useState<{ id: string; title: string; stamp_threshold: number; spend_threshold_pence: number | null }[] | null>(null);
  useEffect(() => {
    let active = true;
    void supabase
      .from("reward_catalog")
      .select("id,title,stamp_threshold,spend_threshold_pence")
      .eq("business_id", business.id)
      .order(spendShop ? "spend_threshold_pence" : "stamp_threshold")
      .then(({ data }) => {
        if (active) setCatalog(data || []);
      });
    return () => {
      active = false;
    };
  }, [business.id, spendShop]);
  const unit = LOYALTY_TYPE_OPTIONS.find((option) => option.type === loyaltyType)?.unit ?? "stamps";
  const modeHelp =
    loyaltyType === "points"
      ? `Staff choose how many points to add at each scan, for example 1 point per ${poundsWhole(100)} spent.`
      : loyaltyType === "tiered"
        ? "Each scan counts as one visit."
        : "Each scan adds a stamp (staff can add more than one at once).";
  const rewardSummary = (catalog ?? [])
    .filter((tier) => tier.spend_threshold_pence)
    .map((tier) => `${tier.title} ${poundsWhole(tier.spend_threshold_pence!)}`)
    .join(" · ");
  useEffect(() => {
    setName(business.name);
    setCategory(business.category || "");
    setDescription(business.description || "");
    setFeatures(business.features ?? []);
    setHalalCertifier(business.halal_certifier ?? null);
    setAddress(business.address || "");
    setPostcode(business.postcode || "");
    setPhone(business.phone || "");
    setLoyaltyType(business.loyalty_type || "stamp_card");
  }, [business.id]);
  const save = async () => {
    if (!name.trim())
      return showAlert("Shop name needed", "Enter a name for your business.");
    setSaving(true);
    try {
      // .select("id") matters here: without it, a write that RLS silently
      // matches zero rows against comes back as { error: null, data: null },
      // which looks exactly like success. Checking the returned row is what
      // catches that instead of reporting "Settings saved" for nothing.
      const { data, error } = await supabase
        .from("businesses")
        .update({
          name: name.trim(),
          category: category.trim() || null,
          description: description.trim() || null,
          features,
          halal_certifier: features.includes("halal") ? halalCertifier : null,
          address: address.trim() || null,
          postcode: postcode.trim() || null,
          phone: phone.trim() || null,
          ...(spendShop
            ? {}
            : {
                loyalty_type: loyaltyType,
                loyalty_config: {
                  ...business.loyalty_config,
                  stamps_required: catalog?.length
                    ? Math.max(...catalog.map((tier) => tier.stamp_threshold))
                    : business.loyalty_config?.stamps_required || 10,
                },
              }),
        })
        .eq("id", business.id)
        .select("id");
      if (error) throw error;
      if (!data?.length) {
        throw new Error(
          "Nothing was saved. Only the shop owner can change these details.",
        );
      }
      await onChanged();
      showAlert(
        "Settings saved",
        "Your shop and loyalty programme are up to date.",
      );
    } catch (e) {
      showAlert(
        "Could not save",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <View>
      <PageHeader title={isOwner ? "Edit profile" : "Shop details"} onBack={onBack} />
      {isOwner ? (
        <>
          <Text style={styles.groupLabel}>SHOP PROFILE</Text>
          <View style={styles.settingsGroup}>
            <Text style={styles.fieldLabel}>Shop name</Text>
            <TextInput keyboardAppearance={pick('light', 'dark')}
              style={styles.settingsInput}
              value={name}
              onChangeText={setName}
              placeholderTextColor={pick("#000000", "#6B726D")}
            />
            <Text style={styles.fieldLabel}>Category</Text>
            <TextInput keyboardAppearance={pick('light', 'dark')}
              style={styles.settingsInput}
              value={category}
              onChangeText={setCategory}
              placeholder="Cafe, salon, restaurant…"
              placeholderTextColor={pick("#000000", "#6B726D")}
            />
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput keyboardAppearance={pick('light', 'dark')}
              style={[styles.settingsInput, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Tell customers what makes you special"
              placeholderTextColor={pick("#000000", "#6B726D")}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.fieldLabel}>What your shop offers</Text>
            <Text style={styles.copy}>Customers can filter shops by these. Only tick what is true for your shop.</Text>
            <View style={styles.categoryRow}>
              {SHOP_FEATURES.map((feature) => {
                const active = features.includes(feature.id);
                return (
                  <Pressable
                    key={feature.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}
                    onPress={() => setFeatures((current) => active ? current.filter((id) => id !== feature.id) : [...current, feature.id])}
                    style={[styles.categoryChip, active && styles.categoryChipActive]}
                  >
                    <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{feature.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {features.includes("halal") ? (
              <>
                <Text style={styles.fieldLabel}>Halal certification (optional)</Text>
                <View style={styles.categoryRow}>
                  {[null, ...HALAL_CERTIFIERS].map((certifier) => {
                    const active = halalCertifier === certifier;
                    return (
                      <Pressable
                        key={certifier ?? "none"}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                        onPress={() => setHalalCertifier(certifier)}
                        style={[styles.categoryChip, active && styles.categoryChipActive]}
                      >
                        <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{certifier ? `Certified by ${certifier}` : "Not certified"}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
            <Text style={styles.fieldLabel}>Address</Text>
            <TextInput keyboardAppearance={pick('light', 'dark')}
              style={styles.settingsInput}
              value={address}
              onChangeText={setAddress}
              placeholderTextColor={pick("#000000", "#6B726D")}
            />
            <View style={styles.twoColumns}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Postcode</Text>
                <TextInput keyboardAppearance={pick('light', 'dark')}
                  style={styles.settingsInput}
                  value={postcode}
                  onChangeText={setPostcode}
                  placeholderTextColor={pick("#000000", "#6B726D")}
                  autoCapitalize="characters"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Phone</Text>
                <TextInput keyboardAppearance={pick('light', 'dark')}
                  style={styles.settingsInput}
                  value={phone}
                  onChangeText={setPhone}
                  placeholderTextColor={pick("#000000", "#6B726D")}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </View>
          <Text style={styles.groupLabel}>LOYALTY PROGRAMME</Text>
          <View style={styles.settingsGroup}>
            <Text style={styles.fieldLabel}>How customers collect</Text>
            {spendShop ? null : (
              <View style={styles.segment}>
                {LOYALTY_TYPE_OPTIONS.map((option) => (
                  <Pressable
                    key={option.type}
                    onPress={() => setLoyaltyType(option.type)}
                    style={[
                      styles.segmentButton,
                      loyaltyType === option.type && styles.segmentActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        loyaltyType === option.type && styles.segmentTextActive,
                      ]}
                    >
                      {option.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Text style={styles.fieldHelp}>{spendShop ? SPEND_REWARDS_HELP : modeHelp}</Text>
            <Pressable
              onPress={() => onOpenPage("rewards")}
              style={({ pressed }) => [styles.catalogueLink, pressed && styles.pressed]}
            >
              <View style={styles.tierBadge}>
                <Gift size={18} color={pick("#2F8A4C", "#85D69F")} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tierTitle}>Rewards catalogue</Text>
                <Text style={styles.tierMeta}>
                  {catalog === null
                    ? "Loading…"
                    : spendShop
                      ? rewardSummary || "Add what customers unlock and how much they spend to get it"
                      : catalog.length
                        ? `${catalog.length} reward${catalog.length === 1 ? "" : "s"} · unlock at the ${unit} you set`
                        : `Add what customers unlock and at how many ${unit}`}
                </Text>
              </View>
              <ChevronRight size={18} color={pick("#2F8A4C", "#85D69F")} />
            </Pressable>
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
        </>
      ) : (
        <>
          <Text style={styles.groupLabel}>SHOP PROFILE</Text>
          <View style={styles.settingsGroup}>
            <View style={styles.readOnlyNotice}>
              <Text style={styles.readOnlyNoticeText}>
                Only the shop owner can edit these details, from this screen or
                the website dashboard.
              </Text>
            </View>
            <Text style={styles.fieldLabel}>Shop name</Text>
            <Text style={styles.readOnlyValue}>{business.name}</Text>
            <Text style={styles.fieldLabel}>Category</Text>
            <Text style={styles.readOnlyValue}>{business.category || "-"}</Text>
            <Text style={styles.fieldLabel}>Description</Text>
            <Text style={styles.readOnlyValue}>{business.description || "-"}</Text>
            <Text style={styles.fieldLabel}>Address</Text>
            <Text style={styles.readOnlyValue}>{business.address || "-"}</Text>
            <View style={styles.twoColumns}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Postcode</Text>
                <Text style={styles.readOnlyValue}>{business.postcode || "-"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Phone</Text>
                <Text style={styles.readOnlyValue}>{business.phone || "-"}</Text>
              </View>
            </View>
          </View>
          <Text style={styles.groupLabel}>LOYALTY PROGRAMME</Text>
          <View style={styles.settingsGroup}>
            <Text style={styles.fieldLabel}>How customers collect</Text>
            {spendShop ? null : (
              <Text style={styles.readOnlyValue}>
                {LOYALTY_TYPE_OPTIONS.find((option) => option.type === loyaltyType)?.title ?? "Stamps"}
              </Text>
            )}
            <Text style={styles.fieldHelp}>{spendShop ? SPEND_REWARDS_HELP : modeHelp}</Text>
            <Text style={styles.fieldHelp}>
              {catalog === null
                ? "Loading rewards…"
                : spendShop
                  ? rewardSummary || "No rewards set up yet."
                  : catalog.length
                    ? `${catalog.length} reward${catalog.length === 1 ? "" : "s"} set, unlocking at the ${unit} the owner chose.`
                    : "No rewards set up yet."}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

function AccountPage({
  business,
  session,
  isOwner,
  onChanged,
  onBack,
}: {
  business: ShopBusiness;
  session: Session;
  isOwner: boolean;
  onChanged: () => Promise<void>;
  onBack: () => void;
}) {
  const [biometricEnabled, setBiometricEnabled] = useState(false),
    [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  useEffect(() => {
    biometricLockEnabled().then(setBiometricEnabled);
    getUsageAnalyticsConsent().then(setAnalyticsEnabled);
  }, []);
  const toggleBiometricLock = async () => {
    const result = await setBiometricLock(!biometricEnabled);
    if (result.success) setBiometricEnabled(!biometricEnabled);
    else showAlert("Could not update app lock", result.error);
  };
  const toggleUsageAnalytics = async () => { const next = !analyticsEnabled; await setUsageAnalyticsConsent(next); setAnalyticsEnabled(next); };
  const toggleActive = () =>
    showAlert(
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
              return showAlert("Could not update shop", error.message);
            await onChanged();
          },
        },
      ],
    );
  return (
    <View>
      <PageHeader title="Settings & account" onBack={onBack} />
      <Text style={styles.groupLabel}>APPEARANCE</Text>
      <View style={styles.settingsGroupNoPadding}>
        <SettingsRow
          icon={Moon}
          tile="slate"
          title="Theme"
          detail={isDark ? "Dark" : "Light"}
          right={<AppearanceToggle />}
          last
        />
      </View>
      <Text style={styles.groupLabel}>SECURITY & PRIVACY</Text>
      <View style={styles.settingsGroupNoPadding}>
        <SettingsRow
          icon={Fingerprint}
          tile="blue"
          title="App lock"
          detail="Face ID, Touch ID or fingerprint to open this app"
          right={
            <Switch
              value={biometricEnabled}
              onValueChange={() => void toggleBiometricLock()}
              trackColor={{ true: pick(green, orange) }}
            />
          }
        />
        <SettingsRow
          icon={ChartNoAxesCombined}
          tile="purple"
          title="Anonymous analytics"
          detail="Share feature-use insights to help improve the app"
          right={
            <Switch
              value={analyticsEnabled}
              onValueChange={() => void toggleUsageAnalytics()}
              trackColor={{ true: pick(green, orange) }}
            />
          }
          last
        />
      </View>
      <Text style={styles.groupLabel}>HELP & LEARNING</Text>
      <View style={styles.settingsGroupNoPadding}>
        <SettingsRow
          icon={Bell}
          tile="amber"
          title="Notification settings"
          detail="Manage this app's alerts in your phone settings"
          onPress={() => void Linking.openSettings()}
        />
        <SettingsRow
          icon={Globe}
          tile="slate"
          title="Visit web dashboard"
          detail="Open the-loyalty-loop.com in your browser"
          onPress={() => Linking.openURL("https://www.the-loyalty-loop.com")}
          last
        />
      </View>
      <Text style={styles.groupLabel}>LEGAL</Text>
      <View style={styles.settingsGroupNoPadding}>
        <SettingsRow
          icon={FileText}
          tile="slate"
          title="Privacy notice"
          onPress={() =>
            Linking.openURL(
              "https://www.the-loyalty-loop.com/legal/privacy-notice.pdf",
            )
          }
        />
        <SettingsRow
          icon={FileText}
          tile="slate"
          title="Terms of service"
          onPress={() =>
            Linking.openURL(
              "https://www.the-loyalty-loop.com/legal/terms-of-service.pdf",
            )
          }
          last
        />
      </View>
      <Text style={styles.groupLabel}>ACCOUNT</Text>
      <View style={styles.settingsGroupNoPadding}>
        <SettingsRow
          icon={AtSign}
          tile="teal"
          title="Signed in as"
          detail={session.user.email || "Business account"}
        />
        {isOwner && (
          <SettingsRow
            icon={business.is_active === false ? Eye : EyeOff}
            tile="amber"
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
        )}
        <SettingsRow
          icon={LogOut}
          tile="orange"
          title="Sign out"
          onPress={() =>
            showAlert("Sign out?", "You can sign back in at any time.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Sign out",
                style: "destructive",
                onPress: () => void supabase.auth.signOut(),
              },
            ])
          }
        />
        <SettingsRow
          icon={Trash2}
          title="Delete account"
          detail="Permanently delete your account and any shops you own"
          onPress={() => confirmDeleteAccount(session.user.id)}
          danger
          last
        />
      </View>
      <Text style={styles.settingsFootnote}>
        Deleting your account also permanently deletes every shop you own.
        Deleting a single shop, or transferring it to another owner, is done on
        the website.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  appearanceToggle: { flexDirection: "row", padding: 3, borderRadius: 999, backgroundColor: pick("#EDEFE9", "#1F2221") },
  appearanceOption: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  appearanceOptionActive: { backgroundColor: orange },
  appearanceOptionText: { fontSize: 13, fontWeight: "700", color: pick("#59615A", "#9DA49E") },
  appearanceOptionTextActive: { color: "#fff" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.5 },
  fill: { width: "100%", height: "100%" },
  copy: { fontSize: 13, lineHeight: 19, color: pick("#000000", "#9DA49E"), marginBottom: 6 },
  hero: {
    marginTop: 18,
    marginBottom: 16,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: pick("#fff", "#151716"),
    borderWidth: 1,
    borderColor: pick("rgba(20,20,18,.07)", "rgba(255,255,255,0.09)"),
  },
  cover: { height: 130, width: "100%" },
  heroBody: { paddingHorizontal: 18, paddingBottom: 18 },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 24,
    marginTop: -38,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoLetter: { color: "#fff", fontSize: 30, fontFamily: FONT_DISPLAY },
  heroName: {
    fontSize: 27,
    lineHeight: 32,
    fontFamily: FONT_DISPLAY,
    color: ink,
    letterSpacing: -0.6,
    marginTop: 12,
  },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" },
  heroCategory: { fontSize: 14, fontWeight: "700", color: pick("#000000", "#9DA49E") },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  pillLive: { backgroundColor: pick("#DCEBD9", "#1E321A") },
  pillHidden: { backgroundColor: pick("#F8DCD8", "#361B17") },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 12, fontWeight: "900", color: pick("#000000", "#9DA49E") },
  meter: {
    marginTop: 18,
    borderRadius: 20,
    backgroundColor: pick("#FBE7BF", "#362B17"),
    padding: 15,
  },
  meterTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  meterTitle: { fontSize: 15, fontWeight: "900", color: pick("#000000", "#9DA49E") },
  meterCount: { fontSize: 13, fontWeight: "800", color: pick("#000000", "#9DA49E") },
  meterTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: pick("rgba(0,0,0,.12)", "rgba(255,255,255,0.16)"),
    marginTop: 10,
    marginBottom: 6,
    overflow: "hidden",
  },
  meterFill: { height: 8, borderRadius: 4, backgroundColor: "#2F8A4C" },
  missingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
  },
  missingLabel: { fontSize: 14, fontWeight: "700", color: pick("#000000", "#9DA49E") },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: pick(ink, "#F2672A"),
  },
  addButtonText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  completeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  completeText: { fontSize: 13, fontWeight: "700", color: pick("#000000", "#9DA49E") },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 12 },
  tile: {
    width: "47.9%",
    flexGrow: 1,
    minHeight: 132,
    borderRadius: 24,
    padding: 16,
    justifyContent: "flex-end",
  },
  tileWide: { width: "100%" },
  tileIcon: {
    position: "absolute",
    top: 14,
    left: 14,
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  tileTitle: { fontSize: 18, fontFamily: FONT_DISPLAY, color: pick("#000000", "#9DA49E"), letterSpacing: -0.3 },
  tileDetail: { fontSize: 12, lineHeight: 17, color: pick("#000000", "#9DA49E"), marginTop: 3 },
  posterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
    backgroundColor: pick("#F3E3D3", "#362617"),
  },
  posterIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: orange,
    alignItems: "center",
    justifyContent: "center",
  },
  posterTitle: { fontSize: 17, fontFamily: FONT_DISPLAY, color: pick("#000000", "#9DA49E") },
  posterDetail: { fontSize: 13, color: pick("#000000", "#9DA49E"), marginTop: 2 },
  pageHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 20, marginBottom: 18 },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: pick("rgba(255,255,255,.82)", "rgba(26,28,27,0.82)"),
    borderWidth: 1,
    borderColor: pick("rgba(20,20,18,.07)", "rgba(255,255,255,0.09)"),
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: { fontSize: 24, fontFamily: FONT_DISPLAY, color: ink, letterSpacing: -0.5, flex: 1 },
  groupLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.3,
    color: pick("#000000", "#9DA49E"),
    marginLeft: 4,
    marginTop: 8,
    marginBottom: 9,
  },
  settingsGroup: {
    backgroundColor: pick("rgba(255,255,255,.82)", "rgba(26,28,27,0.82)"),
    borderRadius: 22,
    padding: 17,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: pick("rgba(20,20,18,.07)", "rgba(255,255,255,0.09)"),
  },
  settingsGroupNoPadding: {
    backgroundColor: pick("rgba(255,255,255,.82)", "rgba(26,28,27,0.82)"),
    borderRadius: 22,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: pick("rgba(20,20,18,.07)", "rgba(255,255,255,0.09)"),
    overflow: "hidden",
  },
  fieldLabel: { fontSize: 13, fontWeight: "800", color: pick("#000000", "#9DA49E"), marginTop: 12, marginBottom: 7 },
  settingsInput: {
    minHeight: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: pick("rgba(20,20,18,.12)", "rgba(255,255,255,0.16)"),
    paddingHorizontal: 14,
    fontSize: 15,
    color: pick("#000000", "#9DA49E"),
    backgroundColor: pick("#fff", "#151716"),
  },
  textArea: { minHeight: 96, paddingTop: 12 },
  readOnlyNotice: { borderRadius: 14, backgroundColor: pick("#FBE7BF", "#362B17"), padding: 12, marginBottom: 4 },
  readOnlyNoticeText: { fontSize: 13, lineHeight: 19, color: pick("#000000", "#9DA49E") },
  readOnlyValue: { fontSize: 15, lineHeight: 22, color: pick("#000000", "#9DA49E"), fontWeight: "600" },
  fieldHelp: { fontSize: 12, lineHeight: 18, color: pick("#000000", "#9DA49E"), marginTop: 8 },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: pick("#fff", "#151716"),
    borderWidth: 1,
    borderColor: pick("rgba(20,20,18,.12)", "rgba(255,255,255,0.16)"),
  },
  categoryChipActive: { backgroundColor: pick(ink, "#F2672A"), borderColor: pick(ink, "#F2672A") },
  categoryChipText: { fontSize: 13, fontWeight: "800", color: pick("#000000", "#9DA49E") },
  categoryChipTextActive: { color: "#fff" },
  catalogueLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
    padding: 13,
    borderRadius: 18,
    backgroundColor: pick("#DCEBD9", "#1E321A"),
  },
  tierBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  tierTitle: { fontSize: 15, fontWeight: "800", color: ink },
  tierMeta: { fontSize: 12, color: pick("#000000", "#9DA49E"), marginTop: 2 },
  twoColumns: { flexDirection: "row", gap: 10 },
  segment: {
    flexDirection: "row",
    borderRadius: 16,
    backgroundColor: pick("#E6E8E2", "#1F2221"),
    padding: 4,
    gap: 4,
  },
  segmentButton: { flex: 1, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  segmentActive: { backgroundColor: pick("#fff", "#2C302E") },
  segmentText: { fontSize: 13, fontWeight: "800", color: pick("#000000", "#9DA49E") },
  segmentTextActive: { color: pick("#000000", "#F4F3EF") },
  saveSettings: {
    height: 54,
    borderRadius: 27,
    backgroundColor: pick(ink, "#F2672A"),
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
    borderBottomColor: pick("rgba(20,20,18,.07)", "rgba(255,255,255,0.09)"),
  },
  settingsRowLast: { borderBottomWidth: 0 },
  settingsIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsRowTitle: { fontSize: 15, fontWeight: "800", color: ink },
  settingsRowDetail: { fontSize: 12, lineHeight: 17, color: pick("#000000", "#9DA49E"), marginTop: 3 },
  dangerText: { color: pick("#B73B32", "#DC857F") },
  settingsFootnote: {
    fontSize: 12,
    lineHeight: 18,
    color: pick("#000000", "#9DA49E"),
    textAlign: "center",
    paddingHorizontal: 18,
    marginTop: -8,
    marginBottom: 14,
  },
});
