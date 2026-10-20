import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BadgeCheck, Check, Gem, Plus, QrCode, ScanLine, Star, Stamp, Trash2, Coffee } from "lucide-react-native";
import { colors, fonts } from "./theme";
import {
  PROGRAMMES,
  SHOP_KINDS,
  buildShopArgs,
  onboardingDefaults,
  programmeIdFor,
  type ProgrammeDraft,
  type ProgrammeId,
  type ShopKind,
  type ShopRpcArgs,
} from "@loyalty-loop/loyalty";
import { KeyboardAwareScrollView } from "./components/KeyboardAware";
import { Sheet } from "./components/Sheet";
import { showAlert } from "./components/AppAlert";
import { FALLBACK_COUNTRIES, guessCountry } from "./country";
import { findCountry } from "./money";
import { supabase } from "./supabase";

const { foreground: green, primary: orange, background: cream } = colors;
const BRAND_COLOR = "#8B7355";
const STEP_COUNT = 4;
const PROGRAMME_ORDER: ProgrammeId[] = ["stamps", "tiers", "points", "spend"];
const KIND_ICONS = { everyday: Coffee, style: Gem, premium: Star } as const;

export type OnboardingDestination = "tools" | "scan" | "home";

/** A shop that exists but has no rewards or levels yet (created before onboarding
 * was one transaction): only its rewards are asked, its programme is fixed. */
export type ResumeShop = { id: string; name: string; reward_model?: string | null; country_code?: string | null };

function moneyLabel(symbol: string, value: string) {
  const n = Number(String(value).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return `${symbol}0`;
  return `${symbol}${symbol.length > 1 ? " " : ""}${n.toLocaleString("en-GB")}`;
}

function PrimaryButton({ title, onPress, disabled, secondary, icon }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean; icon?: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, pressed && !disabled && { opacity: 0.72 }, disabled && { opacity: 0.5 }]}
    >
      {icon}
      <Text style={[styles.buttonText, secondary && { color: green }]}>{title}</Text>
    </Pressable>
  );
}

/** "What your customers will see": a small version of their card in the shop's colour. */
function CardPreview({ programme, name, draft, symbol }: { programme: ProgrammeId; name: string; draft: ProgrammeDraft; symbol: string }) {
  const first = draft.rewards[0];
  let body: React.ReactNode;
  if (programme === "stamps") {
    const total = Math.min(12, Math.max(1, Number(first?.amount) || 8));
    body = (
      <>
        <View style={styles.stampRow}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={[styles.stamp, i < 3 && styles.stampFilled]}>
              {i < 3 ? <Check size={12} color="#9DA49E" /> : null}
            </View>
          ))}
        </View>
        <Text style={styles.previewLine}>
          {first?.title || "Your reward"} after {first?.amount || "8"} stamps
        </Text>
      </>
    );
  } else if (programme === "tiers") {
    body = (
      <>
        <View style={styles.stampRow}>
          {draft.tiers.map((tier, i) => (
            <View key={i} style={[styles.tierPill, { backgroundColor: tier.colour || "#fff" }]}>
              <Text style={styles.tierPillText}>{tier.name || "Level"}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.previewLine}>
          {draft.tiers[1] ? `${moneyLabel(symbol, draft.tiers[1].amount)} to reach ${draft.tiers[1].name || "the next level"}` : "Spend to reach the next level"}
        </Text>
      </>
    );
  } else if (programme === "points") {
    body = (
      <>
        <Text style={styles.previewBig}>240 points</Text>
        <Text style={styles.previewLine}>{first ? `${first.title || "Your reward"} at ${first.amount} points` : "Swap points for rewards"}</Text>
      </>
    );
  } else {
    body = (
      <>
        <View style={styles.bar}>
          <View style={styles.barFill} />
        </View>
        <Text style={styles.previewLine}>{first ? `${first.title || "Your reward"} at ${moneyLabel(symbol, first.amount)} spent` : "Earn rewards as you spend"}</Text>
      </>
    );
  }
  return (
    <View style={styles.preview}>
      <Text style={styles.previewEyebrow}>WHAT YOUR CUSTOMERS WILL SEE</Text>
      <Text style={styles.previewName}>{name.trim() || "Your shop"}</Text>
      {body}
    </View>
  );
}

function Dots({ step }: { step: number }) {
  return (
    <View style={styles.dots} accessibilityLabel={`Step ${step + 1} of ${STEP_COUNT}`}>
      {Array.from({ length: STEP_COUNT }, (_, i) => (
        <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
      ))}
    </View>
  );
}

export function ShopOnboarding({ ownerId, resume, onFinish }: { ownerId: string; resume?: ResumeShop | null; onFinish: (destination: OnboardingDestination) => void }) {
  const resumeProgramme = resume ? programmeIdFor(resume.reward_model) : null;
  const [step, setStep] = useState(resume ? 2 : 0);
  const [kind, setKind] = useState<ShopKind | null>(null);
  const [programme, setProgramme] = useState<ProgrammeId>(resumeProgramme ?? "stamps");
  const [picking, setPicking] = useState(false);
  const [name, setName] = useState(resume?.name ?? "");
  // Guessed from the phone's time zone; the chip changes it. It sets the shop's currency.
  const [countryCode, setCountryCode] = useState(() => resume?.country_code ?? guessCountry(FALLBACK_COUNTRIES.map((c) => c.code)));
  const [draft, setDraft] = useState<ProgrammeDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const country = findCountry([], countryCode);
  const currency = { symbol: country.currency_symbol, scale: country.amount_scale };
  const activeProgramme = resumeProgramme ?? programme;

  useEffect(() => {
    if (step >= 2 && draft === null) setDraft(onboardingDefaults(activeProgramme, kind?.key ?? "everyday", currency));
  }, [step, draft]);

  const result = draft ? buildShopArgs(activeProgramme, draft) : null;

  function chooseKind(next: ShopKind) {
    setKind(next);
    setProgramme(next.programme);
    setDraft(null);
  }
  function chooseProgramme(id: ProgrammeId) {
    setProgramme(id);
    setDraft(null);
    setPicking(false);
  }
  const patchReward = (index: number, patch: Partial<ProgrammeDraft["rewards"][number]>) =>
    setDraft((d) => d && { ...d, rewards: d.rewards.map((r, i) => (i === index ? { ...r, ...patch } : r)) });
  const patchTier = (index: number, patch: Partial<ProgrammeDraft["tiers"][number]>) =>
    setDraft((d) => d && { ...d, tiers: d.tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)) });

  async function save(args: ShopRpcArgs) {
    if (resume) {
      if (args._programme === "tiers") {
        const { error } = await supabase
          .from("membership_tiers")
          .insert(args._tiers.map((tier, index) => ({ business_id: resume.id, ...tier, sort_order: index })));
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("reward_catalog").insert(
        args._rewards.map((reward, index) => ({
          business_id: resume.id,
          title: reward.title,
          description: reward.description || null,
          stamp_threshold: args._programme === "stamps" ? reward.stamp_threshold : args._programme === "spend" ? 10 : 1,
          spend_threshold_pence: reward.spend_threshold_pence ?? null,
          points_cost: reward.points_cost ?? null,
          sort_order: index,
        })),
      );
      if (error) throw error;
      return;
    }
    // One database call creates the shop, its programme and its rewards together,
    // so a failure can never leave a half-created shop.
    const { error } = await supabase.rpc("create_shop_with_programme", {
      _name: name.trim(),
      _category: kind?.category ?? "Retail",
      _country_code: country.code,
      _programme: args._programme,
      _brand_color: BRAND_COLOR,
      _stamps_required: args._stamps_required,
      _points_per_pound: args._points_per_pound,
      _rewards: args._rewards,
      _tiers: args._tiers,
    });
    if (error) throw error;
  }

  async function looksGood() {
    if (!result || !result.ok) {
      showAlert("Check your rewards", result && !result.ok ? result.message : "Please check the details.");
      return;
    }
    setSaving(true);
    try {
      await save(result.args);
      setDone(true);
      setStep(3);
    } catch (e) {
      showAlert("Could not set up your shop", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const symbol = currency.symbol;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Dots step={step} />

        {step === 0 && (
          <>
            <Text style={styles.hero}>What kind of{"\n"}shop is it?</Text>
            <Text style={styles.copy}>We'll set up the right kind of rewards for you.</Text>
            <View style={styles.stack}>
              {SHOP_KINDS.map((k) => {
                const Icon = KIND_ICONS[k.key];
                const active = kind?.key === k.key;
                return (
                  <Pressable key={k.key} onPress={() => chooseKind(k)} style={[styles.optionCard, active && styles.optionCardActive]}>
                    <Icon size={26} color={active ? "#fff" : orange} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionTitle, active && { color: "#fff" }]}>{k.title}</Text>
                      <Text style={[styles.optionBlurb, active && { color: "#fff" }]}>{k.examples}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {kind && (
              <View style={styles.suggestion}>
                <Text style={styles.suggestionTitle}>We suggest: {PROGRAMMES[programme].name}</Text>
                <Text style={styles.suggestionText}>{PROGRAMMES[programme].pitch}</Text>
                <Pressable onPress={() => setPicking(true)} hitSlop={8}>
                  <Text style={styles.link}>Change</Text>
                </Pressable>
              </View>
            )}
            <PrimaryButton title="Continue" disabled={!kind} onPress={() => setStep(1)} />
          </>
        )}

        {step === 1 && (
          <>
            <Text style={styles.hero}>What's your{"\n"}shop called?</Text>
            <Text style={styles.copy}>Customers will see this on their loyalty card.</Text>
            <TextInput keyboardAppearance="dark"
              style={styles.input}
              value={name}
              onChangeText={setName}
              maxLength={80}
              placeholder="e.g. Bean & Bird"
              placeholderTextColor="#6B726D"
              autoFocus
            />
            <View style={styles.chipRow}>
              <Text style={styles.chipLabel}>Based in</Text>
              {FALLBACK_COUNTRIES.map((c) => {
                const active = c.code === countryCode;
                return (
                  <Pressable
                    key={c.code}
                    onPress={() => {
                      setCountryCode(c.code);
                      setDraft(null);
                    }}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && { color: "#fff" }]}>{c.name}</Text>
                  </Pressable>
                );
              })}
            </View>
            <CardPreview programme={programme} name={name} draft={onboardingDefaults(programme, kind?.key ?? "everyday", currency)} symbol={symbol} />
            <PrimaryButton
              title="Continue"
              onPress={() => (name.trim() ? setStep(2) : showAlert("Add your shop name", "Customers will see this on their loyalty card."))}
            />
            <Pressable onPress={() => setStep(0)} style={styles.back}>
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          </>
        )}

        {step === 2 && draft && (
          <>
            <Text style={styles.hero}>{activeProgramme === "tiers" ? "Your membership\nlevels" : "Your rewards"}</Text>
            <Text style={styles.copy}>We've filled these in for you. Change anything, then tap Looks good.</Text>

            {activeProgramme === "tiers"
              ? draft.tiers.map((tier, index) => (
                  <View key={index} style={styles.editCard}>
                    <View style={styles.editHead}>
                      <View style={[styles.swatch, { backgroundColor: tier.colour }]} />
                      <Text style={styles.editTitle}>Level {index + 1}</Text>
                      {draft.tiers.length > 1 && (
                        <Pressable onPress={() => setDraft((d) => d && { ...d, tiers: d.tiers.filter((_, i) => i !== index) })} hitSlop={8} accessibilityLabel="Remove level">
                          <Trash2 size={18} color="#9DA49E" />
                        </Pressable>
                      )}
                    </View>
                    <Text style={styles.fieldLabel}>Name</Text>
                    <TextInput keyboardAppearance="dark" style={styles.input} value={tier.name} maxLength={40} onChangeText={(v) => patchTier(index, { name: v })} placeholderTextColor="#6B726D" />
                    <Text style={styles.fieldLabel}>Spend in a year ({symbol})</Text>
                    <TextInput keyboardAppearance="dark" style={styles.input} value={tier.amount} keyboardType="decimal-pad" onChangeText={(v) => patchTier(index, { amount: v.replace(/[^0-9.]/g, "") })} placeholderTextColor="#6B726D" />
                    <Text style={styles.fieldLabel}>Perks (one per line)</Text>
                    <TextInput keyboardAppearance="dark" style={[styles.input, { height: 92, textAlignVertical: "top" }]} value={tier.perks} multiline onChangeText={(v) => patchTier(index, { perks: v })} placeholderTextColor="#6B726D" />
                  </View>
                ))
              : draft.rewards.map((reward, index) => (
                  <View key={index} style={styles.editCard}>
                    <View style={styles.editHead}>
                      <Text style={styles.editTitle}>Reward {draft.rewards.length > 1 ? index + 1 : ""}</Text>
                      {draft.rewards.length > 1 && (
                        <Pressable onPress={() => setDraft((d) => d && { ...d, rewards: d.rewards.filter((_, i) => i !== index) })} hitSlop={8} accessibilityLabel="Remove reward">
                          <Trash2 size={18} color="#9DA49E" />
                        </Pressable>
                      )}
                    </View>
                    <Text style={styles.fieldLabel}>What do they get?</Text>
                    <TextInput keyboardAppearance="dark" style={styles.input} value={reward.title} maxLength={80} onChangeText={(v) => patchReward(index, { title: v })} placeholder="e.g. Free coffee" placeholderTextColor="#6B726D" />
                    <Text style={styles.fieldLabel}>
                      {activeProgramme === "stamps" ? "Stamps needed" : activeProgramme === "points" ? "Points needed" : `Customer spends (${symbol})`}
                    </Text>
                    <TextInput keyboardAppearance="dark" style={styles.input} value={reward.amount} keyboardType="decimal-pad" onChangeText={(v) => patchReward(index, { amount: v.replace(/[^0-9.]/g, "") })} placeholderTextColor="#6B726D" />
                  </View>
                ))}

            {(activeProgramme === "tiers" ? draft.tiers.length < 8 : draft.rewards.length < 10) && (
              <Pressable
                style={styles.addRow}
                onPress={() =>
                  setDraft((d) =>
                    d && (activeProgramme === "tiers"
                      ? { ...d, tiers: [...d.tiers, { name: "", amount: "", perks: "", colour: "#8F9BB3" }] }
                      : { ...d, rewards: [...d.rewards, { title: "", description: "", amount: "" }] }),
                  )
                }
              >
                <Plus size={18} color={orange} />
                <Text style={styles.link}>{activeProgramme === "tiers" ? "Add a level" : "Add another reward"}</Text>
              </Pressable>
            )}

            {activeProgramme === "points" && (
              <View style={styles.editCard}>
                <Text style={styles.fieldLabel}>Points earned for every {symbol}1 spent</Text>
                <TextInput keyboardAppearance="dark" style={styles.input} value={draft.pointsPerPound} keyboardType="number-pad" onChangeText={(v) => setDraft((d) => d && { ...d, pointsPerPound: v.replace(/[^0-9]/g, "") })} placeholderTextColor="#6B726D" />
              </View>
            )}

            <View style={{ marginTop: 18 }}>
              <CardPreview programme={activeProgramme} name={resume?.name ?? name} draft={draft} symbol={symbol} />
            </View>
            {result && !result.ok && <Text style={styles.problem}>{result.message}</Text>}
            <PrimaryButton title={saving ? "Setting up…" : "Looks good"} disabled={saving} onPress={looksGood} />
            {!resume && (
              <Pressable onPress={() => setStep(1)} style={styles.back}>
                <Text style={styles.backText}>Back</Text>
              </Pressable>
            )}
          </>
        )}

        {step === 3 && done && draft && (
          <>
            <View style={styles.liveBadge}>
              <Check size={32} color="#fff" />
            </View>
            <Text style={[styles.hero, { textAlign: "center" }]}>You're live!</Text>
            <Text style={[styles.copy, { textAlign: "center", marginBottom: 20 }]}>Customers can join {resume?.name ?? name} now. This is their card:</Text>
            <CardPreview programme={activeProgramme} name={resume?.name ?? name} draft={draft} symbol={symbol} />
            <View style={{ height: 18 }} />
            <PrimaryButton title="Print your QR poster" icon={<QrCode size={18} color="#fff" />} onPress={() => onFinish("tools")} />
            <PrimaryButton title="Scan your first customer" secondary icon={<ScanLine size={18} color={green} />} onPress={() => onFinish("scan")} />
            <Pressable onPress={() => onFinish("home")} style={styles.back}>
              <Text style={styles.backText}>Go to my dashboard</Text>
            </Pressable>
          </>
        )}
      </KeyboardAwareScrollView>

      <Sheet visible={picking} onClose={() => setPicking(false)} dragArea="full" sheetStyle={styles.pickerSheet}>
        <View style={styles.sheetBody}>
          <Text style={styles.sheetTitle}>Choose a programme</Text>
          {PROGRAMME_ORDER.map((id) => {
            const Icon = id === "stamps" ? Stamp : id === "tiers" ? Gem : id === "points" ? Star : BadgeCheck;
            const active = programme === id;
            return (
              <Pressable key={id} onPress={() => chooseProgramme(id)} style={[styles.optionCard, active && styles.optionCardActive]}>
                <Icon size={24} color={active ? "#fff" : orange} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, active && { color: "#fff" }]}>{id === "spend" ? "£ Spend rewards" : PROGRAMMES[id].name}</Text>
                  <Text style={[styles.optionBlurb, active && { color: "#fff" }]}>{PROGRAMMES[id].pitch}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: cream },
  content: { flexGrow: 1, padding: 24, paddingBottom: 48 },
  dots: { flexDirection: "row", gap: 8, marginTop: 6, marginBottom: 26 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#262A28" },
  dotActive: { width: 26, backgroundColor: orange },
  hero: { color: "#9DA49E", fontSize: 36, lineHeight: 42, letterSpacing: -1, fontFamily: fonts.nativeDisplay },
  copy: { color: "#9DA49E", fontSize: 16, lineHeight: 24, marginTop: 8 },
  stack: { gap: 12, marginTop: 22, marginBottom: 16 },
  optionCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#151716", borderRadius: 20, borderWidth: 2, borderColor: "#594426", padding: 18 },
  optionCardActive: { backgroundColor: orange, borderColor: orange },
  optionTitle: { color: "#9DA49E", fontSize: 17, fontWeight: "800" },
  optionBlurb: { color: "#9DA49E", fontSize: 13, marginTop: 2 },
  suggestion: { backgroundColor: "#362B17", borderRadius: 18, padding: 16, marginBottom: 18, gap: 4 },
  suggestionTitle: { color: "#9DA49E", fontSize: 15, fontWeight: "800" },
  suggestionText: { color: "#9DA49E", fontSize: 14, lineHeight: 20 },
  link: { color: orange, fontSize: 15, fontWeight: "800", marginTop: 4, textDecorationLine: "underline" },
  input: { backgroundColor: "#151716", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, color: "#9DA49E", fontSize: 16, marginTop: 6, borderWidth: 1, borderColor: "#594426" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 14, marginBottom: 20 },
  chipLabel: { color: "#9DA49E", fontSize: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.16)", backgroundColor: "#151716" },
  chipActive: { backgroundColor: orange, borderColor: orange },
  chipText: { color: "#9DA49E", fontWeight: "800", fontSize: 13 },
  editCard: { backgroundColor: "#151716", borderRadius: 18, padding: 16, marginTop: 14, gap: 2 },
  editHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  editTitle: { flex: 1, color: "#9DA49E", fontSize: 15, fontWeight: "800" },
  swatch: { width: 14, height: 14, borderRadius: 7 },
  fieldLabel: { color: "#9DA49E", fontSize: 13, fontWeight: "700", marginTop: 10 },
  addRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 },
  problem: { color: "#9DA49E", fontSize: 14, fontWeight: "700", marginTop: 12 },
  preview: { backgroundColor: BRAND_COLOR, borderRadius: 20, padding: 18 },
  previewEyebrow: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  previewName: { color: "#fff", fontSize: 22, fontFamily: fonts.nativeDisplay, marginTop: 4, marginBottom: 12 },
  previewLine: { color: "#fff", fontSize: 14, fontWeight: "700", marginTop: 6 },
  previewBig: { color: "#fff", fontSize: 30, fontWeight: "800" },
  stampRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  stamp: { width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  stampFilled: { backgroundColor: "#151716" },
  tierPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  tierPillText: { color: "#9DA49E", fontSize: 12, fontWeight: "800" },
  bar: { height: 10, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden" },
  barFill: { height: 10, width: "33%", borderRadius: 5, backgroundColor: "#151716" },
  button: { backgroundColor: "#F2672A", borderRadius: 999, minHeight: 54, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", padding: 15, marginTop: 16 },
  buttonSecondary: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: green },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 16, textAlign: "center" },
  back: { alignItems: "center", padding: 16 },
  backText: { color: "#9DA49E", fontSize: 15, fontWeight: "700" },
  liveBadge: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#3FA34D", alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 14 },
  sheetBody: { padding: 20, paddingBottom: 32, gap: 12 },
  pickerSheet: { backgroundColor: "#151716", borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  sheetTitle: { color: "#9DA49E", fontSize: 20, fontWeight: "800", marginBottom: 4 },
});
