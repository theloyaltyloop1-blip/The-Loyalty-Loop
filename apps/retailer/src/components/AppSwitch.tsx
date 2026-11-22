import React from "react";
import { Switch, type SwitchProps } from "react-native";
import { schemeColor } from "@loyalty-loop/design-tokens";

// The one on/off switch for this app. Fixed track colours so the state is
// obvious on white, sage, peach and amber tiles, light or dark: dark blue = on,
// mid grey = off, white knob. Callers pass value / onValueChange / disabled only.
export function AppSwitch({ trackColor: _ignored, thumbColor: _ignoredThumb, ...props }: SwitchProps) {
  const off = schemeColor("#8E94A3", "bg");
  const on = schemeColor("#2B3A67", "bg");
  return (
    <Switch
      accessibilityRole="switch"
      {...props}
      trackColor={{ false: off, true: on }}
      ios_backgroundColor={off}
      thumbColor="#FFFFFF"
    />
  );
}
