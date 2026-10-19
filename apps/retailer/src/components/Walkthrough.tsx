import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import * as SecureStore from 'expo-secure-store'

import { Sheet } from './Sheet'

/** Three-card first-run walkthrough, shown once per shop. The full guide stays
 * available from Shop settings. */
const CARDS = [
  { title: 'Home', body: 'Your day at a glance: how many customers, stamps and rewards, with one-tap shortcuts to scan.' },
  { title: 'Analytics', body: 'Insights, your customers (who is loyal, who has gone quiet, and a message button), members and news posts.' },
  { title: 'Scan', body: 'When a customer pays, open Scan, scan their code and tap once. That is the whole job.' },
  { title: 'Shop', body: 'Your profile, rewards, reviews and help live here. Most owners rarely need more than this.' },
]

const keyFor = (businessId: string) => `walkthrough_seen_${businessId.replace(/-/g, '')}`

export function Walkthrough({ businessId, enabled }: { businessId: string; enabled: boolean }) {
  const [visible, setVisible] = useState(false)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    SecureStore.getItemAsync(keyFor(businessId))
      .then((seen) => { if (!cancelled && seen !== 'true') setVisible(true) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [businessId, enabled])

  function close() {
    setVisible(false)
    SecureStore.setItemAsync(keyFor(businessId), 'true').catch(() => {})
  }

  const card = CARDS[index]
  const last = index === CARDS.length - 1
  return (
    <Sheet visible={visible} onClose={close} dragArea="full" sheetStyle={styles.sheet}>
      <Text style={styles.step}>{index + 1} of {CARDS.length}</Text>
      <Text style={styles.title}>{card.title}</Text>
      <Text style={styles.body}>{card.body}</Text>
      <Pressable onPress={() => (last ? close() : setIndex(index + 1))} style={styles.button}>
        <Text style={styles.buttonText}>{last ? 'Got it' : 'Next'}</Text>
      </Pressable>
      {!last && (
        <Pressable onPress={close} style={styles.skip}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      )}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: '#fff', padding: 24, paddingBottom: 36 },
  step: { color: '#59615A', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  title: { color: '#1B1B1B', fontSize: 28, fontWeight: '800', marginTop: 8 },
  body: { color: '#3C433E', fontSize: 16, lineHeight: 23, marginTop: 10 },
  button: { marginTop: 22, minHeight: 50, borderRadius: 14, backgroundColor: '#C0501F', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  skip: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  skipText: { color: '#59615A', fontWeight: '700' },
})
