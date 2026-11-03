import { useEffect, useMemo, useRef } from 'react'
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import * as SecureStore from 'expo-secure-store'

// Full-screen "Reward unlocked" moment, shown once per new reward.
// Seen reward ids live in SecureStore; the first run only records what's
// already there, so nobody gets a pile of old celebrations after an update.
const SEEN_KEY = 'celebrated_reward_ids'
const KEEP = 40

export async function unseenReward<T extends { id: string; redeemed_at?: string | null }>(rewards: T[]): Promise<T | null> {
  const open = rewards.filter(r => !r.redeemed_at)
  let raw: string | null = null
  try { raw = await SecureStore.getItemAsync(SEEN_KEY) } catch { return null }
  if (raw === null) {
    await markRewardsSeen(open.map(r => r.id))
    return null
  }
  let seen: string[] = []
  try { seen = JSON.parse(raw) } catch { seen = [] }
  return open.find(r => !seen.includes(r.id)) ?? null
}

export async function markRewardsSeen(ids: string[]) {
  try {
    const raw = await SecureStore.getItemAsync(SEEN_KEY)
    const seen: string[] = raw ? JSON.parse(raw) : []
    const next = [...seen.filter(id => !ids.includes(id)), ...ids].slice(-KEEP)
    await SecureStore.setItemAsync(SEEN_KEY, JSON.stringify(next))
  } catch {
    // Nothing to do: at worst the celebration shows again next time.
  }
}

const BITS = ['#0042AC', '#00D3FB', '#04183D', '#FFFFFF']

export function RewardCelebration({ reward, onUse, onLater }: {
  reward: { title: string; business?: { name: string } | null } | null
  onUse: () => void
  onLater: () => void
}) {
  const pop = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!reward) return
    pop.setValue(0)
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }).start()
  }, [reward, pop])
  const bits = useMemo(() => {
    let seed = 11
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
    return Array.from({ length: 16 }, (_, i) => {
      const round = i % 3 === 0
      const size = 10 + Math.round(rnd() * 16)
      return { left: `${Math.round(rnd() * 92)}%` as const, top: `${Math.round(rnd() * 62)}%` as const, width: size, height: round ? size : Math.round(size * 0.45), borderRadius: round ? 999 : 3, backgroundColor: BITS[i % BITS.length], transform: [{ rotate: `${Math.round(rnd() * 180)}deg` }] }
    })
  }, [])
  const fall = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!reward) return
    fall.setValue(0)
    Animated.timing(fall, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
  }, [reward, fall])
  if (!reward) return null
  const title = reward.title.trim().replace(/[.!]+$/, '')
  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onLater}>
      <View style={s.screen}>
        {bits.map((bit, i) => <Animated.View key={i} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.bit, bit, { opacity: fall, transform: [...bit.transform, { translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) }] }]} />)}
        <View style={s.badge}><Text style={s.badgeText}>Reward unlocked</Text></View>
        <Animated.Text accessibilityRole="header" style={[s.title, { transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }], opacity: pop }]} numberOfLines={4} adjustsFontSizeToFit>{title}.</Animated.Text>
        {reward.business?.name ? <Text style={s.copy}>From {reward.business.name}. This one's on them.</Text> : null}
        <View style={s.actions}>
          <Pressable accessibilityRole="button" onPress={onUse} style={({ pressed }) => [s.primary, pressed && s.pressed]}><Text style={s.primaryText}>Use it now</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={onLater} style={({ pressed }) => [s.secondary, pressed && s.pressed]}><Text style={s.secondaryText}>Save it for later</Text></Pressable>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#83FD80', paddingHorizontal: 22, paddingTop: 72, paddingBottom: 40 },
  bit: { position: 'absolute' },
  badge: { alignSelf: 'flex-start', height: 34, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#04183D', justifyContent: 'center' },
  badgeText: { color: '#83FD80', fontSize: 13, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  title: { marginTop: 34, color: '#04183D', fontFamily: 'Inter_700Bold', fontSize: 84, lineHeight: 80, letterSpacing: -5 },
  copy: { marginTop: 20, color: '#04183D', fontSize: 20, lineHeight: 26, fontWeight: '600', maxWidth: 320 },
  actions: { marginTop: 'auto', gap: 10 },
  primary: { height: 60, borderRadius: 999, backgroundColor: '#04183D', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  secondary: { height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#04183D', fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.8 },
})
