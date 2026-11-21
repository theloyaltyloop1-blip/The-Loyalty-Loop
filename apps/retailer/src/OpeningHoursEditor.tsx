import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Clock, Copy } from "lucide-react-native";
import { colors, fonts, schemeColor, themed } from "@loyalty-loop/design-tokens";
import { Sheet } from "./components/Sheet";
import { haptic } from "./haptics";

// Same shape as the website (apps/web/src/lib/businesses.ts) and the shopper
// app (apps/shopper/src/shop-profile.tsx): businesses.opening_hours. A missing
// day means closed. Times are "HH:MM", 24 hour. Every reader (shopper
// openStatus, website openStatus, walk-past alerts SQL) treats a day as open
// only between open and close on the same day, so close must be after open.
export type DayHours = { closed: boolean; open: string; close: string };
export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type OpeningHours = Partial<Record<DayKey, DayHours>>;

export const HOURS_DAYS: { key: DayKey; label: string; short: string }[] = [
  { key: "mon", label: "Monday", short: "Mon" },
  { key: "tue", label: "Tuesday", short: "Tue" },
  { key: "wed", label: "Wednesday", short: "Wed" },
  { key: "thu", label: "Thursday", short: "Thu" },
  { key: "fri", label: "Friday", short: "Fri" },
  { key: "sat", label: "Saturday", short: "Sat" },
  { key: "sun", label: "Sunday", short: "Sun" },
];

// The website's default for a day the owner switches on.
const DEFAULT_HOURS: DayHours = { closed: false, open: "09:00", close: "17:00" };
const WEEKDAYS: DayKey[] = ["tue", "wed", "thu", "fri"];
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => h);
const MINUTE_OPTIONS = [0, 15, 30, 45];

const minutesOf = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const pad = (n: number) => String(n).padStart(2, "0");

/** "09:30" -> "9:30am", "17:00" -> "5pm" (matches the shopper app's wording). */
export function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${pad(m)}${period}` : `${h12}${period}`;
}

const hourLabel = (h: number) => (h === 0 ? "12am" : h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h - 12}pm`);

export function hasHours(hours: OpeningHours | null | undefined) {
  return Boolean(hours && Object.keys(hours).length > 0);
}

/** The first open day whose closing time is not after its opening time, or null. */
export function invalidHoursDay(hours: OpeningHours): string | null {
  for (const { key, label } of HOURS_DAYS) {
    const day = hours[key];
    if (day && !day.closed && minutesOf(day.close) <= minutesOf(day.open)) return label;
  }
  return null;
}

type Picking = { day: DayKey; field: "open" | "close" } | null;

export function OpeningHoursEditor({
  hours,
  onChange,
}: {
  hours: OpeningHours;
  onChange: (next: OpeningHours) => void;
}) {
  const [picking, setPicking] = useState<Picking>(null);
  const [draft, setDraft] = useState("09:00");
  const [sheetOpen, setSheetOpen] = useState(false);

  const dayOf = (key: DayKey): DayHours => hours[key] ?? { ...DEFAULT_HOURS, closed: true };
  const setDay = (key: DayKey, next: DayHours) => onChange({ ...hours, [key]: next });

  const openPicker = (day: DayKey, field: "open" | "close") => {
    setPicking({ day, field });
    setDraft(dayOf(day)[field]);
    setSheetOpen(true);
  };
  const confirmPicker = () => {
    if (picking) setDay(picking.day, { ...dayOf(picking.day), [picking.field]: draft });
    haptic.tap();
    setSheetOpen(false);
  };

  const monday = hours.mon;
  const copyMonday = () => {
    if (!monday) return;
    const next = { ...hours };
    for (const key of WEEKDAYS) next[key] = { ...monday };
    onChange(next);
    haptic.success();
  };

  const [draftHour, draftMinute] = draft.split(":").map(Number);
  const pickingLabel = picking ? HOURS_DAYS.find((d) => d.key === picking.day)?.label : "";

  return (
    <View>
      {HOURS_DAYS.map(({ key, label }) => {
        const day = dayOf(key);
        const bad = !day.closed && minutesOf(day.close) <= minutesOf(day.open);
        return (
          <View key={key} style={styles.dayRow}>
            <Text style={styles.dayLabel}>{label}</Text>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel={`${label} ${day.closed ? "closed" : "open"}`}
              accessibilityState={{ checked: !day.closed }}
              onPress={() => {
                haptic.select();
                setDay(key, { ...day, closed: !day.closed });
              }}
              style={({ pressed }) => [styles.toggle, day.closed ? styles.toggleClosed : styles.toggleOpen, pressed && styles.pressed]}
            >
              <Text style={[styles.toggleText, day.closed ? styles.toggleTextClosed : styles.toggleTextOpen]}>
                {day.closed ? "Closed" : "Open"}
              </Text>
            </Pressable>
            {day.closed ? (
              <View style={{ flex: 1 }} />
            ) : (
              <View style={styles.times}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${label} opens at ${formatTime(day.open)}. Change`}
                  onPress={() => openPicker(key, "open")}
                  style={({ pressed }) => [styles.timeChip, bad && styles.timeChipBad, pressed && styles.pressed]}
                >
                  <Text style={styles.timeText}>{formatTime(day.open)}</Text>
                </Pressable>
                <Text style={styles.to}>to</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${label} closes at ${formatTime(day.close)}. Change`}
                  onPress={() => openPicker(key, "close")}
                  style={({ pressed }) => [styles.timeChip, bad && styles.timeChipBad, pressed && styles.pressed]}
                >
                  <Text style={styles.timeText}>{formatTime(day.close)}</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
      {invalidHoursDay(hours) ? (
        <Text style={styles.warning}>Closing time must be after opening time. Overnight hours are not supported yet.</Text>
      ) : null}
      {monday ? (
        <Pressable
          accessibilityRole="button"
          onPress={copyMonday}
          style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}
        >
          <Copy size={17} color={schemeColor("#2F7A3F", "fg")} />
          <Text style={styles.copyText}>Copy Monday to Tuesday–Friday</Text>
        </Pressable>
      ) : null}

      <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} dragArea="full" sheetStyle={styles.sheet}>
        <SafeAreaView edges={["bottom"]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetTitleRow}>
            <View style={styles.sheetIcon}>
              <Clock size={20} color={schemeColor("#2F7A3F", "fg")} />
            </View>
            <Text style={styles.sheetTitle}>
              {pickingLabel} {picking?.field === "close" ? "closes at" : "opens at"}
            </Text>
          </View>
          <Text style={styles.sheetValue}>{formatTime(draft)}</Text>
          <Text style={styles.sheetLabel}>Hour</Text>
          <View style={styles.grid}>
            {HOUR_OPTIONS.map((h) => {
              const active = h === draftHour;
              return (
                <Pressable
                  key={h}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  onPress={() => {
                    haptic.tick();
                    setDraft(`${pad(h)}:${pad(draftMinute || 0)}`);
                  }}
                  style={[styles.hourChip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{hourLabel(h)}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.sheetLabel}>Minutes</Text>
          <View style={styles.minuteRow}>
            {MINUTE_OPTIONS.map((m) => {
              const active = m === draftMinute;
              return (
                <Pressable
                  key={m}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  onPress={() => {
                    haptic.tick();
                    setDraft(`${pad(draftHour || 0)}:${pad(m)}`);
                  }}
                  style={[styles.minuteChip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>:{pad(m)}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={confirmPicker}
            style={({ pressed }) => [styles.done, pressed && styles.pressed]}
          >
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </SafeAreaView>
      </Sheet>
    </View>
  );
}

/** Read-only list for staff, who cannot edit shop details. */
export function OpeningHoursSummary({ hours }: { hours: OpeningHours | null | undefined }) {
  if (!hasHours(hours)) return <Text style={styles.summaryValue}>Not set</Text>;
  return (
    <View>
      {HOURS_DAYS.map(({ key, label }) => {
        const day = hours?.[key];
        return (
          <View key={key} style={styles.summaryRow}>
            <Text style={styles.summaryValue}>{label}</Text>
            <Text style={styles.summaryValue}>
              {!day || day.closed ? "Closed" : `${formatTime(day.open)} to ${formatTime(day.close)}`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
    dayRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      minHeight: 52,
      borderBottomWidth: 1,
      borderBottomColor: schemeColor("rgba(20,20,18,.07)", "border"),
    },
    dayLabel: { width: 84, fontSize: 14, fontWeight: "800", color: schemeColor("#000000", "fg") },
    toggle: { minWidth: 70, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
    toggleOpen: { backgroundColor: schemeColor("#DCEBD9", "bg") },
    toggleClosed: { backgroundColor: schemeColor("#EFEBE3", "bg") },
    toggleText: { fontSize: 13, fontWeight: "800" },
    toggleTextOpen: { color: schemeColor("#2F7A3F", "fg") },
    toggleTextClosed: { color: schemeColor("#6F6B64", "fg") },
    times: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 },
    timeChip: {
      minWidth: 64,
      height: 34,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: schemeColor("rgba(20,20,18,.12)", "border"),
      backgroundColor: schemeColor("#fff", "bg"),
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    timeChipBad: { borderColor: schemeColor("#B73B32", "border"), backgroundColor: schemeColor("#F8DCD8", "bg") },
    timeText: { fontSize: 14, fontWeight: "800", color: schemeColor("#1A2138", "fg") },
    to: { fontSize: 13, color: schemeColor("#6F6B64", "fg") },
    warning: { fontSize: 13, lineHeight: 19, color: schemeColor("#B73B32", "fg"), marginTop: 10, fontWeight: "700" },
    copyButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 14,
      height: 44,
      borderRadius: 22,
      backgroundColor: schemeColor("#DCEBD9", "bg"),
    },
    copyText: { fontSize: 14, fontWeight: "800", color: schemeColor("#2F7A3F", "fg") },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 22,
      paddingTop: 10,
      paddingBottom: 12,
    },
    sheetHandle: {
      alignSelf: "center",
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: schemeColor("rgba(0,0,0,0.18)", "bg"),
      marginBottom: 16,
    },
    sheetTitleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    sheetIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: schemeColor("#DCEBD9", "bg"),
      alignItems: "center",
      justifyContent: "center",
    },
    sheetTitle: { flex: 1, fontSize: 21, fontFamily: fonts.nativeDisplay, color: colors.foreground },
    sheetValue: { fontSize: 34, fontWeight: "900", color: schemeColor("#1A2138", "fg"), textAlign: "center", marginTop: 14 },
    sheetLabel: { fontSize: 13, fontWeight: "800", color: schemeColor("#000000", "fg"), marginTop: 14, marginBottom: 8 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    hourChip: {
      width: "15%",
      flexGrow: 1,
      height: 38,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: schemeColor("rgba(20,20,18,.12)", "border"),
      backgroundColor: schemeColor("#fff", "bg"),
      alignItems: "center",
      justifyContent: "center",
    },
    minuteRow: { flexDirection: "row", gap: 8 },
    minuteChip: {
      flex: 1,
      height: 42,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: schemeColor("rgba(20,20,18,.12)", "border"),
      backgroundColor: schemeColor("#fff", "bg"),
      alignItems: "center",
      justifyContent: "center",
    },
    chipActive: { backgroundColor: schemeColor("#1A2138", "bg"), borderColor: schemeColor("#1A2138", "border") },
    chipText: { fontSize: 13, fontWeight: "800", color: schemeColor("#000000", "fg") },
    chipTextActive: { color: schemeColor("#fff", "fg") },
    done: {
      height: 54,
      borderRadius: 27,
      backgroundColor: schemeColor("#1A2138", "bg"),
      alignItems: "center",
      justifyContent: "center",
      marginTop: 18,
    },
    doneText: { color: schemeColor("#fff", "fg"), fontSize: 16, fontWeight: "900" },
    summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
    summaryValue: { fontSize: 15, lineHeight: 22, color: schemeColor("#000000", "fg"), fontWeight: "600" },
  }),
);
