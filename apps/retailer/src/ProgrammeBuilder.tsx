import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ArrowUp, Info, Sparkles } from "lucide-react-native";
import { colors, fonts } from "@loyalty-loop/design-tokens";
import { describeRules, type ProgrammeRules } from "@loyalty-loop/loyalty/programme-rules";
import { supabase } from "./supabase";

// The AI programme builder, Business app version (the website has the same in
// apps/web/src/components/programme-builder.tsx). The AI only ever returns a
// rules document; the database checks it again when the owner saves.

const { foreground: green, primary: orange } = colors;

type Message = { role: "user" | "assistant"; content: string };
type Unsupported = { request: string; closest: string };

const EXAMPLES = [
  "1 point for every £1, and 3 points = £1 off",
  "Every 6th haircut free, double points on quiet Tuesdays",
  "Silver after 10 visits, Gold after 25 with 10% off",
];

async function askBuilder(body: object): Promise<{ reply: string; rules: ProgrammeRules | null; unsupported: Unsupported[] }> {
  const { data, error } = await supabase.functions.invoke("design-programme", { body });
  if (error) {
    let message = "The programme builder could not answer. Try again.";
    try {
      const parsed = await (error as { context?: Response }).context?.json();
      if (parsed?.error) message = String(parsed.error);
    } catch {
      // keep the default
    }
    throw new Error(message);
  }
  return data as { reply: string; rules: ProgrammeRules | null; unsupported: Unsupported[] };
}

function moneyFor(symbol: string) {
  return (pence: number) => `${symbol}${symbol.length > 1 ? " " : ""}${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;
}

/** The rules in plain English, on the shop's colour. */
export function RulesCard({ rules, symbol = "£", brandColor = "#2B3A67" }: { rules: ProgrammeRules; symbol?: string; brandColor?: string }) {
  const d = describeRules(rules, moneyFor(symbol));
  const block = (title: string, lines: string[]) =>
    lines.length ? (
      <View style={{ marginTop: 12 }}>
        <Text style={styles.cardEyebrow}>{title}</Text>
        {lines.map((line, i) => (
          <Text key={i} style={styles.cardLine}>{line}</Text>
        ))}
      </View>
    ) : null;
  return (
    <View style={[styles.card, { backgroundColor: brandColor }]}>
      <Text style={styles.cardEyebrow}>YOUR PROGRAMME</Text>
      <Text style={styles.cardSummary}>{rules.summary}</Text>
      {block(`HOW TO EARN ${rules.unit.many.toUpperCase()}`, d.earn)}
      {block("WHAT THEY GET", d.spend)}
      {block("LEVELS", d.levels)}
      {d.small.length ? <Text style={styles.cardSmall}>{d.small.join(" · ")}</Text> : null}
    </View>
  );
}

export function ProgrammeBuilder({
  shop, businessId, initialRules = null, onRules, brandColor,
}: {
  shop: { name?: string; category?: string; currencySymbol?: string };
  businessId?: string;
  initialRules?: ProgrammeRules | null;
  onRules: (rules: ProgrammeRules | null) => void;
  brandColor?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [rules, setRules] = useState<ProgrammeRules | null>(initialRules);
  const [notes, setNotes] = useState<Unsupported[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const before = messages;
    const next: Message[] = [...messages, { role: "user" as const, content }].slice(-24);
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const answer = await askBuilder({ messages: next, shop, business_id: businessId });
      if (!mounted.current) return;
      setMessages([...next, { role: "assistant", content: answer.reply }]);
      if (answer.rules) {
        setRules(answer.rules);
        onRules(answer.rules);
      }
      if (answer.unsupported?.length) setNotes(answer.unsupported);
    } catch (e) {
      if (!mounted.current) return;
      setMessages(before);
      setInput(content);
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.avatar}><Sparkles size={16} color="#fff" /></View>
        <View style={styles.aiBubble}>
          <Text style={styles.bubbleText}>
            {initialRules
              ? "Tell me what you'd like to change and I'll update your programme."
              : "Tell me how you'd like your loyalty programme to work, in your own words. I'll set it up and show you exactly what customers will see."}
          </Text>
        </View>
      </View>
      {messages.map((m, i) =>
        m.role === "user" ? (
          <View key={i} style={[styles.row, { justifyContent: "flex-end" }]}>
            <View style={styles.userBubble}><Text style={[styles.bubbleText, { color: "#fff" }]}>{m.content}</Text></View>
          </View>
        ) : (
          <View key={i} style={styles.row}>
            <View style={styles.avatar}><Sparkles size={16} color="#fff" /></View>
            <View style={styles.aiBubble}><Text style={styles.bubbleText}>{m.content}</Text></View>
          </View>
        ),
      )}
      {busy && (
        <View style={[styles.row, { alignItems: "center" }]}>
          <View style={styles.avatar}><ActivityIndicator size="small" color="#fff" /></View>
          <Text style={styles.thinking}>Working it out…</Text>
        </View>
      )}

      {messages.length === 0 && !initialRules && (
        <View style={styles.examples}>
          {EXAMPLES.map((ex) => (
            <Pressable key={ex} onPress={() => void send(ex)} style={({ pressed }) => [styles.example, pressed && { opacity: 0.7 }]}>
              <Text style={styles.exampleText}>{ex}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.composer}>
        <TextInput
          style={styles.composerInput}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={2000}
          placeholder={messages.length ? "Reply or ask for a change…" : "e.g. 3 points is £1 off"}
          placeholderTextColor="rgba(0,0,0,0.45)"
          accessibilityLabel="Describe your programme"
        />
        <Pressable
          onPress={() => void send(input)}
          disabled={busy || !input.trim()}
          accessibilityRole="button"
          accessibilityLabel="Send"
          style={[styles.send, (busy || !input.trim()) && { opacity: 0.4 }]}
        >
          <ArrowUp size={20} color="#fff" />
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {rules ? <View style={{ marginTop: 18 }}><RulesCard rules={rules} symbol={shop.currencySymbol} brandColor={brandColor} /></View> : null}

      {notes.length > 0 && (
        <View style={styles.notes}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Info size={16} color={orange} />
            <Text style={styles.notesTitle}>Not possible yet</Text>
          </View>
          {notes.map((n, i) => (
            <Text key={i} style={styles.notesLine}>
              <Text style={{ fontWeight: "800" }}>{n.request}.</Text>{n.closest ? ` Instead: ${n.closest}.` : ""}
            </Text>
          ))}
          <Text style={styles.notesSmall}>We've passed this on to the team.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, marginTop: 10 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: orange, alignItems: "center", justifyContent: "center" },
  aiBubble: { flex: 1, backgroundColor: "#fff", borderRadius: 18, borderTopLeftRadius: 6, paddingHorizontal: 14, paddingVertical: 11 },
  userBubble: { maxWidth: "85%", backgroundColor: green, borderRadius: 18, borderTopRightRadius: 6, paddingHorizontal: 14, paddingVertical: 11 },
  bubbleText: { color: "#000", fontSize: 15, lineHeight: 21 },
  thinking: { color: "#000", fontSize: 14 },
  examples: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  example: { borderWidth: 1.5, borderColor: "#eee0cc", backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  exampleText: { color: "#000", fontSize: 13, fontWeight: "700" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, backgroundColor: "#fff", borderRadius: 18, borderWidth: 1.5, borderColor: "#eee0cc", padding: 8, marginTop: 14 },
  composerInput: { flex: 1, minHeight: 44, maxHeight: 140, color: "#000", fontSize: 16, paddingHorizontal: 8, paddingVertical: 8 },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: orange, alignItems: "center", justifyContent: "center" },
  error: { color: "#B42318", fontSize: 14, fontWeight: "700", marginTop: 8 },
  card: { borderRadius: 20, padding: 18 },
  cardEyebrow: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  cardSummary: { color: "#fff", fontSize: 18, lineHeight: 24, fontFamily: fonts.nativeDisplay, marginTop: 4 },
  cardLine: { color: "#fff", fontSize: 14, fontWeight: "700", lineHeight: 20, marginTop: 3 },
  cardSmall: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 12 },
  notes: { backgroundColor: "#FFF3DC", borderRadius: 18, padding: 14, marginTop: 12, gap: 6 },
  notesTitle: { color: "#000", fontSize: 15, fontWeight: "800" },
  notesLine: { color: "#000", fontSize: 14, lineHeight: 20 },
  notesSmall: { color: "rgba(0,0,0,0.6)", fontSize: 12 },
});
