import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Minus, Plus } from "lucide-react-native";
import { schemeColor, themed } from "@loyalty-loop/design-tokens"

// Help & FAQ inside the Business app, so owners never need the website for it.
// Same answers as the website's /help page, worded for the app.

export const SUPPORT_EMAIL = "help@the-loyalty-loop.com";

const ink = "#1A2138";
const muted = "#4A4F5C";

type Item = { q: string; a: string };

const BUSINESS_ITEMS: Item[] = [
  {
    q: "How do I set my shop up?",
    a: "Tap “New here? Set up your shop” on the sign-in screen. Add your address, pin your location on the map, write a short description and choose your reward. You’re live to nearby shoppers in minutes.",
  },
  {
    q: "How do customers join?",
    a: "Print your QR poster (Shop tab → QR poster) and put it by the till. Customers scan it with their phone camera to join. You can also turn on WhatsApp joining on the same screen.",
  },
  {
    q: "Do I need any special hardware?",
    a: "No. Any phone or tablet with a camera works. Scan a customer’s code, or type in their 6-character code by hand. No card printer or terminal needed.",
  },
  {
    q: "What kinds of loyalty programme can I run?",
    a: "Stamps, spend-to-earn, points or tiers. You choose each reward and what unlocks it, and can change them whenever you like from Shop → Programme.",
  },
  {
    q: "How does the AI business coaching work?",
    a: "The app summarises your visits, reviews and reward activity into weekly wins, watch-outs and suggested next steps. The Deep AI Business Report goes further, spotting red flags in reviews and suggesting growth ideas from your own data.",
  },
  {
    q: "How much does it cost?",
    a: "Nothing. The Loyalty Loop for Business is free to use, with no subscriptions or in-app purchases.",
  },
];

const ACCOUNT_ITEMS: Item[] = [
  {
    q: "How do I reset my password?",
    a: "Sign out, then tap “Forgot password?” on the sign-in screen. We’ll email you a secure reset link.",
  },
  {
    q: "How do I hide or close my shop?",
    a: "Shop → Settings & account → Deactivate shop. Customers can’t find or join it while it’s off, and your data is kept. You can reactivate it from the same place.",
  },
  {
    q: "How do I delete my account?",
    a: "Shop → Settings & account → Delete account. If deletion fails, email us and we’ll finish it for you. The Privacy Notice explains how retained records are handled.",
  },
  {
    q: "What data do you collect?",
    a: "We use account and loyalty activity to run your rewards and your shop’s insights. We don’t sell data. Full detail is in the Privacy Notice (Shop → Settings & account → Privacy notice).",
  },
  {
    q: "Something isn’t working",
    a: "Close and reopen the app first. If a visit or reward still looks wrong, email us with your shop name and roughly when it happened.",
  },
];

function HelpItem({ q, a }: Item) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.item}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => [styles.question, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.questionText}>{q}</Text>
        <View style={[styles.toggle, open && styles.toggleOpen]}>
          {open ? <Minus size={16} color={schemeColor("#fff", 'fg')} strokeWidth={2.6} /> : <Plus size={16} color={schemeColor('#1A2138', 'fg')} strokeWidth={2.6} />}
        </View>
      </Pressable>
      {open ? <Text style={styles.answer}>{a}</Text> : null}
    </View>
  );
}

export function HelpFaq({ showAccount = true }: { showAccount?: boolean }) {
  return (
    <View>
      <Text style={styles.group}>Your shop</Text>
      <View style={styles.card}>
        {BUSINESS_ITEMS.map((item) => <HelpItem key={item.q} {...item} />)}
      </View>
      {showAccount ? (
        <>
          <Text style={styles.group}>Your account</Text>
          <View style={styles.card}>
            {ACCOUNT_ITEMS.map((item) => <HelpItem key={item.q} {...item} />)}
          </View>
        </>
      ) : null}
      <Text style={styles.group}>STILL STUCK?</Text>
      <Pressable
        accessibilityRole="link"
        onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        style={({ pressed }) => [styles.card, styles.contact, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.questionText}>Email {SUPPORT_EMAIL}</Text>
        <Text style={styles.answer}>We usually reply within one working day.</Text>
      </Pressable>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  group: { marginTop: 18, marginBottom: 8, fontSize: 15, fontWeight: "800", color: schemeColor('#4A4F5C', 'fg') },
  card: { backgroundColor: schemeColor("#FCFCFA", 'bg'), borderRadius: 20, paddingHorizontal: 16, borderWidth: 1, borderColor: schemeColor("#E6E1D8", 'border') },
  contact: { paddingVertical: 14 },
  item: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: schemeColor("#DDD6CA", 'border') },
  question: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 12 },
  questionText: { flex: 1, fontSize: 16, fontWeight: "800", color: schemeColor('#1A2138', 'fg') },
  toggle: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: schemeColor("#EFE9DF", 'bg') },
  toggleOpen: { backgroundColor: schemeColor("#2B3A67", 'bg') },
  answer: { paddingBottom: 14, fontSize: 15, lineHeight: 22, color: schemeColor('#4A4F5C', 'fg') },
}));
