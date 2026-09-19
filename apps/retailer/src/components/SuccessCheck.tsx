import { useEffect } from "react";
import { Modal, StyleSheet, View } from "react-native";
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
import { Check } from "lucide-react-native";
import { colors } from "@loyalty-loop/design-tokens";

/** Brief (~0.5s) success confirmation shown after a stamp is awarded or a
 * reward is redeemed: a green checkmark that pops in with a spring, holds
 * briefly, then fades — so staff see confirmation register before the
 * screen resets for the next customer. Non-interactive: it sits on top of
 * the screen but never blocks taps. Matches the spring/timing feel used by
 * Sheet.tsx. */

const POP_SPRING = { duration: 300, dampingRatio: 0.8 }; // matches Sheet.tsx
const HOLD_MS = 500;
const FADE = { duration: 220, easing: Easing.out(Easing.quad) };

export function SuccessCheck({
  visible,
  onFinished,
}: {
  visible: boolean;
  onFinished: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    scale.set(0);
    opacity.set(1);
    scale.set(reducedMotion ? withTiming(1, { duration: 150 }) : withSpring(1, POP_SPRING));
    opacity.set(
      withDelay(
        HOLD_MS,
        withTiming(0, FADE, (finished) => {
          if (finished) scheduleOnRN(onFinished);
        }),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
    opacity: opacity.get(),
  }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.center}>
          <Animated.View style={[styles.circle, animStyle]}>
            <Check color="#fff" size={40} strokeWidth={3} />
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  circle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.funGreen,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
