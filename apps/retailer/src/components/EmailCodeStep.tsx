import { useEffect, useState, type ComponentProps } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { colors, fonts, schemeColor, themed } from "@loyalty-loop/design-tokens";
import { Whirl } from "../Whirl";
import { showAlert } from "./AppAlert";
import { haptic } from "../haptics";
import { supabase } from "../supabase";
import { RESEND_SECONDS, cleanCode, codeErrorMessage, isCompleteCode } from "../email-code";

/** "Type the code from your email" step. `signup` confirms a new account;
 * `recovery` also asks for a new password and saves it. Either way the person
 * ends up signed in, and `onVerified` gets the session. Resent emails still
 * carry the old link (`redirectTo`) for anyone who taps it instead. */
export function EmailCodeStep({
  email,
  purpose,
  redirectTo,
  title,
  intro,
  pose = "thumbs",
  onVerified,
  onChangeEmail,
}: {
  email: string;
  purpose: "signup" | "recovery";
  redirectTo: string;
  title: string;
  intro?: string;
  pose?: ComponentProps<typeof Whirl>["pose"];
  onVerified: (session: Session) => void;
  onChangeEmail: () => void;
}) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // An email has just been sent, so the timer starts straight away.
  const [wait, setWait] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function verify() {
    if (busy) return;
    if (!isCompleteCode(code)) return setProblem("Enter the 6-digit code from the email.");
    if (purpose === "recovery" && password.length < 8) return setProblem("Choose a new password of at least 8 characters.");
    setProblem(null);
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: purpose });
      if (error) throw error;
      if (!data.session) throw new Error("invalid");
      if (purpose === "recovery") {
        // The code has signed them in, so the app may move on from this screen
        // now. The password is saved regardless and the pop-up still shows.
        const { error: saveError } = await supabase.auth.updateUser({ password });
        if (saveError)
          showAlert(
            "You're signed in, but your password wasn't changed",
            `${codeErrorMessage(saveError.message)} You can try again later with “Forgot password?”.`,
          );
        else showAlert("Password changed", "Use your new password next time you sign in.", undefined, { whirl: "thumbs" });
      }
      haptic.success();
      onVerified(data.session);
    } catch (e) {
      setProblem(codeErrorMessage(e instanceof Error ? e.message : ""));
      setBusy(false);
    }
  }

  async function resend() {
    if (wait > 0 || sending) return;
    setSending(true);
    setProblem(null);
    const { error } =
      purpose === "signup"
        ? await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: redirectTo } })
        : await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setSending(false);
    if (error) return setProblem(codeErrorMessage(error.message));
    setCode("");
    setWait(RESEND_SECONDS);
    showAlert("New code sent", `Check ${email}. Only the newest code works.`);
  }

  return (
    <>
      <Whirl pose={pose} size={110} style={{ alignSelf: "center", marginBottom: 6 }} />
      <Text style={[styles.hero, { textAlign: "center" }]}>{title}</Text>
      <Text style={[styles.copy, { textAlign: "center" }]}>
        We've sent a 6-digit code to <Text style={styles.strong}>{email}</Text>.{intro ? ` ${intro}` : ""}
      </Text>
      <View style={styles.card}>
        <TextInput
          style={styles.codeInput}
          value={code}
          onChangeText={(text) => setCode(cleanCode(text))}
          placeholder="000000"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={10}
          autoFocus
          accessibilityLabel="Code from the email"
          returnKeyType={purpose === "signup" ? "done" : "next"}
          onSubmitEditing={purpose === "signup" ? () => void verify() : undefined}
        />
        {purpose === "recovery" && (
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="New password (8+ characters)"
            placeholderTextColor={colors.muted}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={() => void verify()}
          />
        )}
        {problem && <Text style={styles.problem} accessibilityLiveRegion="polite">{problem}</Text>}
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void verify()}
          style={({ pressed }) => [styles.button, busy && { opacity: 0.55 }, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.buttonText}>
            {busy ? "Checking…" : purpose === "signup" ? "Confirm and continue" : "Save new password"}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={wait > 0 || sending} onPress={() => void resend()} style={styles.linkRow}>
          <Text style={[styles.link, (wait > 0 || sending) && styles.linkWaiting]}>
            {sending ? "Sending…" : wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}
          </Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>Can't see it? Check your spam folder. The email also has a link you can tap instead.</Text>
      <Pressable accessibilityRole="button" onPress={onChangeEmail} style={styles.linkRow}>
        <Text style={styles.back}>Use a different email</Text>
      </Pressable>
    </>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    hero: { color: schemeColor("#000000", "fg"), fontSize: 34, lineHeight: 40, letterSpacing: -1, fontFamily: fonts.nativeDisplay },
    copy: { color: schemeColor("#000000", "fg"), fontSize: 16, lineHeight: 24, marginTop: 8 },
    strong: { fontWeight: "800" },
    card: {
      backgroundColor: schemeColor("#fff", "bg"),
      borderRadius: 18,
      padding: 18,
      marginTop: 22,
      gap: 12,
      elevation: 2,
      shadowColor: "#2B3A67",
      shadowOpacity: 0.08,
      shadowRadius: 15,
    },
    codeInput: {
      backgroundColor: schemeColor("#f4f1eb", "bg"),
      borderRadius: 14,
      paddingVertical: 16,
      color: schemeColor("#1A2138", "fg"),
      fontSize: 30,
      fontWeight: "800",
      letterSpacing: 8,
      textAlign: "center",
    },
    input: {
      backgroundColor: schemeColor("#f4f1eb", "bg"),
      borderRadius: 11,
      paddingHorizontal: 14,
      paddingVertical: 14,
      color: schemeColor("#243021", "fg"),
      fontSize: 16,
    },
    problem: { color: schemeColor("#B5431C", "fg"), fontSize: 14, fontWeight: "700", lineHeight: 20 },
    button: {
      backgroundColor: schemeColor("#1A2138", "bg"),
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 52,
      padding: 15,
      marginTop: 3,
    },
    buttonText: { color: schemeColor("#fff", "fg"), fontWeight: "800", fontSize: 15, textAlign: "center" },
    linkRow: { alignItems: "center", justifyContent: "center", minHeight: 44, paddingHorizontal: 12 },
    link: { color: colors.primary, fontSize: 15, fontWeight: "800", textDecorationLine: "underline" },
    linkWaiting: { color: colors.muted, textDecorationLine: "none" },
    hint: { color: schemeColor("#000000", "fg"), fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 16 },
    back: { color: schemeColor("#000000", "fg"), fontSize: 15, fontWeight: "700" },
  }),
);
