import { useEffect, useId, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Pattern,
  Rect,
  Stop,
} from "react-native-svg";
import {
  cardProgress,
  foreground,
  cardInk,
  cardAccent,
  normalizeDesign,
  designForProgress,
  materialOpacity,
  type CardDesign,
} from "./model";

export type CardShop = {
  name: string;
  logo_url?: string | null;
  brand_color?: string | null;
  card_design?: unknown;
};
const typeface = (font: CardDesign["font"]) =>
  ({
    modern: "BricolageGrotesque_700Bold",
    classic: "CardClassic",
    handwritten: "CardHandwritten",
    retro: "CardRetro",
  })[font];
export function StampIcon({
  icon,
  color,
  logo,
  size = 24,
}: {
  icon: CardDesign["icon"];
  color: string;
  logo?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [logo]);
  if (icon === "logo" && logo && !failed)
    return (
      <Image
        source={{ uri: logo }}
        resizeMode="contain"
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
      />
    );
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icon === "coffee" ? (
        <>
          <Path d="M4 8h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5ZM17 9h2a3 3 0 0 1 0 6h-2M3 22h16M7 2v3m5-3v3" />
        </>
      ) : icon === "scissors" ? (
        <>
          <Circle cx={6} cy={6} r={3} />
          <Circle cx={6} cy={18} r={3} />
          <Path d="m8 8 13 13M8 16 21 3" />
        </>
      ) : icon === "paw" ? (
        <>
          <Ellipse cx={12} cy={16} rx={6} ry={4} />
          <Ellipse cx={4} cy={10} rx={2} ry={3} />
          <Ellipse cx={9} cy={5} rx={2} ry={3} />
          <Ellipse cx={15} cy={5} rx={2} ry={3} />
          <Ellipse cx={20} cy={10} rx={2} ry={3} />
        </>
      ) : icon === "donut" ? (
        <>
          <Circle cx={12} cy={12} r={9} />
          <Circle cx={12} cy={12} r={3} />
          <Path d="m6 8 2 1m7-4 1 2m2 8 2-1m-10 4 1 2" />
        </>
      ) : (
        <Path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" />
      )}
    </Svg>
  );
}
function Material({ d }: { d: CardDesign }) {
  const id = useId().replace(/:/g, "");
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox="0 0 360 240"
      preserveAspectRatio="none"
      opacity={d.background === "gradient" ? 1 : materialOpacity(d.color)}
    >
      <Defs>
        <LinearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={d.color} />
          <Stop offset="1" stopColor={d.secondary} />
        </LinearGradient>
        <Pattern
          id={`${id}p`}
          width={d.background === "wood" ? 90 : 32}
          height={32}
          patternUnits="userSpaceOnUse"
        >
          {d.background === "kraft" ? (
            <G fill="#513018" opacity={0.22}>
              <Circle cx={3} cy={7} r={0.7} />
              <Circle cx={19} cy={23} r={1} />
              <Path d="m10 14 6-1m8-9 4 2" stroke="#513018" strokeWidth={0.5} />
            </G>
          ) : d.background === "wood" ? (
            <G stroke="#512E17" opacity={0.25}>
              <Path d="M0 4Q30 12 90 4M0 14Q50 5 90 14M0 25Q35 34 90 25" />
              <Ellipse cx={50} cy={18} rx={20} ry={4} />
            </G>
          ) : d.background === "chalkboard" ? (
            <G stroke="#FFFFFF" opacity={0.12}>
              <Path d="m0 6 27-2M4 18l28 3M0 30l15-2" />
            </G>
          ) : (
            <G stroke="#7C8991" opacity={0.35}>
              <Path d="m0 30 8-12 6 3 9-17 9-4M8 18 0 13m23-9 9 9" />
            </G>
          )}
        </Pattern>
      </Defs>
      <Rect
        width={360}
        height={240}
        fill={d.background === "gradient" ? `url(#${id}g)` : d.color}
      />
      {d.background === "roast" && (
        <G stroke={d.secondary} strokeOpacity={0.09} fill="none">
          {Array.from({ length: 22 }, (_, i) => (
            <Circle key={i} cx={285} cy={50} r={12 + i * 13} strokeWidth={1} />
          ))}
        </G>
      )}
      {d.background === "pinstripe" && (
        <G stroke="#FFFFFF" strokeOpacity={0.055} strokeWidth={8}>
          {Array.from({ length: 25 }, (_, i) => (
            <Path key={i} d={`M${i * 24 - 240} 0l240 240`} />
          ))}
        </G>
      )}
      {d.background === "paper" && (
        <G stroke="#AD783B" strokeOpacity={0.16} strokeWidth={0.6}>
          {Array.from({ length: 60 }, (_, i) => (
            <Path key={i} d={`M${i * 6} 0v240`} />
          ))}
        </G>
      )}
      {["kraft", "wood", "chalkboard", "marble"].includes(d.background) && (
        <Rect width={360} height={240} fill={`url(#${id}p)`} />
      )}
    </Svg>
  );
}
export function LoyaltyCard({
  shop,
  value = 0,
  target = 10,
  label,
  reward = "A little closer to your next reward",
  stamps = true,
  animate = false,
  compact = false,
  showProgress = true,
}: {
  shop: CardShop;
  value?: number;
  target?: number;
  label: string;
  reward?: string;
  stamps?: boolean;
  animate?: boolean;
  compact?: boolean;
  showProgress?: boolean;
}) {
  const d = designForProgress(
    normalizeDesign(shop.card_design, shop.brand_color),
    stamps,
  );
  const [contentWidth, setContentWidth] = useState(280);
  const [cardWidth, setCardWidth] = useState(350);
  const fg = cardInk(d.color),
    accent = cardAccent(d),
    progress = cardProgress(value, target);
  const scale = Math.min(1.7, Math.max(1, cardWidth / 640));
  const stampSize =
    d.layout === "row"
      ? Math.max(
          22,
          Math.min(
            38 * scale,
            (contentWidth - (progress.slots - 1) * 6) / progress.slots,
          ),
        )
      : 34 * scale;
  const jarId = useId().replace(/:/g, "");
  const motion = useRef(new Animated.Value(1)).current;
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null),
    [failedLogo, setFailedLogo] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!active || !animate || reduced || d.entrance === "none") return;
        motion.setValue(0);
        animation = Animated.spring(motion, {
          toValue: 1,
          damping: 19,
          stiffness: 180,
          mass: 0.7,
          useNativeDriver: true,
        });
        animation.start();
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (reduced) => {
        if (reduced) {
          animation?.stop();
          motion.setValue(1);
        }
      },
    );
    return () => {
      active = false;
      animation?.stop();
      sub.remove();
    };
  }, [animate, d.entrance, motion]);
  const transform =
    d.entrance === "flip"
      ? [
          { perspective: 900 },
          {
            rotateY: motion.interpolate({
              inputRange: [0, 1],
              outputRange: ["-65deg", "0deg"],
            }),
          },
        ]
      : [
          {
            scale: motion.interpolate({
              inputRange: [0, 1],
              outputRange: [0.92, 1],
            }),
          },
        ];
  const logo =
    shop.logo_url && failedLogo !== shop.logo_url ? shop.logo_url : null;
  const txt = {
    color: fg,
    fontFamily: typeface(d.font),
    backgroundColor: ["photo", "gradient"].includes(d.background) ? d.color : undefined,
  };
  return (
    <Animated.View
      onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}
      style={[
        s.card,
        { minHeight: Math.max(240, cardWidth * 0.34) },
        compact && s.compact,
        {
          backgroundColor: d.color,
          transform,
          borderColor: d.background === "pinstripe" ? accent : "transparent",
          borderWidth: d.background === "pinstripe" ? 2 : 1,
        },
      ]}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Material d={d} />
        {d.background === "photo" && d.photo && failedPhoto !== d.photo && (
          <Image
            source={{ uri: d.photo }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={() => setFailedPhoto(d.photo)}
          />
        )}
      </View>
      <View
        style={[
          s.heading,
          {
            alignItems:
              d.logoPosition === "center"
                ? "center"
                : d.logoPosition === "right"
                  ? "flex-end"
                  : "flex-start",
          },
        ]}
      >
        {logo && (
          <View style={s.logo}>
            <Image
              source={{ uri: logo }}
              resizeMode="contain"
              style={StyleSheet.absoluteFill}
              onError={() => setFailedLogo(logo)}
            />
          </View>
        )}
        <Text
          numberOfLines={2}
          style={[
            s.name,
            txt,
            { fontSize: 28 * scale, lineHeight: 34 * scale },

            d.font === "modern" && { fontStyle: "italic" },
            d.font === "retro" && {
              textTransform: "uppercase",
              letterSpacing: 2,
            },
            ["photo", "gradient"].includes(d.background) && {
              backgroundColor: d.color,
              padding: 8,
              borderRadius: 8,
            },
          ]}
        >
          {shop.name}
        </Text>
        {animate && d.icon === "coffee" && d.entrance !== "none" && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              right: 0,
              top: 22,
              opacity: motion.interpolate({
                inputRange: [0, 0.4, 1],
                outputRange: [0, 0.7, 0],
              }),
              transform: [
                {
                  translateY: motion.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, -16],
                  }),
                },
              ],
            }}
          >
            <Svg width={28} height={40} viewBox="0 0 28 40">
              <Path
                d="M8 36C-2 24 20 22 9 8M20 32C8 20 29 18 19 2"
                stroke={fg}
                strokeWidth={1.5}
                fill="none"
              />
            </Svg>
          </Animated.View>
        )}
        {d.background === "pinstripe" && !logo && (
          <View style={s.pole}>
            <Svg width={16} height={42} viewBox="0 0 16 42">
              <Rect width={16} height={42} rx={8} fill="#FFFFFF" />
              <Path
                d="m-5 15 25-25m-25 45 25-25"
                stroke="#BD382B"
                strokeWidth={7}
              />
              <Path d="m-5 55 25-25" stroke="#2354A0" strokeWidth={7} />
            </Svg>
          </View>
        )}
      </View>
      <View
        onLayout={(e) => setContentWidth(e.nativeEvent.layout.width)}
        style={[
          s.content,
          d.background === "photo" && {
            backgroundColor: d.color,
            padding: 12,
            borderRadius: 16,
          },
        ]}
      >
        {!showProgress ? (
          <StampIcon
            icon={d.icon}
            color={accent}
            logo={shop.logo_url}
            size={36}
          />
        ) : d.layout === "bar" ? (
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={label}
            accessibilityValue={{
              min: 0,
              max: progress.total,
              now: Math.min(progress.current, progress.total),
              text: label,
            }}
            style={s.bar}
          >
            <View
              style={[s.barTrack, { backgroundColor: fg, opacity: 0.16 }]}
            />
            <View
              style={[
                s.barFill,
                {
                  backgroundColor: accent,
                  width: `${progress.fraction * 100}%`,
                },
              ]}
            />
          </View>
        ) : stamps && (d.layout === "grid" || d.layout === "row") ? (
          <ScrollView
            horizontal={d.layout === "row"}
            scrollEnabled={d.layout === "row"}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              s.stamps,
              d.layout === "row" && { flexWrap: "nowrap", gap: 6 },
            ]}
            accessible
            accessibilityLabel={label}
          >
            {Array.from({ length: progress.slots }, (_, i) => {
              const filled = (i + 1) / progress.slots <= progress.fraction;
              return (
                <View
                  key={i}
                  style={[
                    s.stamp,
                    {
                      borderColor: accent,
                      backgroundColor: filled ? accent : "transparent",
                      width: stampSize,
                      height: stampSize,
                        borderRadius: stampSize / 2,
                    },
                  ]}
                >
                  {filled && (
                    <StampIcon
                      icon={d.icon}
                      color={foreground(accent)}
                      logo={shop.logo_url}
                      size={Math.max(13, stampSize * 0.57)}
                    />
                  )}
                </View>
              );
            })}
          </ScrollView>
        ) : d.layout === "jar" ? (
          <View style={s.graphic}>
            <Svg width={76} height={90} viewBox="0 0 76 90">
              <Defs>
                <LinearGradient id={jarId} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={accent} stopOpacity={0.9} />
                  <Stop offset="1" stopColor={accent} stopOpacity={0.5} />
                </LinearGradient>
              </Defs>
              <Rect
                x={13}
                y={17}
                width={50}
                height={68}
                rx={11}
                stroke={fg}
                strokeWidth={2}
                fill="none"
              />
              <Rect
                x={17}
                y={81 - 60 * progress.fraction}
                width={42}
                height={60 * progress.fraction}
                rx={7}
                fill={`url(#${jarId})`}
              />
              <Path d="M16 12h44M16 7h44" stroke={fg} strokeWidth={3} />
            </Svg>
            <Text style={[s.ringLabel, txt, { fontSize: 20 * scale, lineHeight: 28 * scale }]}>{label}</Text>
          </View>
        ) : (
          <View style={s.graphic}>
            <View>
              <Svg width={96 * scale} height={96 * scale} viewBox="0 0 96 96">
                <Circle
                  cx={48}
                  cy={48}
                  r={39}
                  stroke={accent}
                  strokeOpacity={0.2}
                  strokeWidth={12}
                  fill="none"
                />
                <Circle
                  cx={48}
                  cy={48}
                  r={39}
                  stroke={accent}
                  strokeWidth={12}
                  fill="none"
                  strokeDasharray={`${245 * progress.fraction} 245`}
                  transform="rotate(-90 48 48)"
                />
              </Svg>
              <View style={[s.ringIcon, { width: 96 * scale, height: 96 * scale }]}>
                <Text style={[s.ringNumber, txt, { fontSize: 21 * scale }]}>
                  {stamps
                    ? `${Math.min(value, target)}/${target}`
                    : `${Math.round(progress.fraction * 100)}%`}
                </Text>
              </View>
            </View>
            <Text style={[s.ringLabel, txt, { fontSize: 20 * scale, lineHeight: 28 * scale }]}>{label}</Text>
          </View>
        )}
        {d.layout !== "ring" && d.layout !== "jar" && (
          <Text
            style={[
              s.count,
              txt,
              { fontSize: 18 * scale, lineHeight: 25 * scale },
            ]}
          >
            {label}
          </Text>
        )}
        <Text
          style={[
            s.reward,
            {
              color: fg,
              backgroundColor: ["photo", "gradient"].includes(d.background) ? d.color : undefined,
              fontSize: 14 * scale,
              lineHeight: 20 * scale,
            },
            d.font === "handwritten" && {
              fontFamily: typeface(d.font),
              fontSize: 18 * scale,
              lineHeight: 25 * scale,
            },
          ]}
        >
          {reward}
        </Text>
      </View>
    </Animated.View>
  );
}
const s = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: "hidden",
    padding: 24,
    gap: 30,
    minHeight: 240,
    borderWidth: 1,
    borderColor: "transparent",
  },
  compact: { padding: 20, minHeight: 240, gap: 22 },
  heading: { gap: 8, position: "relative", paddingRight: 20 },
  logo: {
    width: 38,
    height: 38,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    overflow: "hidden",
  },
  name: { fontSize: 28, lineHeight: 34 },
  pole: {
    position: "absolute",
    right: 0,
    top: 0,
    overflow: "hidden",
    borderRadius: 8,
  },
  content: { gap: 16, flex: 1, justifyContent: "space-between" },
  stamps: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    paddingVertical: 2,
  },
  stamp: {
    borderWidth: 1.5,
    borderRadius: 24,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  count: { fontSize: 18, lineHeight: 25, marginTop: 12 },
  reward: { fontSize: 14, lineHeight: 20 },
  graphic: { alignItems: "center", flexDirection: "row", gap: 18 },
  ringIcon: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  ringNumber: { fontSize: 21 },
  ringLabel: { flex: 1, fontSize: 20, lineHeight: 28 },
  bar: { height: 14, borderRadius: 7, overflow: "hidden", marginTop: 14 },
  barTrack: { ...StyleSheet.absoluteFillObject },
  barFill: { height: 14 },
});
