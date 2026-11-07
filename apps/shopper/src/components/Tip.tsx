import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { INK, PAPER, SANS_MEDIUM } from './Poster'

// One-time tips, shown where a feature is used instead of an up-front tour.
// A tip counts as seen the first time it appears, so it never comes back.
const seenThisRun = new Set<string>()
const keyFor = (id: string) => `tip_seen_${id}`

export function useTip(id: string) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (seenThisRun.has(id)) return
    let cancelled = false
    SecureStore.getItemAsync(keyFor(id)).then((seen) => {
      if (cancelled || seen === 'yes') return
      seenThisRun.add(id)
      setShow(true)
      void SecureStore.setItemAsync(keyFor(id), 'yes').catch(() => undefined)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [id])
  return { show, dismiss: () => setShow(false) }
}

/** A small dark bubble with an arrow pointing up at the thing it explains. */
export function Tip({ id, text, align = 'center' }: { id: string; text: string; align?: 'left' | 'center' | 'right' }) {
  const { show, dismiss } = useTip(id)
  if (!show) return null
  const alignItems = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${text}. Tap to hide`} onPress={dismiss} style={[s.wrap, { alignItems }]}>
      <View style={[s.arrow, align === 'left' && { marginLeft: 11 }, align === 'right' && { marginRight: 11 }]} />
      <View style={s.bubble}><Text style={s.text}>{text}</Text></View>
    </Pressable>
  )
}

const s = StyleSheet.create({
  wrap: { marginTop: 6, marginBottom: 4 },
  arrow: { width: 12, height: 12, backgroundColor: INK, transform: [{ rotate: '45deg' }], marginBottom: -6 },
  bubble: { backgroundColor: INK, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 14, maxWidth: 280 },
  text: { color: PAPER, fontSize: 14, fontFamily: SANS_MEDIUM },
})
