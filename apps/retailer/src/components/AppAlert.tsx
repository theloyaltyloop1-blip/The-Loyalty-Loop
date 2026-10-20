import { useEffect, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View, type AlertButton } from 'react-native'
import { colors as c, fonts } from '../theme'
import { Sheet } from './Sheet'

// Branded replacement for the grey system Alert: same call shape as
// Alert.alert(title, message, buttons, options), shown as a bottom sheet in
// the app's colours. <AppAlertHost /> must be mounted once near the root;
// until it is, calls fall back to the system Alert so nothing is ever lost.

type Request = { title: string; message?: string; buttons: AlertButton[]; cancelable: boolean }

let show: ((request: Request) => void) | null = null

export function showAlert(title: string, message?: string, buttons?: AlertButton[], options?: { cancelable?: boolean }) {
  const request: Request = {
    title,
    message,
    buttons: buttons?.length ? buttons : [{ text: 'OK' }],
    // Matches the system: a single OK button can always be dismissed.
    cancelable: options?.cancelable ?? true,
  }
  if (show) show(request)
  else Alert.alert(title, message, buttons, options)
}

/** A warm tint per kind of message, picked from the words in the title. */
function tone(title: string, buttons: AlertButton[]) {
  if (buttons.some((button) => button.style === 'destructive')) return { bg: c.peach, ink: c.destructive, glyph: '!' }
  if (/could not|couldn|error|failed|try again|check|problem/i.test(title)) return { bg: c.peach, ink: c.peachInk, glyph: '!' }
  if (/saved|thank|done|added|sent|welcome|success/i.test(title)) return { bg: c.sage, ink: c.funGreen, glyph: '✓' }
  return { bg: c.peach, ink: c.primary, glyph: '?' }
}

export function AppAlertHost() {
  const [queue, setQueue] = useState<Request[]>([])
  const [visible, setVisible] = useState(false)
  const current = queue[0]

  useEffect(() => {
    show = (request) => setQueue((items) => [...items, request])
    return () => {
      show = null
    }
  }, [])

  useEffect(() => {
    if (current) setVisible(true)
  }, [current])

  // Runs after the sheet has finished sliding away, then shows the next one.
  function closed() {
    setVisible(false)
    setQueue((items) => items.slice(1))
  }

  function press(button: AlertButton | undefined) {
    setVisible(false)
    // Let the sheet start closing before the action opens anything new.
    if (button?.onPress) setTimeout(() => button.onPress?.(), 0)
  }

  if (!current) return null
  const { bg, ink, glyph } = tone(current.title, current.buttons)
  const cancel = current.buttons.find((button) => button.style === 'cancel')
  // The system Alert puts the main action last; here it goes on top as the
  // filled button, the other choices under it and Cancel at the bottom.
  const actions = current.buttons.filter((button) => button.style !== 'cancel')
  const ordered = [...actions.slice(-1), ...actions.slice(0, -1), ...(cancel ? [cancel] : [])]
  const primaryIndex = actions.length ? 0 : -1

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        // A drag or backdrop tap counts as Cancel when there is one.
        if (visible && cancel?.onPress) cancel.onPress()
        closed()
      }}
      sheetStyle={styles.sheet}
      dragArea="full"
    >
      <View style={styles.handle} />
      <View style={[styles.badge, { backgroundColor: bg }]}>
        <Text style={[styles.badgeText, { color: ink }]}>{glyph}</Text>
      </View>
      <Text style={styles.title}>{current.title}</Text>
      {!!current.message && <Text style={styles.message}>{current.message}</Text>}
      <View style={styles.buttons}>
        {ordered.map((button, index) => {
          const destructive = button.style === 'destructive'
          const isCancel = button.style === 'cancel'
          const main = index === primaryIndex && !isCancel
          return (
            <Pressable
              key={`${button.text}-${index}`}
              accessibilityRole="button"
              onPress={() => press(button)}
              style={({ pressed }) => [
                styles.button,
                main ? { backgroundColor: destructive ? c.destructive : c.primary } : isCancel ? styles.cancel : styles.secondary,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Text style={[styles.buttonText, main ? { color: '#FFFFFF' } : destructive ? { color: c.destructive } : { color: c.foreground }]}>
                {button.text ?? 'OK'}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: c.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 34,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: c.border, marginBottom: 18 },
  badge: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  badgeText: { fontSize: 24, fontFamily: fonts.nativeDisplay },
  title: { color: c.foreground, fontSize: 24, lineHeight: 29, letterSpacing: -0.4, fontFamily: fonts.nativeDisplay },
  message: { color: c.muted, fontSize: 16, lineHeight: 23, marginTop: 8 },
  buttons: { marginTop: 22, gap: 10 },
  button: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  secondary: { backgroundColor: c.background, borderWidth: 1, borderColor: c.border },
  cancel: { backgroundColor: 'transparent' },
  buttonText: { fontSize: 16, fontWeight: '700' },
})
