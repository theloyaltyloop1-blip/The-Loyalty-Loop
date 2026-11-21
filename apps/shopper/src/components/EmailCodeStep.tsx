import { useEffect, useState, type ComponentProps } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { Session } from '@supabase/supabase-js'
import { schemeColor, themed } from '@loyalty-loop/design-tokens'
import { colors, fonts } from '../theme'
import { Whirl } from '../Whirl'
import { showAlert } from './AppAlert'
import { haptic } from '../haptics'
import { supabase } from '../supabase'
import { RESEND_SECONDS, cleanCode, codeErrorMessage, isCompleteCode } from '../email-code'

/** "Type the code from your email" step that confirms a new account and signs
 * the shopper in. Resent emails still carry the link (to the project's Site
 * URL, as the first email did) for anyone who taps it instead. */
export function EmailCodeStep({
  email,
  title,
  intro,
  pose = 'thumbs',
  onVerified,
  onChangeEmail,
}: {
  email: string
  title: string
  intro?: string
  pose?: ComponentProps<typeof Whirl>['pose']
  onVerified: (session: Session) => void
  onChangeEmail: () => void
}) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // An email has just been sent, so the timer starts straight away.
  const [wait, setWait] = useState(RESEND_SECONDS)

  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  async function verify() {
    if (busy) return
    if (!isCompleteCode(code)) return setProblem('Enter the 6-digit code from the email.')
    setProblem(null)
    setBusy(true)
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' })
      if (error) throw error
      if (!data.session) throw new Error('invalid')
      haptic.success()
      onVerified(data.session)
    } catch (e) {
      setProblem(codeErrorMessage(e instanceof Error ? e.message : ''))
      setBusy(false)
    }
  }

  async function resend() {
    if (wait > 0 || sending) return
    setSending(true)
    setProblem(null)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setSending(false)
    if (error) return setProblem(codeErrorMessage(error.message))
    setCode('')
    setWait(RESEND_SECONDS)
    showAlert('New code sent', `Check ${email}. Only the newest code works.`)
  }

  return (
    <>
      <Whirl pose={pose} size={104} style={{ alignSelf: 'flex-start', marginBottom: 4 }} />
      <Text style={styles.hero}>{title}</Text>
      <Text style={styles.copy}>
        We've sent a 6-digit code to <Text style={styles.strong}>{email}</Text>.{intro ? ` ${intro}` : ''}
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
          returnKeyType="done"
          onSubmitEditing={() => void verify()}
        />
        {problem && <Text style={styles.problem} accessibilityLiveRegion="polite">{problem}</Text>}
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void verify()}
          style={({ pressed }) => [styles.button, busy && { opacity: 0.55 }, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.buttonText}>{busy ? 'Checking…' : 'Confirm and continue'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={wait > 0 || sending} onPress={() => void resend()} style={styles.linkRow}>
          <Text style={[styles.link, (wait > 0 || sending) && styles.linkWaiting]}>
            {sending ? 'Sending…' : wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
          </Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>Can't see it? Check your spam folder. The email also has a link you can tap instead.</Text>
      <Pressable accessibilityRole="button" onPress={onChangeEmail} style={styles.linkRow}>
        <Text style={styles.back}>Use a different email</Text>
      </Pressable>
    </>
  )
}

const styles = themed(() =>
  StyleSheet.create({
    hero: { color: colors.foreground, fontSize: 36, fontFamily: fonts.nativeDisplay, lineHeight: 42, letterSpacing: -1 },
    copy: { color: schemeColor('#000000', 'fg'), fontSize: 16, lineHeight: 24, marginTop: 16 },
    strong: { fontWeight: '800' },
    card: { backgroundColor: colors.card, borderRadius: 20, padding: 20, marginTop: 28, gap: 12, shadowColor: '#1A2138', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
    codeInput: { backgroundColor: schemeColor('#EFEBE3', 'bg'), borderRadius: 14, paddingVertical: 16, color: colors.foreground, fontSize: 30, fontWeight: '800', letterSpacing: 8, textAlign: 'center' },
    problem: { color: schemeColor('#B5431C', 'fg'), fontSize: 14, fontWeight: '700', lineHeight: 20 },
    button: { backgroundColor: colors.primary, borderRadius: 999, alignItems: 'center', padding: 16, marginTop: 2 },
    buttonText: { color: schemeColor('#fff', 'fg'), fontWeight: '800', fontSize: 16 },
    linkRow: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 },
    link: { color: colors.primaryText, fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
    linkWaiting: { color: colors.muted, textDecorationLine: 'none' },
    hint: { color: schemeColor('#000000', 'fg'), fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 16 },
    back: { color: schemeColor('#000000', 'fg'), fontSize: 15, fontWeight: '700' },
  }),
)
