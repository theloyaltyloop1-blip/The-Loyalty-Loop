import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@loyalty-loop/design-tokens";
import type { SnapshotStanding } from "@loyalty-loop/loyalty";
import { showAlert } from "./components/AppAlert";
import { supabase } from "./supabase";

// Custom programmes with a cash value ("3 points = £1 off"): staff choose how
// much to take off and the database moves the points (redeem_points_for_cash).

const { primary: orange } = colors;

// Idempotency key (not a secret): a retry after a dropped connection reuses it.
function newRef(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function errorMessage(raw: string): string {
  if (raw.includes("not_enough_points")) return "They don't have enough points for that.";
  if (raw.includes("above_visit_limit")) return "That's more than this shop allows off in one visit.";
  if (raw.includes("points_not_a_whole_step")) return "Points come off in whole steps.";
  if (raw.includes("not_allowed")) return "You don't have permission to do that here.";
  return "Could not take the points off. Try again.";
}

export function CashOff({
  businessId, customerId, name, standing, pounds, onDone,
}: {
  businessId: string;
  customerId: string;
  name: string;
  standing: Extract<SnapshotStanding, { kind: "points" }>;
  pounds: (pence: number) => string;
  onDone: () => void;
}) {
  const cash = standing.cash;
  const [steps, setSteps] = useState(1);
  const [busy, setBusy] = useState(false);
  const ref = useRef<string | null>(null);
  if (!cash || cash.availablePoints < cash.points) return null;
  const units = standing.units ?? { one: "point", many: "points" };
  const maxSteps = Math.floor(cash.availablePoints / cash.points);
  const n = Math.min(Math.max(1, steps), maxSteps);
  const points = n * cash.points;
  const pence = n * cash.pence;

  async function run() {
    ref.current = ref.current ?? newRef();
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("redeem_points_for_cash", {
        _business_id: businessId, _customer_id: customerId, _points: points, _client_ref: ref.current,
      });
      if (error) throw error;
      ref.current = null;
      const r = data as { discountPence: number; pointsBalance: number };
      showAlert(`Take ${pounds(r.discountPence)} off`, `${name} has ${r.pointsBalance} ${r.pointsBalance === 1 ? units.one : units.many} left.`);
      setSteps(1);
      onDone();
    } catch (e) {
      const raw = (e as { message?: string } | null)?.message ?? "";
      if (/not_enough_points|above_visit_limit|points_not_a_whole_step|not_allowed|shop_has_no_cash_value|invalid_/.test(raw)) ref.current = null;
      showAlert("Not taken off", errorMessage(raw));
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    showAlert(`Use ${points} ${points === 1 ? units.one : units.many}?`, `${pounds(pence)} comes off ${name}'s bill.`, [
      { text: "Cancel", style: "cancel" },
      { text: `Take ${pounds(pence)} off`, onPress: () => void run() },
    ]);
  }

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Money off with {units.many}</Text>
      <View style={styles.row}>
        <Pressable accessibilityLabel="Less" disabled={n <= 1} onPress={() => setSteps(n - 1)} style={[styles.step, n <= 1 && { opacity: 0.3 }]}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Text style={styles.value}>{pounds(pence)} <Text style={styles.sub}>for {points} {units.many}</Text></Text>
        <Pressable accessibilityLabel="More" disabled={n >= maxSteps} onPress={() => setSteps(n + 1)} style={[styles.step, n >= maxSteps && { opacity: 0.3 }]}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" disabled={busy} onPress={confirm} style={[styles.button, busy && { opacity: 0.5 }]}>
        <Text style={styles.buttonText}>{busy ? "Taking off…" : `Take ${pounds(pence)} off`}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: "#FFF3DC", borderRadius: 16, padding: 14, marginTop: 10 },
  title: { color: "#000", fontSize: 15, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  step: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  stepText: { color: "#000", fontSize: 22, fontWeight: "800" },
  value: { flex: 1, textAlign: "center", color: "#000", fontSize: 18, fontWeight: "800" },
  sub: { fontSize: 13, fontWeight: "500" },
  button: { backgroundColor: orange, borderRadius: 999, minHeight: 46, alignItems: "center", justifyContent: "center", marginTop: 10 },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
