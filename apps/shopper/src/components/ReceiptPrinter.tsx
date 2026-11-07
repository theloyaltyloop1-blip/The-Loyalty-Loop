import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import Svg, { Path } from "react-native-svg";
import { colors } from "@loyalty-loop/design-tokens";

/** Shown to the shopper when a new stamp, purchase or points land on a card
 * they open: a small printer drops in and a receipt feeds out with what they
 * earned and how close the next reward is. It lives in the shopper app on
 * purpose, so the Business app's till flow never waits for it. Closes by
 * itself after a moment, or on tap. */

export type ReceiptData = {
  /** Printer heading, e.g. "Stamp added". */
  title: string;
  /** The big number on the right of the printer, e.g. "+1" or "£12.40". */
  headline: string;
  shopName: string;
  customerName?: string | null;
  /** Line items on the paper. The last one is printed bold as the total. */
  lines: { label: string; value: string }[];
  /** Optional note under the total, e.g. "2 stamps to a free coffee". */
  note?: string | null;
};

const INK = colors.ink;
const PAPER = "#FFFFFF";
const PRINT_MS = 950;
const HOLD_MS = 2200;

export function ReceiptPrinter({
  receipt,
  onFinished,
}: {
  receipt: ReceiptData | null;
  onFinished: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const [paperHeight, setPaperHeight] = useState(0);
  const [printed, setPrinted] = useState(false);
  const finished = useRef(false);
  const ticks = useRef<ReturnType<typeof setInterval> | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const drop = useSharedValue(0);
  const feed = useSharedValue(0);
  const fade = useSharedValue(1);

  // A fixed time for the receipt so it doesn't tick while on screen.
  // Keyed on open/closed, not the object: the parent may rebuild the data on
  // every render, and that must not restart the print.
  const open = receipt != null;
  const stamp = useMemo(() => new Date(), [open]);
  const ref = useMemo(() => Math.random().toString(36).slice(2, 8).toUpperCase(), [open]);

  function clear() {
    if (ticks.current) clearInterval(ticks.current);
    ticks.current = null;
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function finish() {
    if (finished.current) return;
    finished.current = true;
    clear();
    // Re-measure next time: the content (and so the height) may differ.
    setPaperHeight(0);
    onFinished();
  }

  function close() {
    if (finished.current) return;
    clear();
    fade.set(withTiming(0, { duration: 200, easing: Easing.out(Easing.quad) }, (done) => {
      if (done) scheduleOnRN(finish);
    }));
  }

  // Reset whenever a new receipt arrives.
  useEffect(() => {
    if (!open) return;
    finished.current = false;
    setPrinted(false);
    drop.set(0);
    feed.set(0);
    fade.set(1);
    drop.set(reducedMotion ? 1 : withSpring(1, { duration: 320, dampingRatio: 0.78 }));
    return clear;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Start feeding once the paper has been measured.
  useEffect(() => {
    if (!open || !paperHeight) return;
    if (reducedMotion) {
      feed.set(1);
    } else {
      ticks.current = setInterval(() => void Haptics.selectionAsync(), 110);
      feed.set(withDelay(220, withTiming(1, { duration: PRINT_MS, easing: Easing.out(Easing.cubic) })));
    }
    const printDone = (reducedMotion ? 0 : 220 + PRINT_MS);
    timers.current.push(setTimeout(() => {
      if (ticks.current) clearInterval(ticks.current);
      ticks.current = null;
      setPrinted(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, printDone));
    timers.current.push(setTimeout(close, printDone + HOLD_MS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, paperHeight]);

  const printerStyle = useAnimatedStyle(() => ({
    opacity: drop.get(),
    transform: [{ translateY: (1 - drop.get()) * -40 }, { scale: 0.94 + drop.get() * 0.06 }],
  }));
  const paperClip = useAnimatedStyle(() => ({ height: feed.get() * paperHeight }));
  const paperStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (feed.get() - 1) * paperHeight }] }));
  const rootStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));

  if (!receipt) return null;
  const total = receipt.lines[receipt.lines.length - 1];
  const items = receipt.lines.slice(0, -1);

  return (
    <Modal transparent visible animationType="none" onRequestClose={close}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, rootStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close receipt" />
        <View style={styles.column} pointerEvents="box-none">
          <Animated.View style={[styles.printer, printerStyle]} accessibilityLiveRegion="polite">
            <View style={styles.printerTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.printerTitle} numberOfLines={1}>{receipt.title}</Text>
                <Text style={styles.printerSub} numberOfLines={1}>{receipt.customerName || receipt.shopName}</Text>
              </View>
              <Text style={styles.printerHeadline}>{receipt.headline}</Text>
            </View>
            <View style={styles.statusRow}>
              {printed ? (
                <View style={styles.doneDot}>
                  <Svg width={10} height={10} viewBox="0 0 24 24"><Path d="M5 12.5l4.5 4.5L19 7.5" stroke="#FFFFFF" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" /></Svg>
                </View>
              ) : (
                <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" style={{ transform: [{ scale: 0.7 }] }} />
              )}
              <Text style={styles.statusText}>{printed ? "Saved to your card" : "Printing your receipt"}</Text>
            </View>
            <View style={styles.slot} />
          </Animated.View>

          {/* Measure once off-screen, then feed the paper out of the slot. */}
          <Animated.View style={[styles.paperClip, paperClip]}>
            <Animated.View
              style={[styles.paper, paperStyle, !paperHeight && { opacity: 0 }]}
              onLayout={(e) => { const h = e.nativeEvent.layout.height; if (h && !paperHeight) setPaperHeight(h); }}
            >
              <View style={styles.mark}><Text style={styles.markText}>{receipt.shopName.slice(0, 1).toUpperCase()}</Text></View>
              <Text style={styles.paperShop} numberOfLines={1}>{receipt.shopName.toUpperCase()}</Text>
              <Rule />
              {items.map((line) => (
                <View key={line.label} style={styles.line}>
                  <Text style={styles.lineLabel} numberOfLines={1}>{line.label}</Text>
                  <Text style={styles.lineValue}>{line.value}</Text>
                </View>
              ))}
              {items.length ? <Rule /> : null}
              {total ? (
                <View style={styles.line}>
                  <Text style={styles.totalLabel} numberOfLines={1}>{total.label.toUpperCase()}</Text>
                  <Text style={styles.totalValue}>{total.value}</Text>
                </View>
              ) : null}
              {receipt.note ? <Text style={styles.note}>{receipt.note}</Text> : null}
              <Rule />
              <View style={styles.line}>
                <Text style={styles.meta}>Ref</Text>
                <Text style={styles.meta}>{ref}</Text>
              </View>
              <View style={styles.line}>
                <Text style={styles.meta}>Date</Text>
                <Text style={styles.meta}>
                  {stamp.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {stamp.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
              <Barcode seed={ref} />
              <Text style={styles.thanks}>THE LOYALTY LOOP</Text>
            </Animated.View>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}

function Rule() {
  return <View style={styles.rule} />;
}

/** Decorative barcode. Bar widths come from the receipt ref so each receipt
 * looks different; it is not scannable and doesn't need to be. */
function Barcode({ seed }: { seed: string }) {
  const bars = useMemo(() => {
    let h = 7;
    for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return Array.from({ length: 42 }, () => {
      h = (h * 1103515245 + 12345) >>> 0;
      return 1 + ((h >>> 16) % 3);
    });
  }, [seed]);
  return (
    <View style={styles.barcode} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {bars.map((w, i) => (
        <View key={i} style={{ width: w, height: 34, backgroundColor: i % 2 ? "transparent" : INK }} />
      ))}
    </View>
  );
}

const mono = { fontVariant: ["tabular-nums" as const], letterSpacing: 0.4 };

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(244,241,234,0.82)" },
  column: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  printer: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: INK,
    borderRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 14,
    zIndex: 2,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  printerTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  printerTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  printerSub: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 2 },
  printerHeadline: { color: "#FFFFFF", fontSize: 22, fontWeight: "800", ...mono, letterSpacing: -0.4 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, height: 20 },
  statusText: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "600" },
  doneDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginHorizontal: 2,
    backgroundColor: colors.funGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  slot: { height: 6, borderRadius: 3, backgroundColor: "#0B0F1C", marginTop: 12, marginHorizontal: 6 },
  paperClip: { width: "86%", maxWidth: 292, overflow: "hidden", marginTop: -10, zIndex: 1 },
  paper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: PAPER,
    paddingTop: 22,
    paddingHorizontal: 18,
    paddingBottom: 16,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  mark: {
    alignSelf: "center",
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  markText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  paperShop: { textAlign: "center", color: INK, fontSize: 11, fontWeight: "800", letterSpacing: 1.4, marginTop: 8 },
  rule: { borderTopWidth: 1, borderColor: "#D9D5CC", borderStyle: "dashed", marginVertical: 10 },
  line: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginVertical: 2 },
  lineLabel: { flex: 1, color: INK, fontSize: 12, ...mono },
  lineValue: { color: INK, fontSize: 12, ...mono },
  totalLabel: { flex: 1, color: INK, fontSize: 13, fontWeight: "800", ...mono },
  totalValue: { color: INK, fontSize: 15, fontWeight: "800", ...mono },
  note: { color: colors.muted, fontSize: 11, marginTop: 6 },
  meta: { color: colors.muted, fontSize: 10, ...mono },
  barcode: { flexDirection: "row", justifyContent: "center", marginTop: 12 },
  thanks: { textAlign: "center", color: colors.muted, fontSize: 9, letterSpacing: 2, marginTop: 6 },
});
