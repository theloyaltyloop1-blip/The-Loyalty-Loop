import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  ArrowLeft,
  BadgeCheck,
  Bot,
  Camera,
  ChevronRight,
  Gift,
  Image as ImageIcon,
  LifeBuoy,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
} from "lucide-react-native";
import { supabase } from "./supabase";

const orange = "#E8703B";
const ink = "#20211E";
const muted = "#676A63";
const cream = "#F8EAD8";
const card = "#FFFDF8";

export type NativeOwnerPage =
  | "ai"
  | "branding"
  | "rewards"
  | "staff"
  | "support"
  | "tutorial";

export interface NativeBusiness {
  id: string;
  name: string;
  logo_url?: string | null;
  cover_url?: string | null;
  brand_color?: string;
}

interface PageProps {
  business: NativeBusiness;
  userId: string;
  onBack: () => void;
  onBusinessChanged: () => Promise<void>;
  preview?: boolean;
}

interface PeriodStats {
  newMembers: number;
  previousMembers: number;
  stamps: number;
  previousStamps: number;
  rewards: number;
  previousRewards: number;
  redeemed: number;
  previousRedeemed: number;
  totalMembers: number;
  totalStamps: number;
  totalRewards: number;
  totalRedeemed: number;
}

interface ResearchSource {
  url: string;
  title: string;
}
interface ResearchReport {
  report: string;
  sources: ResearchSource[];
}
interface CoachMessage {
  role: "user" | "assistant";
  content: string;
}
interface RewardItem {
  id: string;
  title: string;
  description: string | null;
  stamp_threshold: number;
  sort_order: number;
}
interface StaffMember {
  id: string;
  name: string;
  invited_email: string;
  status: "invited" | "active" | "revoked";
  can_scan_stamps: boolean;
  can_redeem_rewards: boolean;
  can_respond_reviews: boolean;
}
interface SupportRequest {
  id: string;
  subject: string;
  body: string;
  priority: "low" | "normal" | "high";
  status: "open" | "resolved";
  admin_response: string | null;
  created_at: string;
}

function PageHeader({
  title,
  eyebrow,
  onBack,
}: {
  title: string;
  eyebrow: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <ArrowLeft size={21} color={ink} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  busy = false,
  secondary = false,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  secondary?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        secondary && styles.secondaryButton,
        danger && styles.dangerButton,
        busy && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? ink : "#fff"} />
      ) : (
        <Text
          style={[
            styles.primaryButtonText,
            secondary && styles.secondaryButtonText,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function Section({ children }: { children: ReactNode }) {
  return <View style={styles.section}>{children}</View>;
}

function Field({
  value,
  onChangeText,
  placeholder,
  multiline = false,
  secureTextEntry = false,
  keyboardType,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "number-pad";
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#74776F"
      multiline={multiline}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
      textAlignVertical={multiline ? "top" : "center"}
      style={[styles.input, multiline && styles.textArea]}
    />
  );
}

function Metric({
  label,
  value,
  previous,
}: {
  label: string;
  value: number;
  previous?: number;
}) {
  const change =
    previous === undefined
      ? null
      : previous === 0
        ? value > 0
          ? null
          : 0
        : Math.round(((value - previous) / previous) * 100);
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {previous !== undefined ? (
        <Text
          style={[
            styles.metricChange,
            change !== null && change < 0 && styles.negative,
          ]}
        >
          {change === null
            ? "New activity"
            : `${change >= 0 ? "+" : ""}${change}% vs before`}
        </Text>
      ) : null}
    </View>
  );
}

async function getCount(
  table: string,
  businessId: string,
  column: string,
  from?: string,
  to?: string,
  notNull = false,
) {
  let query = supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);
  if (from) query = query.gte(column, from);
  if (to) query = query.lt(column, to);
  if (notNull) query = query.not(column, "is", null);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function fetchPeriodStats(
  businessId: string,
  period: 7 | 30 | 90,
): Promise<PeriodStats> {
  const now = new Date().toISOString();
  const current = new Date(Date.now() - period * 86400000).toISOString();
  const previous = new Date(Date.now() - period * 2 * 86400000).toISOString();
  const values = await Promise.all([
    getCount("memberships", businessId, "joined_at", current, now),
    getCount("memberships", businessId, "joined_at", previous, current),
    getCount("transactions", businessId, "created_at", current, now),
    getCount("transactions", businessId, "created_at", previous, current),
    getCount("rewards", businessId, "created_at", current, now),
    getCount("rewards", businessId, "created_at", previous, current),
    getCount("rewards", businessId, "redeemed_at", current, now, true),
    getCount("rewards", businessId, "redeemed_at", previous, current, true),
    getCount("memberships", businessId, "joined_at"),
    getCount("transactions", businessId, "created_at"),
    getCount("rewards", businessId, "created_at"),
    getCount("rewards", businessId, "redeemed_at", undefined, undefined, true),
  ]);
  return {
    newMembers: values[0],
    previousMembers: values[1],
    stamps: values[2],
    previousStamps: values[3],
    rewards: values[4],
    previousRewards: values[5],
    redeemed: values[6],
    previousRedeemed: values[7],
    totalMembers: values[8],
    totalStamps: values[9],
    totalRewards: values[10],
    totalRedeemed: values[11],
  };
}

function AiAnalyticsPage({ business, onBack, preview = false }: PageProps) {
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [stats, setStats] = useState<PeriodStats | null>(null);
  const [summary, setSummary] = useState("");
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [coachInput, setCoachInput] = useState("");
  const [coachBusy, setCoachBusy] = useState(false);

  const load = useCallback(async () => {
    if (preview) {
      setStats({
        newMembers: 18,
        previousMembers: 13,
        stamps: 84,
        previousStamps: 67,
        rewards: 12,
        previousRewards: 8,
        redeemed: 9,
        previousRedeemed: 6,
        totalMembers: 148,
        totalStamps: 624,
        totalRewards: 57,
        totalRedeemed: 43,
      });
      setSummary(
        "More customers joined and used their loyalty cards than in the previous period. Reward redemptions are also rising, so keep the scan prompt visible at the till and mention the next reward after each visit.",
      );
      setReport({
        report:
          "Customers consistently praise the friendly service and quality. The clearest opportunity is to make seasonal offers more visible and give occasional customers a simple reason to return within seven days.",
        sources: [],
      });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [nextStats, latest] = await Promise.all([
        fetchPeriodStats(business.id, period),
        supabase
          .from("business_web_research")
          .select("report,sources")
          .eq("business_id", business.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      setStats(nextStats);
      if (latest.error) throw latest.error;
      setReport(latest.data as ResearchReport | null);
    } catch (error) {
      Alert.alert(
        "Could not load analytics",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [business.id, period, preview]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generateSummary() {
    if (!stats) return;
    setAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "analytics-summary",
        {
          body: {
            business_id: business.id,
            period,
            stats: { period: stats, totals: stats },
          },
        },
      );
      if (error) throw error;
      setSummary(
        (data as { summary?: string }).summary || "No summary was returned.",
      );
    } catch (error) {
      Alert.alert(
        "AI summary unavailable",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setAiBusy(false);
    }
  }

  async function researchShop() {
    setReportBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "deep-business-report",
        { body: { business_id: business.id } },
      );
      if (error) throw error;
      const result = data as ResearchReport & { error?: string };
      if (result.error) throw new Error(result.error);
      setReport(result);
    } catch (error) {
      Alert.alert(
        "Research unavailable",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setReportBusy(false);
    }
  }

  async function askCoach() {
    const prompt = coachInput.trim();
    if (!prompt || coachBusy) return;
    const next: CoachMessage[] = [
      ...messages,
      { role: "user", content: prompt },
    ];
    setMessages(next);
    setCoachInput("");
    setCoachBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "business-coach-chat",
        {
          body: {
            business_id: business.id,
            messages: next,
            stats: { period: stats, web_research: report?.report },
          },
        },
      );
      if (error) throw error;
      setMessages([
        ...next,
        {
          role: "assistant",
          content:
            (data as { reply?: string }).reply ||
            "I could not generate a reply.",
        },
      ]);
    } catch (error) {
      Alert.alert(
        "Coach unavailable",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setCoachBusy(false);
    }
  }

  return (
    <View>
      <PageHeader
        title="AI & detailed analytics"
        eyebrow="BUSINESS INTELLIGENCE"
        onBack={onBack}
      />
      <View style={styles.segment}>
        {([7, 30, 90] as const).map((value) => (
          <Pressable
            key={value}
            onPress={() => setPeriod(value)}
            style={[
              styles.segmentItem,
              period === value && styles.segmentActive,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                period === value && styles.segmentTextActive,
              ]}
            >
              {value} days
            </Text>
          </Pressable>
        ))}
      </View>
      {loading || !stats ? (
        <ActivityIndicator color={orange} style={styles.loader} />
      ) : (
        <>
          <Text style={styles.sectionTitle}>What changed</Text>
          <View style={styles.metrics}>
            <Metric
              label="New members"
              value={stats.newMembers}
              previous={stats.previousMembers}
            />
            <Metric
              label="Activity"
              value={stats.stamps}
              previous={stats.previousStamps}
            />
            <Metric
              label="Rewards earned"
              value={stats.rewards}
              previous={stats.previousRewards}
            />
            <Metric
              label="Redeemed"
              value={stats.redeemed}
              previous={stats.previousRedeemed}
            />
          </View>
          <Section>
            <View style={styles.iconHeading}>
              <Sparkles size={20} color={orange} />
              <Text style={styles.cardTitle}>Plain-English summary</Text>
            </View>
            {summary ? (
              <Text style={styles.body}>{summary}</Text>
            ) : (
              <Text style={styles.muted}>
                Generate a simple explanation of the last {period} days.
              </Text>
            )}
            <PrimaryButton
              label={summary ? "Regenerate summary" : "Generate summary"}
              onPress={generateSummary}
              busy={aiBusy}
            />
          </Section>
          <Section>
            <View style={styles.iconHeading}>
              <RefreshCw size={20} color={orange} />
              <Text style={styles.cardTitle}>Deep business report</Text>
            </View>
            <Text style={styles.muted}>
              Research your shop’s reviews and online presence, then turn them
              into practical suggestions.
            </Text>
            {report ? (
              <>
                <Text style={styles.report}>{report.report}</Text>
                {report.sources.map((source) => (
                  <Pressable
                    key={source.url}
                    onPress={() => Linking.openURL(source.url)}
                    style={styles.source}
                  >
                    <Text numberOfLines={1} style={styles.sourceText}>
                      {source.title}
                    </Text>
                    <ChevronRight size={16} color={muted} />
                  </Pressable>
                ))}
              </>
            ) : null}
            <PrimaryButton
              label={report ? "Refresh online research" : "Research my shop"}
              onPress={researchShop}
              busy={reportBusy}
            />
          </Section>
          <Section>
            <View style={styles.iconHeading}>
              <Bot size={20} color={orange} />
              <Text style={styles.cardTitle}>AI business coach</Text>
            </View>
            <Text style={styles.muted}>
              Ask about repeat visits, rewards, customer activity or what to
              improve next.
            </Text>
            <View style={styles.messages}>
              {messages.length ? (
                messages.map((message, index) => (
                  <View
                    key={`${message.role}-${index}`}
                    style={[
                      styles.message,
                      message.role === "user"
                        ? styles.userMessage
                        : styles.coachMessage,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        message.role === "user" && { color: "#fff" },
                      ]}
                    >
                      {message.content}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.empty}>
                  Try: “How can I get more customers to return?”
                </Text>
              )}
            </View>
            <View style={styles.coachRow}>
              <TextInput
                value={coachInput}
                onChangeText={setCoachInput}
                placeholder="Ask the coach…"
                placeholderTextColor="#74776F"
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
              />
              <Pressable
                accessibilityLabel="Send to coach"
                onPress={askCoach}
                style={({ pressed }) => [
                  styles.sendButton,
                  pressed && styles.pressed,
                ]}
              >
                {coachBusy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Send size={19} color="#fff" />
                )}
              </Pressable>
            </View>
          </Section>
          <Text style={styles.sectionTitle}>All-time totals</Text>
          <View style={styles.metrics}>
            <Metric label="Members" value={stats.totalMembers} />
            <Metric label="Activity" value={stats.totalStamps} />
            <Metric label="Rewards" value={stats.totalRewards} />
            <Metric label="Redeemed" value={stats.totalRedeemed} />
          </View>
        </>
      )}
    </View>
  );
}

function BrandingPage({
  business,
  onBack,
  onBusinessChanged,
  preview = false,
}: PageProps) {
  const [busy, setBusy] = useState<"logo_url" | "cover_url" | null>(null);
  async function choose(field: "logo_url" | "cover_url") {
    if (preview)
      return Alert.alert(
        "Preview mode",
        "On a signed-in phone, this opens the photo library and uploads the selected image.",
      );
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted)
      return Alert.alert(
        "Photos permission needed",
        "Allow photo access to choose your shop image.",
      );
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: field === "logo_url" ? [1, 1] : [16, 9],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024)
      return Alert.alert(
        "Image is too large",
        "Choose an image smaller than 5MB.",
      );
    setBusy(field);
    try {
      const bucket = field === "logo_url" ? "logos" : "covers";
      const rawExtension =
        (asset.fileName || asset.uri).split(".").pop()?.toLowerCase() || "jpg";
      const extension = ["png", "jpg", "jpeg", "webp", "gif"].includes(
        rawExtension,
      )
        ? rawExtension
        : "jpg";
      const path = `${business.id}/${field}-${Date.now()}.${extension}`;
      const arrayBuffer = await fetch(asset.uri).then((response) =>
        response.arrayBuffer(),
      );
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, arrayBuffer, {
          contentType: asset.mimeType || "image/jpeg",
          cacheControl: "3600",
          upsert: false,
        });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      const { error: updateError } = await supabase
        .from("businesses")
        .update({ [field]: data.publicUrl })
        .eq("id", business.id);
      if (updateError) throw updateError;
      await onBusinessChanged();
      Alert.alert(
        "Image updated",
        field === "logo_url"
          ? "Your new logo is live."
          : "Your new cover image is live.",
      );
    } catch (error) {
      Alert.alert(
        "Upload failed",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <View>
      <PageHeader
        title="Logo & cover images"
        eyebrow="SHOP BRANDING"
        onBack={onBack}
      />
      <Section>
        <Text style={styles.cardTitle}>Storefront preview</Text>
        <View
          style={[
            styles.coverPreview,
            { backgroundColor: business.brand_color || orange },
          ]}
        >
          {business.cover_url ? (
            <Image
              source={{ uri: business.cover_url }}
              style={styles.coverImage}
            />
          ) : (
            <ImageIcon size={30} color="#fff" />
          )}
          <View style={styles.logoPreview}>
            {business.logo_url ? (
              <Image
                source={{ uri: business.logo_url }}
                style={styles.logoImage}
              />
            ) : (
              <Text style={styles.logoLetter}>{business.name.charAt(0)}</Text>
            )}
          </View>
        </View>
        <Text style={styles.previewName}>{business.name}</Text>
      </Section>
      <Section>
        <View style={styles.iconHeading}>
          <Camera size={20} color={orange} />
          <Text style={styles.cardTitle}>Shop logo</Text>
        </View>
        <Text style={styles.muted}>
          Used on your listing, loyalty cards, news and rewards. A square image
          works best.
        </Text>
        <PrimaryButton
          label={business.logo_url ? "Replace logo" : "Choose logo"}
          onPress={() => choose("logo_url")}
          busy={busy === "logo_url"}
        />
      </Section>
      <Section>
        <View style={styles.iconHeading}>
          <ImageIcon size={20} color={orange} />
          <Text style={styles.cardTitle}>Cover image</Text>
        </View>
        <Text style={styles.muted}>
          Shown across the top of your shop page. A wide landscape image works
          best.
        </Text>
        <PrimaryButton
          label={
            business.cover_url ? "Replace cover image" : "Choose cover image"
          }
          onPress={() => choose("cover_url")}
          busy={busy === "cover_url"}
        />
      </Section>
    </View>
  );
}

function RewardsPage({ business, onBack, preview = false }: PageProps) {
  const [items, setItems] = useState<RewardItem[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [threshold, setThreshold] = useState("10");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (preview) {
      setItems([
        {
          id: "preview-reward",
          title: "Free coffee",
          description: "Any regular hot drink",
          stamp_threshold: 10,
          sort_order: 0,
        },
      ]);
      return;
    }
    const { data, error } = await supabase
      .from("reward_catalog")
      .select("*")
      .eq("business_id", business.id)
      .order("sort_order");
    if (error) return Alert.alert("Could not load rewards", error.message);
    setItems((data || []) as RewardItem[]);
  }, [business.id, preview]);
  useEffect(() => {
    void load();
  }, [load]);
  async function add() {
    if (!title.trim())
      return Alert.alert("Add a reward name", "For example: Free coffee.");
    setBusy(true);
    const { error } = await supabase.from("reward_catalog").insert({
      business_id: business.id,
      title: title.trim(),
      description: description.trim() || null,
      stamp_threshold: Math.max(1, Number(threshold) || 1),
      sort_order: items.length,
    });
    setBusy(false);
    if (error) return Alert.alert("Could not add reward", error.message);
    setTitle("");
    setDescription("");
    setThreshold("10");
    void load();
  }
  function remove(item: RewardItem) {
    Alert.alert("Delete reward?", item.title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from("reward_catalog")
            .delete()
            .eq("id", item.id);
          if (error) Alert.alert("Could not delete reward", error.message);
          else void load();
        },
      },
    ]);
  }
  return (
    <View>
      <PageHeader
        title="Rewards catalogue"
        eyebrow="LOYALTY PROGRAMME"
        onBack={onBack}
      />
      <Section>
        <View style={styles.iconHeading}>
          <Gift size={20} color={orange} />
          <Text style={styles.cardTitle}>Add a reward</Text>
        </View>
        <Field
          value={title}
          onChangeText={setTitle}
          placeholder="Reward name"
        />
        <Field
          value={description}
          onChangeText={setDescription}
          placeholder="Short description (optional)"
          multiline
        />
        <Field
          value={threshold}
          onChangeText={setThreshold}
          placeholder="Points or stamps required"
          keyboardType="number-pad"
        />
        <PrimaryButton label="Add reward" onPress={add} busy={busy} />
      </Section>
      <Text style={styles.sectionTitle}>Current rewards</Text>
      {items.length ? (
        items.map((item) => (
          <View key={item.id} style={styles.listCard}>
            <View style={styles.listIcon}>
              <Gift size={19} color={orange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.listTitle}>{item.title}</Text>
              <Text style={styles.muted}>
                {item.stamp_threshold} required
                {item.description ? ` · ${item.description}` : ""}
              </Text>
            </View>
            <Pressable
              accessibilityLabel={`Delete ${item.title}`}
              onPress={() => remove(item)}
              style={styles.iconButton}
            >
              <Trash2 size={18} color="#B4433A" />
            </Pressable>
          </View>
        ))
      ) : (
        <Text style={styles.empty}>No reward tiers yet.</Text>
      )}
    </View>
  );
}

function PermissionToggle({
  label,
  value,
  onPress,
}: {
  label: string;
  value: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.permissionRow}>
      <Text style={styles.permissionLabel}>{label}</Text>
      <View style={[styles.toggle, value && styles.toggleOn]}>
        <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
      </View>
    </Pressable>
  );
}

function StaffPage({ business, onBack, preview = false }: PageProps) {
  const [items, setItems] = useState<StaffMember[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState({
    can_scan_stamps: true,
    can_redeem_rewards: true,
    can_respond_reviews: false,
  });
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (preview) {
      setItems([
        {
          id: "preview-staff",
          name: "Jamie Taylor",
          invited_email: "jamie@example.com",
          status: "active",
          can_scan_stamps: true,
          can_redeem_rewards: true,
          can_respond_reviews: false,
        },
      ]);
      return;
    }
    const { data, error } = await supabase
      .from("staff_members")
      .select("*")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false });
    if (error) return Alert.alert("Could not load staff", error.message);
    setItems((data || []) as StaffMember[]);
  }, [business.id, preview]);
  useEffect(() => {
    void load();
  }, [load]);
  async function invite() {
    if (!name.trim() || !email.trim() || password.length < 8)
      return Alert.alert(
        "Check the details",
        "Add a name, email and temporary password of at least 8 characters.",
      );
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-staff-account",
        {
          body: {
            business_id: business.id,
            email: email.trim(),
            name: name.trim(),
            password,
            permissions,
          },
        },
      );
      if (error) throw error;
      const result = data as { error?: string };
      if (result.error) throw new Error(result.error);
      setName("");
      setEmail("");
      setPassword("");
      await load();
      Alert.alert(
        "Staff access ready",
        "They can now sign in to the business app.",
      );
    } catch (error) {
      Alert.alert(
        "Could not create staff access",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function updatePermission(
    item: StaffMember,
    key: "can_scan_stamps" | "can_redeem_rewards" | "can_respond_reviews",
  ) {
    const { error } = await supabase
      .from("staff_members")
      .update({ [key]: !item[key] })
      .eq("id", item.id);
    if (error) Alert.alert("Could not update permission", error.message);
    else void load();
  }
  async function changeStatus(item: StaffMember) {
    const status = item.status === "revoked" ? "active" : "revoked";
    const { error } = await supabase
      .from("staff_members")
      .update({ status })
      .eq("id", item.id);
    if (error) Alert.alert("Could not update staff access", error.message);
    else void load();
  }
  return (
    <View>
      <PageHeader
        title="Staff & permissions"
        eyebrow="YOUR TEAM"
        onBack={onBack}
      />
      <Section>
        <View style={styles.iconHeading}>
          <UserPlus size={20} color={orange} />
          <Text style={styles.cardTitle}>Add a staff member</Text>
        </View>
        <Field value={name} onChangeText={setName} placeholder="Full name" />
        <Field
          value={email}
          onChangeText={setEmail}
          placeholder="Email address"
          keyboardType="email-address"
        />
        <Field
          value={password}
          onChangeText={setPassword}
          placeholder="Temporary password"
          secureTextEntry
        />
        <PermissionToggle
          label="Scan and award progress"
          value={permissions.can_scan_stamps}
          onPress={() =>
            setPermissions((current) => ({
              ...current,
              can_scan_stamps: !current.can_scan_stamps,
            }))
          }
        />
        <PermissionToggle
          label="Redeem rewards"
          value={permissions.can_redeem_rewards}
          onPress={() =>
            setPermissions((current) => ({
              ...current,
              can_redeem_rewards: !current.can_redeem_rewards,
            }))
          }
        />
        <PermissionToggle
          label="Respond to reviews"
          value={permissions.can_respond_reviews}
          onPress={() =>
            setPermissions((current) => ({
              ...current,
              can_respond_reviews: !current.can_respond_reviews,
            }))
          }
        />
        <PrimaryButton
          label="Create staff access"
          onPress={invite}
          busy={busy}
        />
      </Section>
      <Text style={styles.sectionTitle}>Team members</Text>
      {items.length ? (
        items.map((item) => (
          <Section key={item.id}>
            <View style={styles.staffHeading}>
              <View style={styles.listIcon}>
                <ShieldCheck size={19} color={orange} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{item.name}</Text>
                <Text style={styles.muted}>{item.invited_email}</Text>
              </View>
              <Text
                style={[
                  styles.status,
                  item.status === "revoked" && styles.statusRevoked,
                ]}
              >
                {item.status.toUpperCase()}
              </Text>
            </View>
            <PermissionToggle
              label="Scan and award"
              value={item.can_scan_stamps}
              onPress={() => updatePermission(item, "can_scan_stamps")}
            />
            <PermissionToggle
              label="Redeem rewards"
              value={item.can_redeem_rewards}
              onPress={() => updatePermission(item, "can_redeem_rewards")}
            />
            <PermissionToggle
              label="Respond to reviews"
              value={item.can_respond_reviews}
              onPress={() => updatePermission(item, "can_respond_reviews")}
            />
            <PrimaryButton
              label={
                item.status === "revoked" ? "Restore access" : "Revoke access"
              }
              onPress={() => changeStatus(item)}
              secondary={item.status === "revoked"}
              danger={item.status !== "revoked"}
            />
          </Section>
        ))
      ) : (
        <Text style={styles.empty}>No staff members yet.</Text>
      )}
    </View>
  );
}

function SupportPage({ business, userId, onBack, preview = false }: PageProps) {
  const [items, setItems] = useState<SupportRequest[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (preview) {
      setItems([
        {
          id: "preview-support",
          subject: "Poster printing question",
          body: "Can you help me choose the best poster size?",
          priority: "normal",
          status: "resolved",
          admin_response:
            "A4 works best beside the till. You can print it directly from Growth tools.",
          created_at: new Date().toISOString(),
        },
      ]);
      return;
    }
    const { data, error } = await supabase
      .from("support_requests")
      .select("*")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false });
    if (error) return Alert.alert("Could not load support", error.message);
    setItems((data || []) as SupportRequest[]);
  }, [business.id, preview]);
  useEffect(() => {
    void load();
  }, [load]);
  async function submit() {
    if (!subject.trim() || !body.trim())
      return Alert.alert(
        "Add some detail",
        "Enter a subject and explain what you need help with.",
      );
    setBusy(true);
    const { error } = await supabase.from("support_requests").insert({
      business_id: business.id,
      user_id: userId,
      subject: subject.trim(),
      body: body.trim(),
      priority,
    });
    setBusy(false);
    if (error) return Alert.alert("Could not send request", error.message);
    setSubject("");
    setBody("");
    await load();
    Alert.alert(
      "Request sent",
      "The Loyalty Loop team can now see it in the access panel.",
    );
  }
  return (
    <View>
      <PageHeader
        title="Help & support"
        eyebrow="HELP CENTRE"
        onBack={onBack}
      />
      <Section>
        <View style={styles.iconHeading}>
          <LifeBuoy size={20} color={orange} />
          <Text style={styles.cardTitle}>New support request</Text>
        </View>
        <Field
          value={subject}
          onChangeText={setSubject}
          placeholder="What do you need help with?"
        />
        <View style={styles.segment}>
          {(["low", "normal", "high"] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => setPriority(value)}
              style={[
                styles.segmentItem,
                priority === value && styles.segmentActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  priority === value && styles.segmentTextActive,
                ]}
              >
                {value}
              </Text>
            </Pressable>
          ))}
        </View>
        <Field
          value={body}
          onChangeText={setBody}
          placeholder="Give us as much detail as you can…"
          multiline
        />
        <PrimaryButton label="Send request" onPress={submit} busy={busy} />
      </Section>
      <Text style={styles.sectionTitle}>Your requests</Text>
      {items.length ? (
        items.map((item) => (
          <View key={item.id} style={styles.listCard}>
            <View style={{ flex: 1 }}>
              <View style={styles.requestHeading}>
                <Text style={styles.listTitle}>{item.subject}</Text>
                <Text
                  style={[
                    styles.status,
                    item.status === "resolved" && styles.statusResolved,
                  ]}
                >
                  {item.status.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.body}>{item.body}</Text>
              {item.admin_response ? (
                <View style={styles.reply}>
                  <Text style={styles.replyTitle}>Loyalty Loop reply</Text>
                  <Text style={styles.body}>{item.admin_response}</Text>
                </View>
              ) : null}
              <Text style={styles.date}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.empty}>No support requests yet.</Text>
      )}
    </View>
  );
}

function TutorialPage({ business, onBack }: PageProps) {
  const steps = [
    ["1", "Finish your shop", "Add your description, address, logo and cover image in Settings so customers recognise you."],
    ["2", "Create rewards", "Open Rewards catalogue and add what customers can unlock, such as a free coffee after 10 stamps."],
    ["3", "Invite customers", "Print your QR poster from the web dashboard or ask customers to find your shop in The Loyalty Loop."],
    ["4", "Award progress", "Open Stamps, scan the customer's QR code or enter their manual code, choose the amount, then award it."],
    ["5", "Keep people coming back", "Use News for updates, Analytics for trends, and Reviews to respond to customer feedback."],
  ] as const;

  return (
    <View>
      <PageHeader title="Getting started" eyebrow="BUSINESS GUIDE" onBack={onBack} />
      <Section>
        <View style={styles.iconHeading}>
          <Sparkles size={20} color={orange} />
          <Text style={styles.cardTitle}>Welcome to {business.name}</Text>
        </View>
        <Text style={styles.body}>Follow these five steps to get your loyalty programme live and use it confidently at the counter.</Text>
      </Section>
      {steps.map(([number, title, body]) => (
        <Section key={number}>
          <View style={styles.tutorialRow}>
            <View style={styles.tutorialNumber}><Text style={styles.tutorialNumberText}>{number}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{title}</Text>
              <Text style={styles.body}>{body}</Text>
            </View>
          </View>
        </Section>
      ))}
    </View>
  );
}

export function NativeOwnerPageView({
  page,
  ...props
}: PageProps & { page: NativeOwnerPage }) {
  const component = useMemo(
    () =>
      ({
        ai: AiAnalyticsPage,
        branding: BrandingPage,
        rewards: RewardsPage,
        staff: StaffPage,
        support: SupportPage,
        tutorial: TutorialPage,
      })[page],
    [page],
  );
  const Component = component;
  return <Component {...props} />;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 22,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: "#30312D",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: card,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "900",
    color: muted,
  },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "900", color: ink },
  section: {
    backgroundColor: card,
    borderWidth: 1.5,
    borderColor: "#30312D",
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: ink,
    marginTop: 6,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: "900", color: ink, flex: 1 },
  iconHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 10,
  },
  tutorialRow: { flexDirection: "row", gap: 13, alignItems: "flex-start" },
  tutorialNumber: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#F7D9CB", alignItems: "center", justifyContent: "center" },
  tutorialNumberText: { color: "#8C3820", fontWeight: "900" },
  body: { color: "#444740", lineHeight: 21, fontSize: 14 },
  muted: { color: muted, lineHeight: 20, fontSize: 14 },
  primaryButton: {
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: ink,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    shadowColor: ink,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: ink,
  },
  dangerButton: { backgroundColor: "#B4433A" },
  primaryButtonText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  secondaryButtonText: { color: ink },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.85 },
  disabled: { opacity: 0.55 },
  input: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#C9C3B8",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    color: ink,
    fontSize: 15,
    marginBottom: 10,
  },
  textArea: { minHeight: 105, paddingTop: 14 },
  segment: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 4,
    backgroundColor: "#E9E0D2",
    marginBottom: 16,
  },
  segmentItem: {
    flex: 1,
    minHeight: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: { backgroundColor: ink },
  segmentText: {
    textTransform: "capitalize",
    color: muted,
    fontWeight: "800",
    fontSize: 13,
  },
  segmentTextActive: { color: "#fff" },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  metric: {
    width: "48%",
    minHeight: 118,
    borderWidth: 1.5,
    borderColor: "#30312D",
    borderRadius: 19,
    backgroundColor: card,
    padding: 14,
    marginBottom: 12,
  },
  metricValue: { fontSize: 29, fontWeight: "900", color: ink },
  metricLabel: { color: muted, fontWeight: "700", fontSize: 12, marginTop: 3 },
  metricChange: {
    color: "#2D7A43",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 8,
  },
  negative: { color: "#B4433A" },
  loader: { marginVertical: 50 },
  report: { marginTop: 14, color: "#353831", fontSize: 14, lineHeight: 21 },
  source: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 42,
    borderRadius: 13,
    backgroundColor: cream,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  sourceText: { color: ink, fontWeight: "700", fontSize: 12, flex: 1 },
  messages: { gap: 8, marginTop: 14, marginBottom: 12 },
  message: { maxWidth: "88%", borderRadius: 15, padding: 11 },
  userMessage: { backgroundColor: orange, alignSelf: "flex-end" },
  coachMessage: { backgroundColor: cream, alignSelf: "flex-start" },
  messageText: { color: ink, lineHeight: 19, fontSize: 14 },
  coachRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: orange,
    alignItems: "center",
    justifyContent: "center",
  },
  coverPreview: {
    height: 155,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    overflow: "hidden",
  },
  coverImage: { width: "100%", height: "100%" },
  logoPreview: {
    position: "absolute",
    left: 16,
    bottom: 12,
    width: 58,
    height: 58,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: "#fff",
    backgroundColor: cream,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: { width: "100%", height: "100%" },
  logoLetter: { fontSize: 23, fontWeight: "900", color: ink },
  previewName: { fontSize: 20, fontWeight: "900", color: ink, marginTop: 13 },
  listCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    backgroundColor: card,
    borderWidth: 1.5,
    borderColor: "#30312D",
    borderRadius: 20,
    padding: 15,
    marginBottom: 11,
  },
  listIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: cream,
    alignItems: "center",
    justifyContent: "center",
  },
  listTitle: { color: ink, fontSize: 16, fontWeight: "900" },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { color: muted, textAlign: "center", paddingVertical: 24 },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 46,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#D6D0C5",
  },
  permissionLabel: { flex: 1, color: ink, fontSize: 14, fontWeight: "700" },
  toggle: {
    width: 46,
    height: 27,
    borderRadius: 14,
    backgroundColor: "#CCC7BE",
    padding: 3,
  },
  toggleOn: { backgroundColor: orange },
  toggleKnob: {
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: "#fff",
  },
  toggleKnobOn: { marginLeft: 19 },
  staffHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  status: {
    borderRadius: 999,
    backgroundColor: "#F2D8C8",
    color: "#9A4522",
    paddingHorizontal: 8,
    paddingVertical: 5,
    overflow: "hidden",
    fontWeight: "900",
    fontSize: 9,
  },
  statusRevoked: { backgroundColor: "#EFE1DF", color: "#9B3C35" },
  statusResolved: { backgroundColor: "#DDECDD", color: "#26713C" },
  requestHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  reply: {
    borderLeftWidth: 3,
    borderLeftColor: orange,
    paddingLeft: 11,
    marginTop: 13,
  },
  replyTitle: { color: ink, fontWeight: "900", marginBottom: 4 },
  date: { color: muted, fontSize: 11, marginTop: 12 },
});
