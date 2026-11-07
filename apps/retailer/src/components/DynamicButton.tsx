import { useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Check } from "lucide-react-native";
import { colors } from "@loyalty-loop/design-tokens";

/** A main action button that shows its own progress: the label rolls up to
 * a spinner while the request runs, then to a tick on a green fill when it
 * lands. Staff see the result on the thing they pressed instead of in a
 * separate pop-up. */

export type DynamicStatus = "idle" | "busy" | "done";

const ROLL_IN = FadeInDown.duration(220).easing(Easing.out(Easing.cubic));
const ROLL_OUT = FadeOutUp.duration(160).easing(Easing.in(Easing.quad));

export function DynamicButton({
  status,
  label,
  busyLabel,
  doneLabel = "Done",
  onPress,
  disabled,
  color = colors.primary,
  doneColor = colors.funGreen,
  textColor = "#FFFFFF",
  style,
}: {
  status: DynamicStatus;
  label: string;
  busyLabel: string;
  doneLabel?: string;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
  doneColor?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const reducedMotion = useReducedMotion();
  const tone = useSharedValue(status === "done" ? 1 : 0);
  const press = useSharedValue(1);

  useEffect(() => {
    tone.set(withTiming(status === "done" ? 1 : 0, { duration: reducedMotion ? 0 : 240 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const animStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(tone.get(), [0, 1], [color, doneColor]),
    transform: [{ scale: press.get() }],
  }));

  const off = disabled || status !== "idle";
  const entering = reducedMotion ? undefined : ROLL_IN;
  const exiting = reducedMotion ? undefined : ROLL_OUT;

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      onPressIn={() => press.set(withSpring(0.97, { duration: 160, dampingRatio: 0.9 }))}
      onPressOut={() => press.set(withSpring(1, { duration: 260, dampingRatio: 0.6 }))}
      accessibilityRole="button"
      accessibilityLabel={status === "busy" ? busyLabel : status === "done" ? doneLabel : label}
      accessibilityState={{ disabled: !!off, busy: status === "busy" }}
    >
      <Animated.View style={[styles.button, animStyle, disabled && status === "idle" && styles.off, style]}>
        {status === "idle" ? (
          <Animated.View key="idle" entering={entering} exiting={exiting} style={styles.row}>
            <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>{label}</Text>
          </Animated.View>
        ) : status === "busy" ? (
          <Animated.View key="busy" entering={entering} exiting={exiting} style={styles.row}>
            <ActivityIndicator color={textColor} size="small" />
            <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>{busyLabel}</Text>
          </Animated.View>
        ) : (
          <Animated.View key="done" entering={entering} exiting={exiting} style={styles.row}>
            <Check color={textColor} size={20} strokeWidth={3} />
            <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>{doneLabel}</Text>
          </Animated.View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 58,
    borderRadius: 999,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10, position: "absolute" },
  label: { fontSize: 17, fontWeight: "800", letterSpacing: -0.2 },
  off: { opacity: 0.45 },
});
