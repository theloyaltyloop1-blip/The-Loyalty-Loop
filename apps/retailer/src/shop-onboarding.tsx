import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BadgeCheck, Check, Gem, Plus, QrCode, ScanLine, Sparkles, Star, Stamp, Trash2, Coffee } from "lucide-react-native";
import Storage from "expo-sqlite/kv-store";
import { Whirl } from "./Whirl";
import { colors, fonts, schemeColor, themed } from "@loyalty-loop/design-tokens";
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
import { FALLBACK_COUNTRIES, guessCountry, selectableCountries } from "./country";
import { findCountry } from "./money";
import { supabase } from "./supabase";
import type { ProgrammeRules } from "@loyalty-loop/loyalty/programme-rules";
import { ProgrammeBuilder, RulesCard } from "./ProgrammeBuilder";
import { useBackStep } from "./back-steps";


const BRAND_COLOR = "#8B7355";
const STEP_COUNT = 4;
const PROGRAMME_ORDER: ProgrammeId[] = ["stamps", "tiers", "points", "spend"];
const KIND_ICONS = { everyday: Coffee, style: Gem, premium: Star } as const;

export type OnboardingDestination = "tools" | "scan" | "home";

const WEB_ORIGIN = "https://www.the-loyalty-loop.com";
// Steps: 0 kind, 1 name, 2 rewards, 3 live. 4 is "Save your shop" (an account),
// shown only to someone who started without one.
const ACCOUNT_STEP = 4;

/** A shop designed before the owner had an account. Kept on the phone so it
 * survives sign-up (and an email confirmation), then created as soon as they're in. */
type PendingShop = {
  kindKey: ShopKind["key"] | null;
  programme: ProgrammeId;
  name: string;
  countryCode: string;
  draft: ProgrammeDraft | null;
  custom: boolean;
};
const PENDING_KEY = "loyalty-loop:pending-shop:v1";

function readPendingShop(): PendingShop | null {
  try {
    const raw = Storage.getItemSync(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingShop;
    return typeof parsed.name === "string" && parsed.programme ? parsed : null;
  } catch {
    return null;
  }
}
function writePendingShop(shop: PendingShop) {
  try {
    Storage.setItemSync(PENDING_KEY, JSON.stringify(shop));
  } catch {
    // Storage unavailable: they'd just answer the questions again after signing in.
  }
}
export function clearPendingShop() {
  try {
    Storage.removeItemSync(PENDING_KEY);
  } catch {
    // nothing saved
  }
}

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
      <Text style={[styles.buttonText, secondary && { color: colors.foreground }]}>{title}</Text>
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
              {i < 3 ? <Check size={12} color={schemeColor("#000", 'fg')} /> : null}
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
            <View key={i} style={[styles.tierPill, { backgroundColor: tier.colour || schemeColor("#fff", 'bg') }]}>
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
      <Text style={styles.previewEyebrow}>What your customers will see</Text>
      <Text style={styles.previewName}>{name.trim() || "Your shop"}</Text>
      {body}
    </View>
  );
}

function Dots({ step: raw }: { step: number }) {
  if (raw === 3) return null;
  const step = raw === ACCOUNT_STEP ? STEP_COUNT - 1 : raw;
  return (
    <View style={styles.progress} accessibilityLabel={`Step ${step + 1} of ${STEP_COUNT}`}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((step + 1) / STEP_COUNT) * 100}%` }]} />
      </View>
      <Text style={styles.progressText}>Step {step + 1} of {STEP_COUNT}</Text>
    </View>
  );
}

/**
 * The Business app's first screen. Someone new answers one question (what kind
 * of shop), names it and sees its card before we ask for anything. An account
 * is asked for only at the end, when there's a shop to save.
 *
 * `ownerId` null = no account yet: "Looks good" leads to "Save your shop".
 */
export function ShopOnboarding({
  ownerId,
  resume,
  onFinish,
  onSignIn,
}: {
  ownerId: string | null;
  resume?: ResumeShop | null;
  onFinish: (destination: OnboardingDestination) => void;
  /** Guests only: open the sign-in screen (staff, or owners coming back). */
  onSignIn?: () => void;
}) {
  const guest = !ownerId;
  const resumeProgramme = resume ? programmeIdFor(resume.reward_model) : null;
  // A shop designed before signing up picks up where it left off.
  const [pending] = useState(() => (resume ? null : readPendingShop()));
  const [step, setStep] = useState(resume || pending ? 2 : 0);
  const [kind, setKind] = useState<ShopKind | null>(() => SHOP_KINDS.find((k) => k.key === pending?.kindKey) ?? null);
  const [programme, setProgramme] = useState<ProgrammeId>(resumeProgramme ?? pending?.programme ?? "stamps");
  const [picking, setPicking] = useState(false);
  const [name, setName] = useState(resume?.name ?? pending?.name ?? "");
  // Guessed from the phone's time zone; the chip changes it. It sets the shop's currency.
  const countryOptions = selectableCountries(FALLBACK_COUNTRIES);
  const [countryCode, setCountryCode] = useState(() => resume?.country_code ?? pending?.countryCode ?? guessCountry(countryOptions.map((c) => c.code)));
  const [draft, setDraft] = useState<ProgrammeDraft | null>(pending?.draft ?? null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  // "None of these fit": the owner describes their own programme to the AI builder.
  const [custom, setCustom] = useState(pending?.custom ?? false);
  const [rules, setRules] = useState<ProgrammeRules | null>(null);
  const isCustom = custom && !resume;
  // Android back steps through the set-up like the on-screen Back links. Not
  // after the shop is live (step 3), and step 0 leaves back to the system.
  useBackStep(step > 0 && step !== 3, () => setStep(step === ACCOUNT_STEP ? (isCustom ? 1 : 2) : step - 1));

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
    setCustom(false);
  }
  function chooseProgramme(id: ProgrammeId) {
    setProgramme(id);
    setDraft(null);
    setCustom(false);
    setPicking(false);
  }
  function chooseCustom() {
    setCustom(true);
    setPicking(false);
  }

  async function createCustom() {
    if (!rules) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("create_shop_with_custom_programme", {
        _name: name.trim(),
        _category: kind?.category ?? "Other",
        _country_code: country.code,
        _rules: rules,
        _brand_color: schemeColor('#8B7355', 'fg'),
      });
      if (error) throw error;
      clearPendingShop();
      setDone(true);
      setStep(3);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      showAlert(
        "Could not set up your shop",
        raw.includes("invalid_programme_rules") ? "Those rules couldn't be saved. Ask the AI to adjust them and try again." : "Your shop wasn't saved yet. Check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
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
      _brand_color: schemeColor('#8B7355', 'fg'),
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
    if (guest) {
      askForAccount();
      return;
    }
    setSaving(true);
    try {
      await save(result.args);
      clearPendingShop();
      setDone(true);
      setStep(3);
    } catch (e) {
      showAlert("Could not set up your shop", "Your shop wasn't saved yet. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const symbol = currency.symbol;

  // Signed in with a shop designed beforehand: create it straight away.
  const autoSaved = useRef(false);
  useEffect(() => {
    if (guest || !pending || pending.custom || autoSaved.current || !result) return;
    autoSaved.current = true;
    void looksGood();
  }, [guest, result]);

  function askForAccount() {
    writePendingShop({ kindKey: kind?.key ?? null, programme, name: name.trim(), countryCode, draft, custom: isCustom });
    setStep(ACCOUNT_STEP);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Dots step={step} />
        {step === 0 && <Whirl pose="wave" size={100} style={{ alignSelf: "flex-start", marginBottom: 2 }} />}
        {step === 1 && <Whirl pose="think" size={100} style={{ alignSelf: "flex-start", marginBottom: 2 }} />}
        {step === 2 && <Whirl pose={isCustom ? "think" : "stamp"} size={100} style={{ alignSelf: "flex-start", marginBottom: 2 }} />}

        {step === 0 && (
          <>
            <Text style={styles.hero}>What kind of shop{"\n"}are we dealing with?</Text>
            <Text style={styles.copy}>Pick the closest match. We'll suggest rewards your regulars will actually like.</Text>
            <View style={styles.stack}>
              {SHOP_KINDS.map((k) => {
                const Icon = KIND_ICONS[k.key];
                const active = kind?.key === k.key;
                return (
                  <Pressable key={k.key} onPress={() => chooseKind(k)} style={[styles.optionCard, active && styles.optionCardActive]}>
                    <Icon size={26} color={active ? schemeColor("#fff", 'fg') : colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionTitle, active && { color: schemeColor("#fff", 'fg') }]}>{k.title}</Text>
                      <Text style={[styles.optionBlurb, active && { color: schemeColor("#fff", 'fg') }]}>{k.examples}</Text>
                    </View>
                    {active && <View style={styles.checkBadge}><Check size={16} color={schemeColor("#fff", 'fg')} /></View>}
                  </Pressable>
                );
              })}
              <Pressable onPress={() => { setKind(null); chooseCustom(); }} style={[styles.optionCard, styles.optionCardDashed, custom && !kind && styles.optionCardActive]}>
                <Sparkles size={26} color={custom && !kind ? schemeColor("#fff", 'fg') : colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, custom && !kind && { color: schemeColor("#fff", 'fg') }]}>Something different</Text>
                  <Text style={[styles.optionBlurb, custom && !kind && { color: schemeColor("#fff", 'fg') }]}>Tell us your idea and our AI sets it up.</Text>
                </View>
                {custom && !kind && <View style={styles.checkBadge}><Check size={16} color={schemeColor("#fff", 'fg')} /></View>}
              </Pressable>
            </View>
            {custom && (
              <View style={styles.suggestion}>
                <Text style={styles.suggestionTitle}>Design your own with AI</Text>
                <Text style={styles.suggestionText}>
                  In two steps you'll tell our AI how rewards should work, in your own words, like "3 points is £1 off". It shows you exactly what customers will see before anything goes live.
                </Text>
                {kind && (
                  <Pressable onPress={() => setCustom(false)} hitSlop={8}>
                    <Text style={styles.link}>Use the suggestion instead</Text>
                  </Pressable>
                )}
              </View>
            )}
            {kind && !custom && (
              <View style={styles.suggestion}>
                <Text style={styles.suggestionTitle}>We suggest: {PROGRAMMES[programme].name}</Text>
                <Text style={styles.suggestionText}>{PROGRAMMES[programme].pitch}</Text>
                <Pressable onPress={() => setPicking(true)} hitSlop={8}>
                  <Text style={styles.link}>Change</Text>
                </Pressable>
              </View>
            )}
            <PrimaryButton title="Continue" disabled={!kind && !custom} onPress={() => setStep(1)} />
            {guest && onSignIn && (
              <Pressable onPress={onSignIn} style={styles.back} accessibilityRole="button">
                <Text style={styles.backText}>
                  Already have an account? <Text style={{ color: colors.primary, textDecorationLine: "underline" }}>Sign in</Text>
                </Text>
              </Pressable>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <Text style={styles.hero}>What do we{"\n"}call you?</Text>
            <Text style={styles.copy}>This goes at the top of your customers' loyalty card.</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              maxLength={80}
              placeholder="e.g. Bean & Bird"
              placeholderTextColor={colors.muted}
              autoFocus
            />
            {countryOptions.length > 1 && <View style={styles.chipRow}>
              <Text style={styles.chipLabel}>Based in</Text>
              {countryOptions.map((c) => {
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
                    <Text style={[styles.chipText, active && { color: schemeColor("#fff", 'fg') }]}>{c.name}</Text>
                  </Pressable>
                );
              })}
            </View>}
            {custom ? (
              <View style={styles.preview}>
                <Text style={styles.previewEyebrow}>What your customers will see</Text>
                <Text style={styles.previewName}>{name.trim() || "Your shop"}</Text>
                <Text style={styles.previewLine}>Your own programme, designed on the next step</Text>
              </View>
            ) : (
              <CardPreview programme={programme} name={name} draft={onboardingDefaults(programme, kind?.key ?? "everyday", currency)} symbol={symbol} />
            )}
            <PrimaryButton
              title="Continue"
              onPress={() => {
                if (!name.trim()) return showAlert("Add your shop name", "Customers will see this on their loyalty card.");
                // The AI designer needs an account; everything else waits until the end.
                if (guest && isCustom) return askForAccount();
                setStep(2);
              }}
            />
            <Pressable onPress={() => setStep(0)} style={styles.back}>
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          </>
        )}

        {step === 2 && isCustom && (
          <>
            <Text style={styles.hero}>Tell us how it{"\n"}should work.</Text>
            <Text style={styles.copy}>Explain it the way you would to a customer. Keep tweaking until you're happy.</Text>
            <ProgrammeBuilder
              shop={{ name: name.trim(), category: kind?.category ?? undefined, currencySymbol: symbol }}
              onRules={setRules}
              brandColor={schemeColor('#8B7355', 'fg')}
            />
            <PrimaryButton title={saving ? "Setting up…" : "Looks good"} disabled={saving || !rules} onPress={createCustom} />
            <Pressable onPress={() => setStep(1)} style={styles.back}>
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          </>
        )}

        {step === 2 && !isCustom && draft && (
          <>
            <Text style={styles.hero}>{activeProgramme === "tiers" ? "Your membership\nlevels" : "Here's what\nwe'd give them."}</Text>
            <Text style={styles.copy}>{`We've filled these in for ${(resume?.name ?? name).trim() || "your shop"}. Change anything you fancy, then tap Looks good.`}</Text>

            {activeProgramme === "tiers"
              ? draft.tiers.map((tier, index) => (
                  <View key={index} style={styles.editCard}>
                    <View style={styles.editHead}>
                      <View style={[styles.swatch, { backgroundColor: tier.colour }]} />
                      <Text style={styles.editTitle}>Level {index + 1}</Text>
                      {draft.tiers.length > 1 && (
                        <Pressable onPress={() => setDraft((d) => d && { ...d, tiers: d.tiers.filter((_, i) => i !== index) })} hitSlop={8} accessibilityLabel="Remove level">
                          <Trash2 size={18} color={schemeColor("#000", 'fg')} />
                        </Pressable>
                      )}
                    </View>
                    <Text style={styles.fieldLabel}>Name</Text>
                    <TextInput style={styles.input} value={tier.name} maxLength={40} onChangeText={(v) => patchTier(index, { name: v })} placeholderTextColor={colors.muted} />
                    <Text style={styles.fieldLabel}>Spend in a year ({symbol})</Text>
                    <TextInput style={styles.input} value={tier.amount} keyboardType="decimal-pad" onChangeText={(v) => patchTier(index, { amount: v.replace(/[^0-9.]/g, "") })} placeholderTextColor={colors.muted} />
                    <Text style={styles.fieldLabel}>Perks (one per line)</Text>
                    <TextInput style={[styles.input, { height: 92, textAlignVertical: "top" }]} value={tier.perks} multiline onChangeText={(v) => patchTier(index, { perks: v })} placeholderTextColor={colors.muted} />
                  </View>
                ))
              : draft.rewards.map((reward, index) => (
                  <View key={index} style={styles.editCard}>
                    <View style={styles.editHead}>
                      <Text style={styles.editTitle}>Reward {draft.rewards.length > 1 ? index + 1 : ""}</Text>
                      {draft.rewards.length > 1 && (
                        <Pressable onPress={() => setDraft((d) => d && { ...d, rewards: d.rewards.filter((_, i) => i !== index) })} hitSlop={8} accessibilityLabel="Remove reward">
                          <Trash2 size={18} color={schemeColor("#000", 'fg')} />
                        </Pressable>
                      )}
                    </View>
                    <Text style={styles.fieldLabel}>What do they get?</Text>
                    <TextInput style={styles.input} value={reward.title} maxLength={80} onChangeText={(v) => patchReward(index, { title: v })} placeholder="e.g. Free coffee" placeholderTextColor={colors.muted} />
                    <Text style={styles.fieldLabel}>
                      {activeProgramme === "stamps" ? "Stamps needed" : activeProgramme === "points" ? "Points needed" : `Customer spends (${symbol})`}
                    </Text>
                    <TextInput style={styles.input} value={reward.amount} keyboardType="decimal-pad" onChangeText={(v) => patchReward(index, { amount: v.replace(/[^0-9.]/g, "") })} placeholderTextColor={colors.muted} />
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
                <Plus size={18} color={colors.primary} />
                <Text style={styles.link}>{activeProgramme === "tiers" ? "Add a level" : "Add another reward"}</Text>
              </Pressable>
            )}

            {activeProgramme === "points" && (
              <View style={styles.editCard}>
                <Text style={styles.fieldLabel}>Points earned for every {symbol}1 spent</Text>
                <TextInput style={styles.input} value={draft.pointsPerPound} keyboardType="number-pad" onChangeText={(v) => setDraft((d) => d && { ...d, pointsPerPound: v.replace(/[^0-9]/g, "") })} placeholderTextColor={colors.muted} />
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

        {step === ACCOUNT_STEP && guest && (
          <SaveShopAccount
            shopName={name.trim()}
            custom={isCustom}
            onBack={() => setStep(isCustom ? 1 : 2)}
            onSignIn={onSignIn}
            preview={!isCustom && draft ? <CardPreview programme={activeProgramme} name={name} draft={draft} symbol={symbol} /> : null}
          />
        )}

        {step === 3 && done && (isCustom ? rules : draft) && (
          <>
            <Whirl pose="celebrate" size={130} style={{ alignSelf: "center", marginBottom: 6 }} />
            <Text style={[styles.hero, { textAlign: "center" }]}>You're open for stamps!</Text>
            <Text style={[styles.copy, { textAlign: "center", marginBottom: 20 }]}>Customers can join {resume?.name ?? name} now. This is the card they'll see:</Text>
            {isCustom && rules ? (
              <RulesCard rules={rules} symbol={symbol} brandColor={schemeColor('#8B7355', 'fg')} />
            ) : draft ? (
              <CardPreview programme={activeProgramme} name={resume?.name ?? name} draft={draft} symbol={symbol} />
            ) : null}
            <View style={{ height: 18 }} />
            <PrimaryButton title="Print your QR poster" icon={<QrCode size={18} color={schemeColor("#fff", 'fg')} />} onPress={() => onFinish("tools")} />
            <PrimaryButton title="Scan your first customer" secondary icon={<ScanLine size={18} color={colors.foreground} />} onPress={() => onFinish("scan")} />
            <Pressable onPress={() => onFinish("home")} style={styles.back}>
              <Text style={styles.backText}>Take me to my dashboard</Text>
            </Pressable>
          </>
        )}
      </KeyboardAwareScrollView>

      <Sheet visible={picking} onClose={() => setPicking(false)} dragArea="full">
        <View style={styles.sheetBody}>
          <Text style={styles.sheetTitle}>Choose a programme</Text>
          {PROGRAMME_ORDER.map((id) => {
            const Icon = id === "stamps" ? Stamp : id === "tiers" ? Gem : id === "points" ? Star : BadgeCheck;
            const active = programme === id;
            return (
              <Pressable key={id} onPress={() => chooseProgramme(id)} style={[styles.optionCard, active && styles.optionCardActive]}>
                <Icon size={24} color={active ? schemeColor("#fff", 'fg') : colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, active && { color: schemeColor("#fff", 'fg') }]}>{id === "spend" ? "£ Spend rewards" : PROGRAMMES[id].name}</Text>
                  <Text style={[styles.optionBlurb, active && { color: schemeColor("#fff", 'fg') }]}>{PROGRAMMES[id].pitch}</Text>
                </View>
                {active && <View style={styles.checkBadge}><Check size={16} color={schemeColor("#fff", 'fg')} /></View>}
              </Pressable>
            );
          })}
          <Pressable onPress={chooseCustom} style={[styles.optionCard, styles.optionCardDashed]}>
            <Sparkles size={24} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>Design my own with AI</Text>
              <Text style={styles.optionBlurb}>None of these fit? Describe it and our AI builds it.</Text>
            </View>
          </Pressable>
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

/** "Save your shop": the one place a new owner is asked for an account. Email
 * and password only. Once the account exists the app signs them in and the
 * shop kept on the phone is created (see `pending` above). */
function SaveShopAccount({
  shopName,
  custom,
  preview,
  onBack,
  onSignIn,
}: {
  shopName: string;
  custom: boolean;
  preview: React.ReactNode;
  onBack: () => void;
  onSignIn?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const shop = shopName || "Your shop";

  async function create() {
    const address = email.trim();
    if (!address.includes("@")) return showAlert("Check your email", "Enter the email address you'd like to sign in with.");
    if (password.length < 8) return showAlert("Choose a longer password", "Use at least 8 characters.");
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: address,
        password,
        options: { emailRedirectTo: `${WEB_ORIGIN}/auth/callback`, data: { intent: "business_owner" } },
      });
      if (error) throw error;
      void supabase.functions.invoke("send-owner-legal-documents", { body: { email: address, site_url: WEB_ORIGIN } }).catch(() => undefined);
      // With a session the app signs in by itself and creates the shop.
      if (!data.session) setSentTo(address);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      showAlert(
        "Could not create your account",
        /already|registered|exists/i.test(raw)
          ? "There's already an account with that email. Sign in instead and your shop will be created."
          : /password/i.test(raw)
            ? "Choose a stronger password: at least 8 characters, mixing letters and numbers."
            : "Your account wasn't created. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (sentTo)
    return (
      <>
        <Whirl pose="sleepy" size={120} style={{ alignSelf: "center", marginBottom: 6 }} />
        <Text style={[styles.hero, { textAlign: "center" }]}>Check your email.</Text>
        <Text style={[styles.copy, { textAlign: "center" }]}>
          We've sent a link to {sentTo}. Tap it, then sign in. {shop} is saved on this phone and goes live as soon as you're in.
        </Text>
        {onSignIn && <PrimaryButton title="Sign in" onPress={onSignIn} />}
        <Pressable onPress={() => setSentTo(null)} style={styles.back}>
          <Text style={styles.backText}>Use a different email</Text>
        </Pressable>
      </>
    );

  return (
    <>
      <Whirl pose="thumbs" size={96} style={{ alignSelf: "flex-start", marginBottom: 4 }} />
      <Text style={styles.hero}>Nearly done.</Text>
      <Text style={styles.copy}>
        {custom
          ? `A free account keeps ${shopName || "your shop"} safe, and lets our AI design its programme with you.`
          : `${shop} is ready. A free account keeps it safe and puts it live.`}
      </Text>
      {preview ? <View style={{ marginTop: 18 }}>{preview}</View> : null}
      <TextInput
        style={[styles.input, { marginTop: 18 }]}
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
        style={[styles.input, { marginTop: 10 }]}
        value={password}
        onChangeText={setPassword}
        placeholder="Password (8+ characters)"
        placeholderTextColor={colors.muted}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <PrimaryButton title={busy ? "Saving…" : custom ? "Save and design it" : "Save and go live"} disabled={busy} onPress={create} />
      {onSignIn && (
        <Pressable onPress={onSignIn} style={styles.back} accessibilityRole="button">
          <Text style={styles.backText}>
            Already have an account? <Text style={{ color: colors.primary, textDecorationLine: "underline" }}>Sign in</Text>
          </Text>
        </Pressable>
      )}
      <Pressable onPress={onBack} style={[styles.back, { paddingTop: 0 }]}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
    </>
  );
}

const styles = themed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: 24, paddingBottom: 48 },
  progress: { marginTop: 6, marginBottom: 26, gap: 8 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: schemeColor("#DCD6CB", 'bg'), overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  progressText: { color: schemeColor("#000000", 'fg'), fontSize: 13, fontWeight: "700" },
  checkBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: schemeColor("rgba(255,255,255,0.28)", 'bg'), alignItems: "center", justifyContent: "center" },
  hero: { color: schemeColor("#000000", 'fg'), fontSize: 36, lineHeight: 42, letterSpacing: -1, fontFamily: fonts.nativeDisplay },
  copy: { color: schemeColor("#000000", 'fg'), fontSize: 16, lineHeight: 24, marginTop: 8 },
  stack: { gap: 12, marginTop: 22, marginBottom: 16 },
  optionCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: schemeColor("#fff", 'bg'), borderRadius: 20, borderWidth: 2, borderColor: schemeColor("#eee0cc", 'border'), padding: 18 },
  optionCardActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionCardDashed: { borderStyle: "dashed" },
  optionTitle: { color: schemeColor("#000000", 'fg'), fontSize: 17, fontWeight: "800" },
  optionBlurb: { color: schemeColor("#000000", 'fg'), fontSize: 13, marginTop: 2 },
  suggestion: { backgroundColor: schemeColor("#FFF3DC", 'bg'), borderRadius: 18, padding: 16, marginBottom: 18, gap: 4 },
  suggestionTitle: { color: schemeColor("#000000", 'fg'), fontSize: 15, fontWeight: "800" },
  suggestionText: { color: schemeColor("#000000", 'fg'), fontSize: 14, lineHeight: 20 },
  link: { color: colors.primary, fontSize: 15, fontWeight: "800", marginTop: 4, textDecorationLine: "underline" },
  input: { backgroundColor: schemeColor("#fff", 'bg'), borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, color: schemeColor("#000000", 'fg'), fontSize: 16, marginTop: 6, borderWidth: 1, borderColor: schemeColor("#eee0cc", 'border') },
  chipRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 14, marginBottom: 20 },
  chipLabel: { color: schemeColor("#000000", 'fg'), fontSize: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5, borderColor: schemeColor("rgba(0,0,0,0.15)", 'border'), backgroundColor: schemeColor("#fff", 'bg') },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: schemeColor("#000000", 'fg'), fontWeight: "800", fontSize: 13 },
  editCard: { backgroundColor: schemeColor("#fff", 'bg'), borderRadius: 18, padding: 16, marginTop: 14, gap: 2 },
  editHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  editTitle: { flex: 1, color: schemeColor("#000000", 'fg'), fontSize: 15, fontWeight: "800" },
  swatch: { width: 14, height: 14, borderRadius: 7 },
  fieldLabel: { color: schemeColor("#000000", 'fg'), fontSize: 13, fontWeight: "700", marginTop: 10 },
  addRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 },
  problem: { color: schemeColor("#000000", 'fg'), fontSize: 14, fontWeight: "700", marginTop: 12 },
  preview: { backgroundColor: schemeColor('#8B7355', 'bg'), borderRadius: 20, padding: 18 },
  previewEyebrow: { color: schemeColor("rgba(255,255,255,0.85)", 'fg'), fontSize: 13, fontWeight: "700" },
  previewName: { color: schemeColor("#fff", 'fg'), fontSize: 22, fontFamily: fonts.nativeDisplay, marginTop: 4, marginBottom: 12 },
  previewLine: { color: schemeColor("#fff", 'fg'), fontSize: 14, fontWeight: "700", marginTop: 6 },
  previewBig: { color: schemeColor("#fff", 'fg'), fontSize: 30, fontWeight: "800" },
  stampRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  stamp: { width: 26, height: 26, borderRadius: 13, backgroundColor: schemeColor("rgba(255,255,255,0.25)", 'bg'), alignItems: "center", justifyContent: "center" },
  stampFilled: { backgroundColor: schemeColor("#fff", 'bg') },
  tierPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  tierPillText: { color: schemeColor("#000000", 'fg'), fontSize: 12, fontWeight: "800" },
  bar: { height: 10, borderRadius: 5, backgroundColor: schemeColor("rgba(255,255,255,0.25)", 'bg'), overflow: "hidden" },
  barFill: { height: 10, width: "33%", borderRadius: 5, backgroundColor: schemeColor("#fff", 'bg') },
  button: { backgroundColor: schemeColor('#1A2138', 'bg'), borderRadius: 999, minHeight: 54, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", padding: 15, marginTop: 16 },
  buttonSecondary: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.foreground },
  buttonText: { color: schemeColor("#fff", 'fg'), fontWeight: "800", fontSize: 16, textAlign: "center" },
  back: { alignItems: "center", padding: 16 },
  backText: { color: schemeColor("#000000", 'fg'), fontSize: 15, fontWeight: "700" },
  liveBadge: { width: 64, height: 64, borderRadius: 32, backgroundColor: schemeColor("#3FA34D", 'bg'), alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 14 },
  sheetBody: { padding: 20, paddingBottom: 32, gap: 12 },
  sheetTitle: { color: schemeColor("#000000", 'fg'), fontSize: 20, fontWeight: "800", marginBottom: 4 },
}));
