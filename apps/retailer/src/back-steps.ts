// Android back button, one level at a time (2026-11-17).
//
// A screen with a level to step back from calls useBackStep(active, onBack):
// an owner page, a Shop sub-view, Analytics "Detailed", an onboarding step.
// The step activated most recently runs first. With no step active, back goes
// to the system, so on Home it leaves the app as usual. Sheets and pop-ups are
// React Native Modals and handle back themselves before this runs. On iOS
// BackHandler does nothing.
import { useEffect, useRef } from "react";
import { BackHandler } from "react-native";

type Step = { current: () => void };

const steps: Step[] = [];
let subscription: { remove: () => void } | null = null;

function onHardwareBack(): boolean {
  const top = steps[steps.length - 1];
  if (!top) return false;
  top.current();
  return true;
}

export function useBackStep(active: boolean, onBack: () => void) {
  const handler = useRef(onBack);
  handler.current = onBack;
  useEffect(() => {
    if (!active) return;
    const step: Step = handler;
    steps.push(step);
    if (!subscription) subscription = BackHandler.addEventListener("hardwareBackPress", onHardwareBack);
    return () => {
      const index = steps.lastIndexOf(step);
      if (index >= 0) steps.splice(index, 1);
      if (!steps.length && subscription) {
        subscription.remove();
        subscription = null;
      }
    };
  }, [active]);
}
