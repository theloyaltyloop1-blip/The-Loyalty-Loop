import { useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { schemeColor, themed } from "@loyalty-loop/design-tokens";
import { Sheet } from "./Sheet";

/**
 * Colour wheel picker. Pure JS: react-native-svg draws the wheel and a View +
 * PanResponder handles touch, so it ships by OTA (no native module).
 * Hue = angle, saturation = distance from the centre, brightness = the slider.
 * The value in and out is always a "#RRGGBB" hex string, so saved card designs
 * keep the same format.
 */

type Hsv = { h: number; s: number; v: number };

export function hexToHsv(hex: string): Hsv {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { h: 0, s: 0, v: 1 };
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255,
    g = ((n >> 8) & 255) / 255,
    b = (n & 255) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = v - c;
  const [r, g, b] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x];
  const part = (k: number) =>
    Math.round((k + m) * 255).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

const WEDGES = 90;

function Wheel({
  size,
  hsv,
  onChange,
}: {
  size: number;
  hsv: Hsv;
  onChange: (next: Partial<Hsv>) => void;
}) {
  const r = size / 2;
  const start = useRef({ x: 0, y: 0 });
  const latest = useRef({ size, onChange });
  latest.current = { size, onChange };

  const apply = (x: number, y: number) => {
    const { size: sz, onChange: cb } = latest.current;
    const c = sz / 2;
    const dx = x - c,
      dy = y - c;
    let h = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (h < 0) h += 360;
    cb({ h, s: clamp(Math.hypot(dx, dy) / c, 0, 1) });
  };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          start.current = {
            x: e.nativeEvent.locationX,
            y: e.nativeEvent.locationY,
          };
          apply(start.current.x, start.current.y);
        },
        onPanResponderMove: (_e, g) =>
          apply(start.current.x + g.dx, start.current.y + g.dy),
      }),
    [],
  );

  const wedges = useMemo(() => {
    const step = 360 / WEDGES;
    return Array.from({ length: WEDGES }, (_, i) => {
      const a0 = ((i * step - 0.6) * Math.PI) / 180,
        a1 = (((i + 1) * step + 0.6) * Math.PI) / 180;
      const p = (a: number) =>
        `${(r + r * Math.cos(a)).toFixed(2)} ${(r + r * Math.sin(a)).toFixed(2)}`;
      return {
        d: `M ${r} ${r} L ${p(a0)} A ${r} ${r} 0 0 1 ${p(a1)} Z`,
        fill: hsvToHex({ h: i * step + step / 2, s: 1, v: 1 }),
      };
    });
  }, [r]);

  const ang = (hsv.h * Math.PI) / 180;
  const tx = r + Math.cos(ang) * hsv.s * r,
    ty = r + Math.sin(ang) * hsv.s * r;

  return (
    <View
      accessible
      accessibilityLabel="Colour wheel. Drag to choose a colour."
      style={{ width: size, height: size }}
      {...pan.panHandlers}
    >
      <Svg width={size} height={size} pointerEvents="none">
        <Defs>
          <RadialGradient id="wheelWhite" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {wedges.map((w, i) => (
          <Path key={i} d={w.d} fill={w.fill} stroke={w.fill} strokeWidth={0.5} />
        ))}
        <Circle cx={r} cy={r} r={r} fill="url(#wheelWhite)" />
        <Circle cx={r} cy={r} r={r} fill="#000000" opacity={1 - hsv.v} />
      </Svg>
      <View
        pointerEvents="none"
        style={[
          s.thumb,
          {
            left: tx - 16,
            top: ty - 16,
            backgroundColor: hsvToHex(hsv),
          },
        ]}
      />
    </View>
  );
}

function BrightnessSlider({
  width,
  hsv,
  onChange,
}: {
  width: number;
  hsv: Hsv;
  onChange: (v: number) => void;
}) {
  const start = useRef(0);
  const latest = useRef({ width, onChange });
  latest.current = { width, onChange };
  const apply = (x: number) =>
    latest.current.onChange(clamp(x / latest.current.width, 0, 1));
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          start.current = e.nativeEvent.locationX;
          apply(start.current);
        },
        onPanResponderMove: (_e, g) => apply(start.current + g.dx),
      }),
    [],
  );
  const bright = hsvToHex({ h: hsv.h, s: hsv.s, v: 1 });
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Brightness"
      accessibilityValue={{ text: `${Math.round(hsv.v * 100)} percent` }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) =>
        onChange(
          clamp(
            hsv.v + (e.nativeEvent.actionName === "increment" ? 0.1 : -0.1),
            0,
            1,
          ),
        )
      }
      style={{ width, height: 48, justifyContent: "center" }}
      {...pan.panHandlers}
    >
      <Svg width={width} height={28} pointerEvents="none">
        <Defs>
          <LinearGradient id="brightGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#000000" />
            <Stop offset="1" stopColor={bright} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={28} rx={14} fill="url(#brightGrad)" />
      </Svg>
      <View
        pointerEvents="none"
        style={[
          s.thumb,
          {
            left: clamp(hsv.v * width, 0, width) - 16,
            top: 8,
            backgroundColor: hsvToHex(hsv),
          },
        ]}
      />
    </View>
  );
}

/** A labelled swatch button. Tapping it opens a sheet with the colour wheel. */
export function ColourPickerField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const { width } = useWindowDimensions();
  const wheel = Math.round(clamp(width - 72, 200, 320));

  // Load the saved colour into the wheel whenever it changes from outside
  // (template picked, changes discarded). Ignore echoes of our own change so
  // greys and dark colours do not lose their hue while dragging.
  useEffect(() => {
    if (hsvToHex(hsv).toLowerCase() !== value.toLowerCase())
      setHsv(hexToHsv(value));
  }, [value]);

  const update = (next: Partial<Hsv>) => {
    const merged = { ...hsv, ...next };
    setHsv(merged);
    onChange(hsvToHex(merged));
  };

  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}. Tap to change.`}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[s.swatchButton, disabled && { opacity: 0.5 }]}
      >
        <View style={[s.swatch, { backgroundColor: value }]} />
        <Text style={s.swatchText}>Change</Text>
      </Pressable>
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        dragArea="handle"
        sheetStyle={s.sheet}
      >
        <View style={s.handle} />
        <Text style={s.sheetTitle}>{label}</Text>
        <View style={{ alignItems: "center", gap: 14 }}>
          <Wheel size={wheel} hsv={hsv} onChange={update} />
          <Text style={s.hint}>Drag around the wheel for colour. Move toward the middle for softer shades.</Text>
          <Text style={s.hintLabel}>Brightness</Text>
          <BrightnessSlider
            width={wheel}
            hsv={hsv}
            onChange={(v) => update({ v })}
          />
          <View style={s.previewRow}>
            <View style={[s.previewSwatch, { backgroundColor: hsvToHex(hsv) }]} />
            <Text style={s.hexText}>{hsvToHex(hsv)}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setOpen(false)}
          style={s.done}
        >
          <Text style={s.doneText}>Done</Text>
        </Pressable>
      </Sheet>
    </View>
  );
}

const s = themed(() =>
  StyleSheet.create({
    field: { flexGrow: 1, minWidth: 120, gap: 8 },
    label: { fontSize: 16, fontWeight: "700", color: schemeColor("#1A2138", "fg") },
    swatchButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: 56,
      padding: 8,
      borderWidth: 1,
      borderColor: schemeColor("#A39E95", "border"),
      borderRadius: 14,
      backgroundColor: schemeColor("#FFFFFF", "bg"),
    },
    swatch: {
      width: 56,
      height: 40,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "rgba(0,0,0,0.2)",
    },
    swatchText: { color: schemeColor("#2B3A67", "fg"), fontSize: 15, fontWeight: "600" },
    sheet: {
      backgroundColor: schemeColor("#FFFFFF", "bg"),
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 22,
      paddingTop: 10,
      paddingBottom: 24,
      gap: 12,
    },
    handle: {
      alignSelf: "center",
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: schemeColor("rgba(0,0,0,0.18)", "bg"),
      marginBottom: 6,
    },
    sheetTitle: { fontSize: 20, fontWeight: "700", color: schemeColor("#1A2138", "fg") },
    hint: { color: schemeColor("#35443D", "fg"), fontSize: 14, textAlign: "center" },
    hintLabel: { alignSelf: "flex-start", fontWeight: "700", color: schemeColor("#1A2138", "fg") },
    thumb: {
      position: "absolute",
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 3,
      borderColor: "#FFFFFF",
      shadowColor: "#000",
      shadowOpacity: 0.4,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 4,
    },
    previewRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    previewSwatch: {
      width: 96,
      height: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(0,0,0,0.2)",
    },
    hexText: { fontSize: 16, fontWeight: "700", color: schemeColor("#1A2138", "fg") },
    done: {
      minHeight: 50,
      borderRadius: 25,
      backgroundColor: schemeColor("#2B3A67", "bg"),
      alignItems: "center",
      justifyContent: "center",
    },
    doneText: { fontWeight: "700", color: schemeColor("#FFFFFF", "fg"), fontSize: 16 },
  }),
);
