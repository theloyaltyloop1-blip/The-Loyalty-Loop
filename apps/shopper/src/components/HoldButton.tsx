import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { colors } from "@loyalty-loop/design-tokens";

/** Press-and-hold confirmation for actions that can't be taken back
 * (redeeming a reward, spending points). A darker fill sweeps across the
 * button while it's held; letting go early drains it back and nothing
 * happens. Replaces a "Are you sure?" pop-up with one deliberate gesture.
 * Screen readers get a normal double-tap button (holding isn't practical
 * for them), so accessibility users are never blocked. */

const DRAIN = { duration: 260, easing: Easing.out(Easing.quad) };

export function HoldButton({
  label,
  holdingLabel = "Keep holding…",
  doneLabel,
  onConfirm,
  disabled,
  busy,
  busyLabel,
  color = colors.primary,
  textColor = "#FFFFFF",
  duration = 900,
  style,
  accessibilityLabel,
  compact,
}: {
  label: string;
  holdingLabel?: string;
  doneLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
  busy?: boolean;
  busyLabel?: string;
  color?: string;
  textColor?: string;
  duration?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** Small pill for use inside a list row. */
  compact?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const [holding, setHolding] = useState(false);
  const [done, setDone] = useState(false);
  const ticks = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (ticks.current) clearInterval(ticks.current); }, []);
  // Once the parent finishes (busy goes false), make the button usable again.
  useEffect(() => {
    if (!busy && done) {
      setDone(false);
      progress.set(withTiming(0, DRAIN));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  function stopTicks() {
    if (ticks.current) clearInterval(ticks.current);
    ticks.current = null;
  }

  function complete() {
    stopTicks();
    setHolding(false);
    setDone(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm();
  }

  function start() {
    if (disabled || busy || done) return;
    setHolding(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Gentle ticks while filling, so the hold feels physical.
    stopTicks();
    ticks.current = setInterval(() => void Haptics.selectionAsync(), Math.max(120, duration / 6));
    progress.set(
      withTiming(1, { duration: duration * (1 - progress.get()), easing: Easing.linear }, (finished) => {
        if (finished) scheduleOnRN(complete);
      }),
    );
  }

  function release() {
    if (done) return;
    stopTicks();
    setHolding(false);
    cancelAnimation(progress);
    progress.set(withTiming(0, reducedMotion ? { duration: 0 } : DRAIN));
  }

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));
  const off = disabled || busy;
  const text = busy ? busyLabel ?? label : done ? doneLabel ?? label : holding ? holdingLabel : label;

  return (
    <Pressable
      onPressIn={start}
      onPressOut={release}
      // Screen readers activate with a double-tap rather than a hold.
      onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === "activate" && !off) onConfirm(); }}
      accessibilityActions={[{ name: "activate" }]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint="Press and hold to confirm"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      style={[styles.button, compact && styles.compact, { backgroundColor: color }, off && !done && styles.off, style]}
    >
      <Animated.View pointerEvents="none" style={[styles.fill, fillStyle]} />
      <View style={styles.row} pointerEvents="none">
        <Text style={[styles.label, compact && styles.compactLabel, { color: textColor }]} numberOfLines={1}>{text}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 58,
    borderRadius: 999,
    overflow: "hidden",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  label: { fontSize: 17, fontWeight: "800", letterSpacing: -0.2 },
  compact: { minHeight: 40, paddingHorizontal: 16 },
  compactLabel: { fontSize: 14 },
  off: { opacity: 0.45 },
});
